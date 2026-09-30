import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Crosshair, Download, ImagePlus, Link2, Loader2, Replace } from "lucide-react";

import { SaveDialog } from "@/components/save-panel";
import { PageFrame, useSize } from "@/components/studio/page-frame";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { popRecord, putRecord } from "@/lib/draft";
import { photoSlots, samplePhoto, slotOf, type StudioPage } from "@/lib/studio";
import { cn } from "@/lib/utils";

/** A picture the reader brought, held in memory as an object URL and never sent anywhere. */
type Photo = { id: string; url: string; name: string; file: File };

/** Where a photograph sits in its frame: `object-position`, in percent on each axis. */
type Crop = { x: number; y: number };

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
};

/**
 * What the editor adds to a page while it is being worked on: a caret over
 * words, a dashed line round what can be typed into, and a ring round the
 * photographs of the chosen slot, which can then be dragged. All of it hangs
 * off one attribute on the page's root, which comes off before a page is
 * drawn to a file, so none of it can reach one.
 *
 * `touch-action: none` on the chosen picture only: on a phone a finger on it
 * moves the photograph, and a finger anywhere else still scrolls.
 */
const EDITING_CSS = `
[data-atlas-editing] [contenteditable]{cursor:text;border-radius:2px}
[data-atlas-editing] [contenteditable]:hover{outline:1.5px dashed rgba(37,99,235,.65);outline-offset:3px}
[data-atlas-editing] [contenteditable]:focus{outline:2px solid #2563eb;outline-offset:3px}
[data-atlas-editing] img[data-slot]{cursor:pointer}
[data-atlas-editing] img[data-atlas-chosen]{outline:5px solid #2563eb;outline-offset:-5px;cursor:grab;touch-action:none}
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
 */
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
    image.draggable = false;
  }
  for (const element of Array.from(doc.body.querySelectorAll<HTMLElement>("*"))) {
    if (element.closest("[contenteditable], svg") || element.tagName === "STYLE") continue;
    const ownText = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    if (!ownText) continue;
    try {
      element.contentEditable = "plaintext-only";
    } catch {
      element.contentEditable = "true";
    }
  }
}

const editable = (doc: Document) => Array.from(doc.querySelectorAll<HTMLElement>("[contenteditable]"));

/** Puts each slot's current picture and crop into a drawn page, and rings the chosen slot's. */
function paint(doc: Document, urls: Record<string, string>, crops: Record<string, Crop>, chosen: string | null) {
  for (const image of Array.from(doc.querySelectorAll<HTMLImageElement>("img[data-slot]"))) {
    const url = urls[image.dataset.slot!];
    if (url && image.getAttribute("src") !== url) image.src = url;
    const crop = crops[image.dataset.crop!];
    image.style.objectPosition = crop ? `${crop.x}% ${crop.y}%` : (image.dataset.position ?? "");
    image.toggleAttribute("data-atlas-chosen", image.dataset.slot === chosen);
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

  const docs = useRef<(Document | null)[]>([]);
  const words = useRef<string[]>([]);
  const restoring = useRef<string[][] | null>(null);
  const [ready, setReady] = useState(0);

  // Read by the page's own listeners, which are set up once per page.
  const chosenRef = useRef(chosen);
  chosenRef.current = chosen;

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

  /** Typed words back into a page, from a parked editor. */
  const restoreWords = (doc: Document, blocks: string[] | undefined) => {
    if (!blocks) return;
    editable(doc).forEach((block, index) => {
      const markup = blocks[index];
      if (markup !== undefined && block.innerHTML !== markup) block.innerHTML = markup;
    });
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
      restoring.current = parked.blocks;
      docs.current.forEach((doc, index) => doc && restoreWords(doc, parked.blocks[index]));
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
  }, [urls, crops, chosen, ready]);

  /**
   * Presses on a page's photographs. The first press on a picture chooses its
   * slot; a press on the chosen one drags the photograph within its frame.
   *
   * The pointer's position inside the frame is in the page's own pixels, and
   * so is the photograph's spare width, so the picture follows the finger at
   * any zoom. Moved by style while dragging and committed on release, so a drag
   * is one change, not one per pointer event.
   */
  const listen = useCallback((doc: Document) => {
    doc.addEventListener("pointerdown", event => {
      const image = (event.target as Element | null)?.closest?.("img[data-slot]") as HTMLImageElement | null;
      if (!image) return;
      const slot = image.dataset.slot!;
      if (chosenRef.current !== slot) {
        setChosen(slot);
        return;
      }
      const view = doc.defaultView;
      if (!view || view.getComputedStyle(image).objectFit !== "cover" || !image.naturalWidth) return;
      event.preventDefault();

      const scale = Math.max(image.clientWidth / image.naturalWidth, image.clientHeight / image.naturalHeight);
      const spare = { x: image.naturalWidth * scale - image.clientWidth, y: image.naturalHeight * scale - image.clientHeight };
      const start = readPosition(view.getComputedStyle(image).objectPosition, spare);
      const from = { x: event.clientX, y: event.clientY };
      const key = image.dataset.crop!;
      const twins = docs.current.flatMap(page => (page ? Array.from(page.querySelectorAll<HTMLImageElement>(`img[data-crop="${CSS.escape(key)}"]`)) : []));
      let at = start;

      image.setPointerCapture(event.pointerId);
      const move = (next: PointerEvent) => {
        at = {
          x: spare.x > 1 ? clamp(start.x - ((next.clientX - from.x) / spare.x) * 100) : start.x,
          y: spare.y > 1 ? clamp(start.y - ((next.clientY - from.y) / spare.y) * 100) : start.y,
        };
        for (const twin of twins) twin.style.objectPosition = `${at.x}% ${at.y}%`;
      };
      const end = () => {
        image.removeEventListener("pointermove", move);
        image.removeEventListener("pointerup", end);
        image.removeEventListener("pointercancel", end);
        if (at !== start) setCrops(current => ({ ...current, [key]: at }));
      };
      image.addEventListener("pointermove", move);
      image.addEventListener("pointerup", end);
      image.addEventListener("pointercancel", end);
    });
  }, []);

  const loaded = useCallback(
    (index: number, frame: HTMLIFrameElement) => {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      prepare(doc);
      docs.current[index] = doc;
      words.current[index] = doc.body.textContent ?? "";
      restoreWords(doc, restoring.current?.[index]);
      listen(doc);
      setReady(count => count + 1);
    },
    [listen],
  );

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
    photos.length > 0 || docs.current.some((doc, index) => doc && (doc.body.textContent ?? "") !== words.current[index]);

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
    };
    await putRecord(PARK_KEY, parked);
    await signInWithGoogle(`${window.location.pathname}${window.location.search}`);
    return false;
  };

  /** Everything the reader of a saved link is told about it, drawn from the pages as they now stand. */
  const manifest = () => {
    const texts = docs.current.map(doc => doc?.body.textContent ?? "");
    const opening = docs.current[0] ? editable(docs.current[0]).map(block => block.textContent?.trim() ?? "").find(text => text.length >= 40) : undefined;
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
              They fill the pictures in order. Press a picture on the page to choose it, then drag it to move the photo in its frame. Tap any words to rewrite
              them. Nothing is uploaded unless you save.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-wide text-stone-500 uppercase">Pictures in this layout</h3>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-3">
              {slots.map((slot, index) => (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => setChosen(slot)}
                    aria-pressed={chosen === slot}
                    aria-label={`Picture ${index + 1}${assigned[slot] ? ", your photo" : ", sample"}`}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-md ring-offset-2 transition-shadow",
                      chosen === slot ? "ring-2 ring-blue-600" : "ring-1 ring-stone-200 hover:ring-stone-400",
                    )}
                  >
                    <img src={urls[slot]} alt="" className={cn("size-full object-cover", !assigned[slot] && "opacity-60 grayscale")} />
                    <span className="absolute top-1 left-1 rounded bg-stone-900/80 px-1.5 text-[10px] font-medium text-white tabular-nums">{index + 1}</span>
                  </button>
                </li>
              ))}
            </ul>
            {chosen && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => pick(chosen)}>
                  <Replace className="size-4" />
                  New photo for picture {chosenIndex}
                </Button>
                {Object.keys(crops).some(key => key.startsWith(`${chosen}|`)) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setCrops(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${chosen}|`))))}
                  >
                    <Crosshair className="size-4" />
                    Reset position
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

        <div className="flex min-h-0 flex-1 justify-center p-4 sm:p-8 lg:overflow-y-auto">
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
