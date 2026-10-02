import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Crosshair, Download, ImagePlus, Link2, Loader2, Replace, Trash2, Undo2 } from "lucide-react";

import { Slider } from "@/components/poster/inspector";
import { SaveDialog } from "@/components/save-panel";
import { PageFrame, useSize } from "@/components/studio/page-frame";
import { TypePanel, type TypeChange } from "@/components/studio/type-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { popRecord, putRecord } from "@/lib/draft";
import { photoSlots, samplePhoto, slotOf, type StudioPage } from "@/lib/studio";
import { cn } from "@/lib/utils";

/** A picture the reader brought, held in memory as an object URL and never sent anywhere. */
type Photo = { id: string; url: string; name: string; file: File };

/**
 * Where a photograph sits in its frame: `object-position`, in percent on each
 * axis, and how far it is enlarged past filling the frame (1 or absent: not at all).
 */
type Crop = { x: number; y: number; zoom?: number };

let counter = 0;

/** Reads a picture into memory, and makes sure it is one the browser can draw before offering it. */
async function loadPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`${file.name} could not be opened. Try a JPEG or PNG.`);
  }
  counter += 1;
  return { id: `p${counter}`, url, name: file.name, file };
}

/**
 * The editor parked across the Google sign-in redirect, under its own key in
 * the desk's store (`lib/draft.ts`): the same rules, read once and deleted as
 * it is read. Only a save asks for sign-in, so a parked editor always comes
 * back with the save dialog open.
 */
const PARK_KEY = "studio";

type Parked = {
  /** The layout or issue it was parked from; anything else is not restored into. */
  use: string;
  photos: { id: string; name: string; file: File }[];
  assigned: Record<string, string>;
  crops: Record<string, Crop>;
  /** Per page, the markup of each typeable block in document order. */
  blocks: string[][];
  /** Per page, each block's own `style` as the reader left it; absent from editors parked before type could be set. */
  styles?: string[][];
  /** Per page, where the deleted boxes are among the body's elements in document order (`allElements`). */
  deleted?: number[][];
};

/**
 * What the editor adds to a page while it is being worked on: a caret over
 * words, a dashed line round what can be typed into, and a ring round the
 * photographs of the chosen slot, which can then be dragged. All of it hangs
 * off one attribute on the page's root, which comes off before a page is
 * drawn to a file, so none of it can reach one. The block the Type panel is
 * setting keeps a quieter ring while the reader is in the panel instead.
 *
 * One rule here is not an editing mark and holds in the file too: a deleted
 * box is hidden. Hidden rather than taken out, so it keeps its place and
 * nothing else in the design moves into the gap.
 *
 * The picture's ring is an element of its own laid over the frame rather than
 * an outline on the picture: a zoomed picture is clipped back to its frame
 * (`place`), and the clip would take its own outline with it.
 *
 * `touch-action: none` on the chosen picture only: on a phone a finger on it
 * moves the photograph, and a finger anywhere else still scrolls.
 */
const EDITING_CSS = `
[data-atlas-editing] [contenteditable]{cursor:text;border-radius:2px}
[data-atlas-editing] [contenteditable]:hover{outline:1.5px dashed rgba(37,99,235,.65);outline-offset:3px}
[data-atlas-editing] [contenteditable]:focus{outline:2px solid #2563eb;outline-offset:3px}
[data-atlas-editing] [data-atlas-target]:not(:focus){outline:2px solid rgba(37,99,235,.45);outline-offset:3px}
[data-atlas-editing] img[data-slot]{cursor:pointer}
[data-atlas-editing] img[data-atlas-chosen]{cursor:grab;touch-action:none}
[data-atlas-ring]{display:none}
[data-atlas-deleted]{visibility:hidden!important}
[data-atlas-editing] [data-atlas-ring]{display:block;position:absolute;pointer-events:none;box-shadow:inset 0 0 0 5px #2563eb;z-index:2147483647}
[data-atlas-editing] img[data-atlas-chosen]:active{cursor:grabbing}
`;

/**
 * Readies a drawn page for the reader: every run of words becomes typeable in
 * place, and every sample photograph is tagged with the slot it belongs to and
 * the crop it shares.
 *
 * Words are made editable a block at a time — the nearest element holding
 * text of its own — so a heading with an italic phrase inside stays one
 * heading, typed as one, with the phrase's styling where the reader leaves it.
 * `plaintext-only` keeps pasted text from bringing another page's styles in;
 * where a browser does not know it, plain `true` is the fallback, and the
 * frame's sandbox still keeps anything pasted from running.
 *
 * A crop is shared by every copy of a picture drawn at the same size, which is
 * what the two halves of a spread are: one photograph, 1560 wide, shown half
 * on each page. Moved on one, it must move on both. A contents thumbnail of the
 * same picture is another size and keeps its own.
 *
 * A picture can be zoomed when the design fills its frame with it (`cover`)
 * and does not already cut it to a shape with a `clip-path`, which zooming
 * would have to replace. Rounded corners are kept, so their radius is noted.
 */
const hasOwnText = (element: Element) => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());

function prepare(doc: Document) {
  const style = doc.createElement("style");
  style.dataset.atlas = "";
  style.textContent = EDITING_CSS;
  doc.head.append(style);
  doc.documentElement.setAttribute("data-atlas-editing", "");

  for (const sheet of Array.from(doc.querySelectorAll<HTMLStyleElement>("style:not([data-atlas])"))) {
    sheet.dataset.original = sheet.textContent ?? "";
  }
  for (const image of Array.from(doc.querySelectorAll("img"))) {
    const slot = slotOf(image.getAttribute("src"));
    if (!slot) continue;
    image.dataset.slot = slot;
    image.dataset.crop = `${slot}|${Math.round(image.offsetWidth)}x${Math.round(image.offsetHeight)}`;
    image.dataset.position = image.style.objectPosition;
    image.dataset.origin = image.style.transformOrigin;
    const look = doc.defaultView!.getComputedStyle(image);
    if (look.objectFit === "cover" && look.clipPath === "none") image.dataset.zoomable = "";
    if (look.borderRadius && !/^0(px)?$/.test(look.borderRadius)) image.dataset.radius = look.borderRadius;
    image.draggable = false;
  }
  for (const element of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
    if (element.closest("[contenteditable], svg") || element.tagName === "STYLE") continue;
    if (!hasOwnText(element)) continue;
    try {
      element.contentEditable = "plaintext-only";
    } catch {
      element.contentEditable = "true";
    }
  }
}

const editable = (doc: Document) => Array.from(doc.querySelectorAll<HTMLElement>("[contenteditable]"));

/** Every element on a page in document order: how a parked editor says which boxes were deleted. */
const allElements = (doc: Document) => Array.from(doc.body.querySelectorAll<HTMLElement>("*"));

const DELETED = "data-atlas-deleted";

/** Not drawn: deleted, or inside something that is. */
const isDeleted = (element: Element) => element.closest(`[${DELETED}]`) !== null;

/**
 * What goes when the reader deletes a block of words or a picture: the element
 * and every wrapper round it that holds nothing else — the white mount of a
 * polaroid, the coloured pill round a label — so no empty frame is left behind.
 * The climb stops below the page itself (the body's one child), which is never
 * a box.
 */
function boxOf(element: HTMLElement): HTMLElement {
  const body = element.ownerDocument.body;
  let box = element;
  for (let parent = box.parentElement; parent && parent !== body && parent.parentElement !== body; parent = box.parentElement) {
    if (parent.children.length !== 1 || hasOwnText(parent)) break;
    box = parent;
  }
  return box;
}

/**
 * A block the reader has set type on keeps the `style` the design gave it in
 * `data-atlas-style`, written once, before the first change: that is what
 * "As designed" puts back, and its presence is how a page knows it has been
 * changed. A design's inline style is part of the design, so it is kept, not
 * cleared.
 */
const ORIGINAL_STYLE = "data-atlas-style";

function setStyle(block: HTMLElement, style: string) {
  if (!block.hasAttribute(ORIGINAL_STYLE)) block.setAttribute(ORIGINAL_STYLE, block.getAttribute("style") ?? "");
  block.setAttribute("style", style);
}

function resetStyle(block: HTMLElement) {
  const original = block.getAttribute(ORIGINAL_STYLE);
  if (original === null) return;
  if (original) block.setAttribute("style", original);
  else block.removeAttribute("style");
  block.removeAttribute(ORIGINAL_STYLE);
}

/**
 * Draws a picture at a crop.
 *
 * Zoom is the `scale` property about the crop's own point, so the part of the
 * photograph the reader has centred stays where it is as it grows, and a
 * `clip-path` cuts the enlarged picture back to its frame. `scale` rather than
 * `transform`, because a design may tilt a picture with a transform of its own
 * and the two must compose. The inset is in the picture's own coordinates,
 * before scaling: on each side, the share of the frame the scaled picture
 * pushes past that edge. A rounded corner's radius shrinks by the zoom for the
 * same reason, so it is drawn at the design's size.
 *
 * The press draws the page through the browser (`modern-screenshot`), so the
 * file is clipped and scaled exactly as the screen is.
 */
function place(image: HTMLImageElement, crop: Crop | undefined) {
  image.style.objectPosition = crop ? `${crop.x}% ${crop.y}%` : (image.dataset.position ?? "");
  const zoom = crop?.zoom ?? 1;
  if (!crop || zoom <= 1) {
    image.style.scale = "";
    image.style.transformOrigin = image.dataset.origin ?? "";
    image.style.clipPath = "";
    return;
  }
  const keep = 1 - 1 / zoom;
  const inset = (share: number) => `${Math.round(share * keep * 100) / 100}%`;
  const radius = image.dataset.radius ? ` round ${image.dataset.radius.replace(/[\d.]+/g, length => String(Number(length) / zoom))}` : "";
  image.style.scale = String(zoom);
  image.style.transformOrigin = `${crop.x}% ${crop.y}%`;
  image.style.clipPath = `inset(${inset(crop.y)} ${inset(100 - crop.x)} ${inset(100 - crop.y)} ${inset(crop.x)}${radius})`;
}

/** Puts each slot's current picture and crop into a drawn page, and rings the chosen slot's. */
function paint(doc: Document, urls: Record<string, string>, crops: Record<string, Crop>, chosen: string | null) {
  for (const ring of Array.from(doc.querySelectorAll("[data-atlas-ring]"))) ring.remove();
  for (const image of Array.from(doc.querySelectorAll<HTMLImageElement>("img[data-slot]"))) {
    const url = urls[image.dataset.slot!];
    if (url && image.getAttribute("src") !== url) image.src = url;
    place(image, crops[image.dataset.crop!]);
    const isChosen = image.dataset.slot === chosen;
    image.toggleAttribute("data-atlas-chosen", isChosen);
    if (isChosen && !isDeleted(image)) ring(doc, image);
  }
  // A few designs draw a photograph as a CSS background (a type mask, a
  // halftone), so the page's own stylesheet is rewritten from its original too.
  for (const sheet of Array.from(doc.querySelectorAll<HTMLStyleElement>("style[data-original]"))) {
    let css = sheet.dataset.original!;
    for (const [slot, url] of Object.entries(urls)) css = css.replaceAll(samplePhoto(slot), url);
    if (sheet.textContent !== css) sheet.textContent = css;
  }
}

/**
 * The chosen picture's ring, laid over its frame. Measured with the zoom taken
 * off for the moment, because the frame is the box the picture was laid out
 * in, not the larger one it is scaled to; a pan or a pinch changes neither.
 */
function ring(doc: Document, image: HTMLImageElement) {
  const zoom = image.style.scale;
  image.style.scale = "";
  const box = image.getBoundingClientRect();
  image.style.scale = zoom;
  const view = doc.defaultView!;
  const mark = doc.createElement("div");
  mark.setAttribute("data-atlas-ring", "");
  mark.style.left = `${box.left + view.scrollX}px`;
  mark.style.top = `${box.top + view.scrollY}px`;
  mark.style.width = `${box.width}px`;
  mark.style.height = `${box.height}px`;
  doc.body.append(mark);
}

/**
 * A computed `object-position` as percentages. Percent is what the designs
 * write and what the browser reports for them; a length is converted against
 * the photograph's spare width, and anything else starts from the middle.
 */
function readPosition(value: string, spare: { x: number; y: number }): Crop {
  const [x = "50%", y = "50%"] = value.split(" ");
  const axis = (part: string, room: number) => {
    if (part.endsWith("%")) return Number.parseFloat(part);
    if (part.endsWith("px") && room > 1) return (-Number.parseFloat(part) / room) * 100;
    return 50;
  };
  return { x: axis(x, spare.x), y: axis(y, spare.y) };
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value * 10) / 10));

/** Past four times, even a good phone photograph is mostly blur at the page's printed size. */
const MAX_ZOOM = 4;
const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(1, Math.round(value * 100) / 100));

/** How much wider and taller than its frame `cover` draws a photograph, in page px. */
function spareOf(image: HTMLImageElement) {
  if (!image.naturalWidth) return { x: 0, y: 0 };
  const scale = Math.max(image.clientWidth / image.naturalWidth, image.clientHeight / image.naturalHeight);
  return { x: image.naturalWidth * scale - image.clientWidth, y: image.naturalHeight * scale - image.clientHeight };
}

/**
 * How far, in page px, the photograph moves across its frame as the crop goes
 * from 0% to 100% on each axis, at a zoom. At 1× that is only the part `cover`
 * left outside the frame; zoomed, the scaled frame's own overhang moves with it
 * (`place` puts the zoom's centre at the crop point), and the two add up.
 */
function roomOf(image: HTMLImageElement, zoom: number) {
  const spare = spareOf(image);
  return { x: zoom * spare.x + (zoom - 1) * image.clientWidth, y: zoom * spare.y + (zoom - 1) * image.clientHeight };
}

/** Where a picture sits now: the reader's crop, or else the design's, read off the page. */
function cropOf(image: HTMLImageElement, crops: Record<string, Crop>): Crop {
  return crops[image.dataset.crop!] ?? { ...readPosition(image.ownerDocument.defaultView!.getComputedStyle(image).objectPosition, spareOf(image)), zoom: 1 };
}

/** "September 2026", the dateline a saved issue from the desk carries. */
const dateline = () => new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date());

type Props = {
  /** The page or section id the editor was opened on, so a parked editor comes back only to the same layout. */
  id: string;
  /** What the pages are called, for the heading and the downloaded file's name. */
  title: string;
  pages: StudioPage[];
  onClose: () => void;
};

/**
 * A Studio layout with the reader's own photographs and words in it.
 *
 * The design itself does not move: every photograph stays in its frame and
 * every line in its place, exactly as drawn. What changes is what is in them.
 * Photographs are swapped slot by slot (or poured in all at once, in order)
 * and dragged to sit where the reader wants them in their frames, and words
 * are typed straight onto the page. Text runs as far as the design gives it
 * room and is cut off there; it does not flow on to another page.
 *
 * Nothing leaves the browser unless the reader saves it. Photographs are
 * object URLs, the words live in the page's own frame, and files are drawn
 * here by the magazine's press. A save goes the way the desk's does: the pages
 * drawn as pictures, sealed in this browser, and the key in the link.
 */
export function FillIn({ id, title, pages, onClose }: Props) {
  const { user, signInWithGoogle } = useAuth();
  const slots = useMemo(() => photoSlots(pages), [pages]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [crops, setCrops] = useState<Record<string, Crop>>({});
  const [chosen, setChosen] = useState<string | null>(slots[0] ?? null);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  // The block of words the Type panel sets: the last one the reader typed in.
  // An element in a page's frame rather than an index, so it survives the
  // reader stepping out of the page into the panel.
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [typeVersion, setTypeVersion] = useState(0);
  // Deleted boxes, one entry per deletion, newest last, so Undo brings back
  // exactly what one press took away.
  const [deletions, setDeletions] = useState<HTMLElement[][]>([]);

  const docs = useRef<(Document | null)[]>([]);
  const words = useRef<string[]>([]);
  const restoring = useRef<Parked | null>(null);
  const [ready, setReady] = useState(0);

  // Read by the page's own listeners, which are set up once per page.
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;
  const cropsRef = useRef(crops);
  cropsRef.current = crops;

  const column = useRef<HTMLDivElement>(null);
  const { width: columnWidth } = useSize(column);
  const pageWidth = Math.min(columnWidth, 620);

  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url)), []);

  // The page behind stays put while this is open, and focus starts here.
  useEffect(() => {
    heading.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  /**
   * Typed words, set type and deleted boxes back into a page, from a parked
   * editor. Words first: a typed line break is an element, so the positions
   * the deleted boxes were parked at hold only once the words are back.
   */
  const restorePage = (doc: Document, parked: Parked | null, page: number) => {
    if (!parked) return;
    const blocks = parked.blocks[page];
    const styles = parked.styles?.[page];
    editable(doc).forEach((block, index) => {
      const markup = blocks?.[index];
      if (markup !== undefined && block.innerHTML !== markup) block.innerHTML = markup;
      const style = styles?.[index];
      if (style !== undefined && style !== (block.getAttribute("style") ?? "")) setStyle(block, style);
    });
    const elements = allElements(doc);
    const gone = (parked.deleted?.[page] ?? []).flatMap(index => elements[index] ?? []).filter(box => !box.hasAttribute(DELETED));
    if (gone.length === 0) return;
    for (const box of gone) box.setAttribute(DELETED, "");
    setDeletions(current => [...current, gone]);
  };

  // Back from signing in: the parked editor, if it was this layout's, and
  // straight on to the save the reader had asked for.
  useEffect(() => {
    let cancelled = false;
    void popRecord(PARK_KEY).then(value => {
      const parked = value as Parked | null;
      if (cancelled || !parked || parked.use !== id) return;
      const restored = parked.photos.map(photo => ({ ...photo, url: URL.createObjectURL(photo.file) }));
      counter += restored.length;
      setPhotos(restored);
      setAssigned(parked.assigned);
      setCrops(parked.crops);
      restoring.current = parked;
      docs.current.forEach((doc, index) => doc && restorePage(doc, parked, index));
      setSaveOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const urls = useMemo(() => {
    const byId = new Map(photos.map(photo => [photo.id, photo.url]));
    return Object.fromEntries(slots.map(slot => [slot, byId.get(assigned[slot] ?? "") ?? samplePhoto(slot)]));
  }, [slots, photos, assigned]);

  useEffect(() => {
    for (const doc of docs.current) if (doc) paint(doc, urls, crops, chosen);
  }, [urls, crops, chosen, ready, deletions]);

  /**
   * Presses on a page's photographs. The first press on a picture chooses its
   * slot; a press on the chosen one drags the photograph within its frame, and
   * two fingers on it pinch it larger or smaller.
   *
   * Pan and pinch are one gesture: the fingers' midpoint moves the picture and
   * their spread zooms it. Both are measured from where the fingers were when
   * the last one went down or came up, so the picture never jumps as a second
   * finger arrives or leaves. The pointer's position is in the page's own
   * pixels, and so is the photograph's room to move, so the picture follows
   * the finger at any zoom of the page. Moved by style as it goes and committed
   * on release, so a gesture is one change, not one per pointer event.
   *
   * On a laptop a trackpad pinch arrives as a wheel event with Ctrl held, which
   * is taken for zoom over the chosen picture instead of zooming the window.
   */
  const listen = useCallback((doc: Document) => {
    // Typing in a block makes it the one the Type panel sets.
    doc.addEventListener("focusin", event => {
      const block = (event.target as Element | null)?.closest?.("[contenteditable]") as HTMLElement | null;
      if (block) setTarget(block);
    });

    let gesture: { image: HTMLImageElement; add: (down: PointerEvent) => void } | null = null;
    doc.addEventListener("pointerdown", event => {
      const image = (event.target as Element | null)?.closest?.("img[data-slot]") as HTMLImageElement | null;
      if (!image) return;
      // A press on a picture is about the picture: the sidebar goes back to them.
      setTarget(null);
      const slot = image.dataset.slot!;
      if (chosenRef.current !== slot) {
        setChosen(slot);
        return;
      }
      const view = doc.defaultView;
      if (!view || view.getComputedStyle(image).objectFit !== "cover" || !image.naturalWidth) return;
      event.preventDefault();
      image.setPointerCapture(event.pointerId);
      if (gesture?.image === image) {
        gesture.add(event);
        return;
      }

      const key = image.dataset.crop!;
      const zoomable = image.hasAttribute("data-zoomable");
      const twins = docs.current.flatMap(page => (page ? Array.from(page.querySelectorAll<HTMLImageElement>(`img[data-crop="${CSS.escape(key)}"]`)) : []));
      const points = new Map<number, { x: number; y: number }>();
      const first = cropOf(image, cropsRef.current);
      let at = first;

      const measure = () => {
        const all = [...points.values()];
        const x = all.reduce((sum, point) => sum + point.x, 0) / all.length;
        const y = all.reduce((sum, point) => sum + point.y, 0) / all.length;
        const span = all.length > 1 ? Math.hypot(all[0]!.x - all[1]!.x, all[0]!.y - all[1]!.y) : 0;
        return { x, y, span };
      };
      let base = { crop: at, x: 0, y: 0, span: 0 };
      const rebase = () => {
        base = { crop: at, ...measure() };
      };
      const add = (down: PointerEvent) => {
        points.set(down.pointerId, { x: down.clientX, y: down.clientY });
        rebase();
      };

      const move = (next: PointerEvent) => {
        if (!points.has(next.pointerId)) return;
        points.set(next.pointerId, { x: next.clientX, y: next.clientY });
        const now = measure();
        const from = base.crop.zoom ?? 1;
        const zoom = zoomable && base.span > 0 && now.span > 0 ? clampZoom((from * now.span) / base.span) : from;
        const room = roomOf(image, zoom);
        at = {
          x: room.x > 1 ? clamp(base.crop.x - ((now.x - base.x) / room.x) * 100) : base.crop.x,
          y: room.y > 1 ? clamp(base.crop.y - ((now.y - base.y) / room.y) * 100) : base.crop.y,
          zoom,
        };
        for (const twin of twins) place(twin, at);
      };
      const end = (last: PointerEvent) => {
        points.delete(last.pointerId);
        if (points.size > 0) {
          rebase();
          return;
        }
        image.removeEventListener("pointermove", move);
        image.removeEventListener("pointerup", end);
        image.removeEventListener("pointercancel", end);
        gesture = null;
        if (at !== first) setCrops(current => ({ ...current, [key]: at }));
      };

      add(event);
      image.addEventListener("pointermove", move);
      image.addEventListener("pointerup", end);
      image.addEventListener("pointercancel", end);
      gesture = { image, add };
    });

    doc.addEventListener(
      "wheel",
      event => {
        if (!event.ctrlKey) return;
        const image = (event.target as Element | null)?.closest?.("img[data-zoomable]") as HTMLImageElement | null;
        if (!image || image.dataset.slot !== chosenRef.current || !image.naturalWidth) return;
        event.preventDefault();
        const key = image.dataset.crop!;
        setCrops(current => {
          const crop = cropOf(image, current);
          return { ...current, [key]: { ...crop, zoom: clampZoom((crop.zoom ?? 1) * Math.exp(-event.deltaY / 100)) } };
        });
      },
      { passive: false },
    );
  }, []);

  const loaded = useCallback(
    (index: number, frame: HTMLIFrameElement) => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      prepare(doc);
      docs.current[index] = doc;
      words.current[index] = doc.body.textContent ?? "";
      restorePage(doc, restoring.current, index);
      listen(doc);
      setReady(count => count + 1);
    },
    [listen],
  );

  // The quieter ring on the block being set, which stays while the reader is in the panel.
  useEffect(() => {
    target?.setAttribute("data-atlas-target", "");
    return () => target?.removeAttribute("data-atlas-target");
  }, [target]);

  /** Sets type on the chosen block. Through `setStyle`, so the design's own style is kept to go back to. */
  const format = (change: TypeChange) => {
    if (!target) return;
    const probe = target.ownerDocument.createElement("span");
    probe.setAttribute("style", target.getAttribute("style") ?? "");
    for (const [property, value] of Object.entries(change)) {
      if (value === null) probe.style.removeProperty(property);
      else probe.style.setProperty(property, value);
    }
    setStyle(target, probe.getAttribute("style") ?? "");
    setTypeVersion(version => version + 1);
  };

  // Every zoomable copy of the chosen picture, for the Zoom slider: the plate
  // and its contents thumbnail grow together, each about its own crop point.
  const chosenImages = chosen
    ? docs.current.flatMap(doc => (doc ? Array.from(doc.querySelectorAll<HTMLImageElement>(`img[data-slot="${CSS.escape(chosen)}"][data-zoomable]`)) : []))
    : [];
  const chosenZoom = Math.max(1, ...chosenImages.map(image => crops[image.dataset.crop!]?.zoom ?? 1));

  const zoomChosen = (zoom: number) => {
    const images = chosenImages.filter(image => image.naturalWidth);
    setCrops(current => ({ ...current, ...Object.fromEntries(images.map(image => [image.dataset.crop!, { ...cropOf(image, current), zoom }])) }));
  };

  /** Every copy of the chosen picture, zoomable or not: what Delete takes away. */
  const chosenAll = chosen
    ? docs.current.flatMap(doc => (doc ? Array.from(doc.querySelectorAll<HTMLImageElement>(`img[data-slot="${CSS.escape(chosen)}"]`)) : []))
    : [];
  const chosenGone = chosenAll.length > 0 && chosenAll.every(isDeleted);

  /** Hides the boxes round some elements, as one deletion. */
  const remove = (elements: HTMLElement[]) => {
    const boxes = [...new Set(elements.map(boxOf))].filter(box => !box.hasAttribute(DELETED));
    if (boxes.length === 0) return;
    for (const box of boxes) box.setAttribute(DELETED, "");
    setDeletions(current => [...current, boxes]);
  };

  const bringBack = (boxes: HTMLElement[]) => {
    for (const box of boxes) box.removeAttribute(DELETED);
    setDeletions(current => current.map(entry => entry.filter(box => !boxes.includes(box))).filter(entry => entry.length > 0));
  };

  const deleteBlock = () => {
    if (!target) return;
    target.blur();
    remove([target]);
    setTarget(null);
  };

  const resetType = () => {
    if (!target) return;
    resetStyle(target);
    setTypeVersion(version => version + 1);
  };

  /** Changes what is in some slots, and lets each changed slot's photograph sit where the design put it again. */
  const assign = (changes: Record<string, string>) => {
    setAssigned(current => ({ ...current, ...changes }));
    setCrops(current => Object.fromEntries(Object.entries(current).filter(([key]) => !(key.split("|")[0]! in changes))));
  };

  /**
   * New photographs go where the reader asked: into the slot being replaced,
   * or else into the slots still showing a sample, in order. With more slots
   * than photographs the reader's pictures go round again rather than leave a
   * stranger's photograph in their magazine; any one can be changed after.
   */
  const addPhotos = async (files: File[], target: string | null) => {
    setError(null);
    const fresh: Photo[] = [];
    for (const file of files) {
      try {
        fresh.push(await loadPhoto(file));
      } catch (problem) {
        setError((problem as Error).message);
      }
    }
    if (fresh.length === 0) return;
    const all = [...photos, ...fresh];
    setPhotos(all);
    if (target) {
      assign({ [target]: fresh[0]!.id });
      return;
    }
    const queue = [...fresh, ...all.filter(photo => !fresh.includes(photo))];
    const changes: Record<string, string> = {};
    let turn = 0;
    for (const slot of slots) {
      if (assigned[slot]) continue;
      changes[slot] = queue[turn % queue.length]!.id;
      turn += 1;
    }
    assign(changes);
  };

  const pick = (target: string | null) => {
    pickFor.current = target;
    picker.current?.click();
  };

  const changed = () =>
    photos.length > 0 ||
    deletions.length > 0 ||
    docs.current.some((doc, index) => doc && ((doc.body.textContent ?? "") !== words.current[index] || doc.querySelector(`[${ORIGINAL_STYLE}]`)));

  const leave = () => {
    if (changed() && !window.confirm("Leave this layout? Your photos and words are not saved anywhere, so they will be lost.")) return;
    onClose();
  };

  /** Takes the editor's marks off every page for drawing, and hands back the pages and the way to put the marks back. */
  const forPress = () => {
    const drawn = docs.current.filter((doc): doc is Document => Boolean(doc));
    for (const doc of drawn) {
      (doc.activeElement as HTMLElement | null)?.blur?.();
      doc.documentElement.removeAttribute("data-atlas-editing");
    }
    return {
      // The body, not the page inside it: the press paints its white over the
      // background of whatever it is handed, and on most of these pages the
      // root's background is the paper itself. The body is exactly the page's
      // size (no margin, the frame's own width), so nothing else changes.
      leaves: drawn.map(doc => doc.body),
      done: () => drawn.forEach(doc => doc.documentElement.setAttribute("data-atlas-editing", "")),
    };
  };

  /**
   * Draws the pages through the magazine's press. Twice the page's own pixels:
   * a 780 × 1040 page comes out 1560 × 2080, the same as an issue from the desk.
   */
  const download = async (kind: "pdf" | "png") => {
    if (docs.current.filter(Boolean).length !== pages.length) return;
    setBusy(kind);
    setError(null);
    const { leaves, done } = forPress();
    try {
      const [press, pdf] = await Promise.all([import("@/lib/magazine/press"), import("@/lib/magazine/pdf")]);
      await Promise.all(leaves.map(leaf => leaf.ownerDocument.fonts.ready));
      if (kind === "png") {
        const canvas = await press.drawLeaf(leaves[0]!, 2);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        press.releaseCanvas(canvas);
        if (!blob) throw new Error("encode");
        press.saveBlob(blob, `${press.slugOf(title)}.png`);
      } else {
        const drawn = [];
        for (const leaf of leaves) {
          const canvas = await press.drawLeaf(leaf, 2);
          drawn.push({ bytes: new Uint8Array(await (await press.jpegOf(canvas, 0.9)).arrayBuffer()), width: canvas.width, height: canvas.height });
          press.releaseCanvas(canvas);
        }
        // Half a point per page pixel: 780 × 1040 prints at 390 × 520 pt, the magazine's own sheet.
        const first = pages[0]!;
        press.saveIssue(pdf.writePdf(drawn, { width: first.width / 2, height: first.height / 2 }, title), title);
      }
    } catch {
      setError("The file could not be made. Try again, or with fewer or smaller photos.");
    } finally {
      done();
      setBusy(null);
    }
  };

  /**
   * Saving needs an account, and signing in is a full-page trip to Google. The
   * editor is parked first — photographs as the files they are, the words as
   * typed, every crop — and the save dialog opens again on the way back.
   */
  const claimSave = async () => {
    if (user) return true;
    const parked: Parked = {
      use: id,
      photos: photos.map(({ id: photoId, name, file }) => ({ id: photoId, name, file })),
      assigned,
      crops,
      blocks: docs.current.map(doc => (doc ? editable(doc).map(block => block.innerHTML) : [])),
      styles: docs.current.map(doc => (doc ? editable(doc).map(block => block.getAttribute("style") ?? "") : [])),
      deleted: docs.current.map(doc => (doc ? allElements(doc).flatMap((element, index) => (element.hasAttribute(DELETED) ? [index] : [])) : [])),
    };
    await putRecord(PARK_KEY, parked);
    await signInWithGoogle(`${window.location.pathname}${window.location.search}`);
    return false;
  };

  /** Everything the reader of a saved link is told about it, drawn from the pages as they now stand, deleted words left out. */
  const manifest = () => {
    const shown = (doc: Document | null) => (doc ? editable(doc).filter(block => !isDeleted(block)) : []);
    const texts = docs.current.map(doc => shown(doc).map(block => block.textContent ?? "").join(" "));
    const opening = shown(docs.current[0] ?? null)
      .map(block => block.textContent?.trim() ?? "")
      .find(text => text.length >= 40);
    return {
      title,
      dateline: dateline(),
      folios: pages.map((_, index) => (index === 0 ? null : index + 1)),
      words: texts.join(" ").split(/\s+/).filter(Boolean).length,
      photographs: photos.length,
      dek: opening ? opening.slice(0, 160) : "",
    };
  };

  // Saved issues are read as 3:4 slides; the one spread in the studio is not a page of that shape.
  const saveable = pages.every(page => page.width * 4 === page.height * 3);
  const allReady = ready >= pages.length;
  const chosenIndex = chosen ? slots.indexOf(chosen) + 1 : 0;
  // Whether every copy of a picture is deleted, for its thumbnail in the sidebar.
  const gone = (slot: string) => {
    const copies = docs.current.flatMap(doc => (doc ? Array.from(doc.querySelectorAll(`img[data-slot="${CSS.escape(slot)}"]`)) : []));
    return copies.length > 0 && copies.every(isDeleted);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="fill-in-title" className="fixed inset-0 z-60 flex flex-col bg-stone-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={leave} aria-label="Back to the studio">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] tracking-[0.24em] text-stone-500 uppercase">Atlas Studio</span>
            <h2 id="fill-in-title" ref={heading} tabIndex={-1} className="font-editorial truncate text-2xl text-stone-900 outline-none">
              {title}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {saveable && (
            <Button variant="outline" className="rounded-full" disabled={!allReady || busy !== null} onClick={() => setSaveOpen(true)}>
              <Link2 className="size-4" />
              Save &amp; share
            </Button>
          )}
          {pages.length === 1 && (
            <Button variant="outline" className="rounded-full" disabled={!allReady || busy !== null} onClick={() => void download("png")}>
              {busy === "png" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              PNG
            </Button>
          )}
          <Button className="rounded-full" disabled={!allReady || busy !== null} onClick={() => void download("pdf")}>
            {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download PDF
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <aside className="flex shrink-0 flex-col gap-5 border-b border-stone-200 bg-white p-4 sm:px-6 lg:w-80 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-2">
            <Button className="w-full rounded-full" onClick={() => pick(null)}>
              <ImagePlus className="size-4" />
              Add your photos
            </Button>
            <p className="text-xs leading-relaxed text-stone-500">
              They fill the pictures in order. Press a picture on the page to choose it, then drag it to move the photo in its frame, and pinch or use
              Zoom to enlarge it. Tap any words to rewrite them and change their font, size, alignment and colour. Any box can be deleted and brought back. Nothing is uploaded
              unless you save.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {deletions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-stone-100 px-3 py-2">
              <span className="mr-auto text-xs text-stone-600">
                {deletions.flat().length} {deletions.flat().length === 1 ? "box" : "boxes"} deleted
              </span>
              <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => bringBack(deletions.at(-1)!)}>
                <Undo2 className="size-3.5" />
                Undo
              </Button>
              {deletions.length > 1 && (
                <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={() => bringBack(deletions.flat())}>
                  Bring all back
                </Button>
              )}
            </div>
          )}

          {/* In the sidebar beside the pages on a wide screen. On a phone the
              sidebar sits above the pages, out of sight of the words being
              set, so the panel rises from the bottom of the screen instead. */}
          {target && (
            <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:max-h-[45vh] max-lg:overflow-y-auto max-lg:rounded-t-2xl max-lg:border-t max-lg:border-stone-200 max-lg:bg-white max-lg:p-4 max-lg:shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
              <TypePanel
                block={target}
                version={typeVersion}
                formatted={target.hasAttribute(ORIGINAL_STYLE)}
                onChange={format}
                onReset={resetType}
                onDelete={deleteBlock}
                onDone={() => setTarget(null)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-stone-500 uppercase">Pictures in this layout</h3>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
              {slots.map((slot, index) => (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => setChosen(slot)}
                    aria-pressed={chosen === slot}
                    aria-label={`Picture ${index + 1}${gone(slot) ? ", deleted" : assigned[slot] ? ", your photo" : ", sample"}`}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-md ring-offset-2 transition-shadow",
                      chosen === slot ? "ring-2 ring-blue-600" : "ring-1 ring-stone-200 hover:ring-stone-400",
                    )}
                  >
                    <img src={urls[slot]} alt="" className={cn("size-full object-cover", !assigned[slot] && "opacity-60 grayscale", gone(slot) && "opacity-25")} />
                    <span className="absolute top-1 left-1 rounded bg-stone-900/80 px-1.5 text-[10px] font-medium text-white tabular-nums">{index + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
            {chosen && chosenImages.length > 0 && !chosenGone && (
              <Slider label={`Zoom picture ${chosenIndex}`} value={chosenZoom} min={1} max={MAX_ZOOM} step={0.05} unit="×" onHold={() => {}} onPreview={zoomChosen} />
            )}
            {chosen && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => pick(chosen)}>
                  <Replace className="size-4" />
                  New photo for picture {chosenIndex}
                </Button>
                {chosenGone ? (
                  <Button key="put-back" variant="outline" size="sm" className="rounded-full" onClick={() => bringBack(chosenAll.map(boxOf))}>
                    <Undo2 className="size-4" />
                    Put picture {chosenIndex} back
                  </Button>
                ) : (
                  <Button key="delete" variant="ghost" size="sm" className="rounded-full text-red-700 hover:text-red-800" onClick={() => remove(chosenAll)}>
                    <Trash2 className="size-4" />
                    Delete picture {chosenIndex}
                  </Button>
                )}
                {!chosenGone && Object.keys(crops).some(key => key.startsWith(`${chosen}|`)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setCrops(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${chosen}|`))))}
                  >
                    <Crosshair className="size-4" />
                    Reset position and zoom
                  </Button>
                )}
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-stone-500 uppercase">Your photos</h3>
              <p className="text-xs text-stone-500">Choose a picture above, then one of yours to put in it.</p>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
                {photos.map(photo => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      disabled={!chosen}
                      onClick={() => chosen && assigned[chosen] !== photo.id && assign({ [chosen]: photo.id })}
                      aria-label={`Put ${photo.name} in picture ${chosenIndex}`}
                      className={cn(
                        "block aspect-square w-full overflow-hidden rounded-md ring-1 ring-stone-200 transition-shadow hover:ring-stone-400",
                        chosen && assigned[chosen] === photo.id && "ring-2 ring-blue-600",
                      )}
                    >
                      <img src={photo.url} alt="" className="size-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className={cn("flex min-h-0 flex-1 justify-center p-4 sm:p-8 lg:overflow-y-auto", target && "max-lg:pb-[48vh]")}>
          <div ref={column} className="flex w-full max-w-155 flex-col items-center gap-8">
            {pages.map((page, index) => (
              <div key={page.id} className="flex flex-col items-center gap-2">
                <PageFrame
                  page={page}
                  width={pageWidth}
                  live
                  interactive
                  label={`${page.title}, page ${index + 1} of ${pages.length}`}
                  onLoad={frame => loaded(index, frame)}
                />
                {pages.length > 1 && <span className="text-xs text-stone-500 tabular-nums">{page.title}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";
          if (files.length > 0) void addPhotos(pickFor.current ? files.slice(0, 1) : files, pickFor.current);
        }}
      />

      {saveable && (
        <SaveDialog
          title={title}
          pages={pages.length}
          open={saveOpen}
          onOpenChange={setSaveOpen}
          onPress={claimSave}
          manifest={manifest}
          draw={forPress}
        />
      )}
    </div>
  );
}
