import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  FileImage,
  Heading,
  ImagePlus,
  Loader2,
  Minus,
  Pilcrow,
  Plus,
  Redo2,
  Square,
  SquareDashed,
  Trash2,
  Send,
  Undo2,
} from "lucide-react";

import { SubmitLayout } from "@/components/layouts/submit-layout";
import { Sheet } from "@/components/poster/box-view";
import { PosterCanvas } from "@/components/poster/canvas";
import { IssuePreview } from "@/components/poster/issue-preview";
import { Inspector, type Edits, type Layer, type PageAlign } from "@/components/poster/inspector";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuth } from "@/lib/auth";
import { popRecord, putRecord } from "@/lib/draft";
import { canvasToSample, getLayout } from "@/lib/layouts";
import { useHistory } from "@/lib/poster/history";
import {
  blankPage,
  clampBox,
  cloneBox,
  clonePage,
  newId,
  photoBox,
  shapeBox,
  SHEET,
  STARTERS,
  textBox,
  type Box,
  type Photo,
  type PosterDoc,
  type PosterPage,
  type StarterId,
} from "@/lib/poster/model";
import { cn } from "@/lib/utils";

/** Largest the page is drawn on screen: a little over print size reads comfortably on a laptop. */
const MAX_SCALE = 1.15;
const THUMB = 0.16;

/** Reads a picture into memory. Nothing is uploaded: the URL points at the file on this machine. */
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
  return { id: newId("ph"), url, width: image.naturalWidth, height: image.naturalHeight, name: file.name, file };
}

/** A name for the downloaded file, from the first words on the first page that has any. */
function titleOf(doc: PosterDoc): string {
  for (const page of doc.pages) {
    const text = page.boxes.find(box => box.kind === "text" && box.text.trim());
    if (text && text.kind === "text") return `poster ${text.text.split("\n")[0]!.slice(0, 40)}`;
  }
  return "poster";
}

/**
 * The two products built on this studio.
 *
 * The one-page poster is a single sheet and nothing else: no page strip, no
 * way to add a second page, and no starter layouts yet — its own defaults are
 * still to be designed, and borrowing the multi-page ones would set them by
 * accident. Editor in Chief is the whole studio: as many pages as the reader
 * wants, each from scratch or from a starter.
 */
const MODES = {
  poster: {
    kicker: "One page",
    title: "One-page poster",
    intro:
      "One page and every tool beside it: photo boxes, text boxes, shapes, fonts, colours and alignment. Download it as a PDF or a picture. Your photos never leave this tab.",
    pages: false,
    starters: false,
  },
  chief: {
    kicker: "The masthead",
    title: "Editor in Chief",
    intro:
      "A blank page and every tool beside it: photo boxes, text boxes, shapes, fonts, colours and alignment. Build as many pages as you like, from scratch or from a layout, then download a PDF. Your photos never leave this tab.",
    pages: true,
    starters: true,
  },
} as const;

type Mode = keyof typeof MODES;

/** Where the studio is parked across the sign-in redirect, beside the desk's own record. */
const PARKED = "studio";

type Parked = {
  mode: Mode;
  doc: PosterDoc;
  photos: Omit<Photo, "url">[];
  /** Reopen the submit panel on the way back. */
  submit: boolean;
};

function isParked(value: unknown): value is Parked {
  const parked = value as Partial<Parked> | null;
  return Boolean(parked && typeof parked.mode === "string" && Array.isArray(parked.doc?.pages) && Array.isArray(parked.photos));
}

/** The next free spot for a new box, stepped so a second one never lands exactly on the first. */
function spot(count: number) {
  return { x: 60 + (count % 5) * 18, y: 80 + (count % 7) * 22 };
}

export function Poster() {
  return <Studio mode="poster" />;
}

export function EditorInChief() {
  return <Studio mode="chief" />;
}

function Studio({ mode }: { mode: Mode }) {
  const config = MODES[mode];
  const history = useHistory<PosterDoc>(() => ({ pages: [blankPage()] }));
  const doc = history.value;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, Photo>>({});
  const [showGuides, setShowGuides] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "png" | "sample" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const current = Math.min(index, doc.pages.length - 1);
  const page = doc.pages[current]!;
  const box = page.boxes.find(item => item.id === selected) ?? null;

  /* ----------------------------------------------------------- scale */

  // The workspace (sheet, page strip, inspector) is drawn only in the
  // browser. `build.ts` draws this page ahead of time so its heading and
  // tools reach crawlers, but the sheet is sized from the width it is given,
  // which the build cannot know: drawn at full size and shrunk on a phone
  // once the script ran, it would shove everything beneath it. Left out of the
  // build's markup, it arrives inside the card with nothing below to move.
  const hydrated = useHydrated();
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // Measured once before the first paint as well as observed. An observer
  // reports only after a frame has been drawn, and until then the sheet sat at
  // full size: on a phone it was then shrunk under the reader's eyes, the one
  // layout shift Lighthouse found on this page.
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const fit = (width: number) => setScale(Math.min(MAX_SCALE, width / SHEET.width));
    fit(node.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) fit(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // Again once hydrated, when the stage it measures first exists.
  }, [hydrated]);

  /* ---------------------------------------------------------- photos */

  // Object URLs are held until the page goes away: undo can bring back a box
  // whose picture was replaced, and it should come back with the picture.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => Object.values(photosRef.current).forEach(photo => URL.revokeObjectURL(photo.url)), []);

  // Leaving with work on the page loses it, since nothing is saved anywhere.
  const hasWork = doc.pages.some(item => item.boxes.length > 0);
  useEffect(() => {
    if (!hasWork) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasWork]);

  /* ---------------------------------------------------------- edits */

  const onPage = useCallback(
    (change: (page: PosterPage) => PosterPage) => (doc: PosterDoc) => ({
      pages: doc.pages.map((item, at) => (at === current ? change(item) : item)),
    }),
    [current],
  );

  const pageEdits: Edits<PosterPage> = {
    commit: patch => history.commit(onPage(item => ({ ...item, ...patch }))),
    preview: patch => history.preview(onPage(item => ({ ...item, ...patch }))),
    hold: history.checkpoint,
  };

  const patchBox = (patch: Partial<Box>) =>
    onPage(item => ({
      ...item,
      boxes: item.boxes.map(entry => (entry.id === selected ? clampBox({ ...entry, ...patch } as Box) : entry)),
    }));

  const boxEdits: Edits<Box> = {
    commit: patch => history.commit(patchBox(patch)),
    preview: patch => history.preview(patchBox(patch)),
    hold: history.checkpoint,
  };

  const replaceBox = (next: Box) =>
    onPage(item => ({ ...item, boxes: item.boxes.map(entry => (entry.id === next.id ? next : entry)) }));

  const addBox = (next: Box) => {
    history.commit(onPage(item => ({ ...item, boxes: [...item.boxes, next] })));
    setSelected(next.id);
    setEditing(null);
  };

  const add = (kind: "heading" | "body" | "frame" | "rect" | "ellipse" | "line") => {
    const at = spot(page.boxes.length);
    if (kind === "heading") addBox(textBox({ ...at, width: 400, height: 70, text: "A headline", size: 52, leading: 1 }));
    if (kind === "body")
      addBox(
        textBox({
          ...at,
          width: 280,
          height: 120,
          text: "Tell the story here. Double-click to type, and use the panel for the font, size and colour.",
          font: "georgia",
          size: 12,
          leading: 1.55,
        }),
      );
    if (kind === "frame") addBox(photoBox({ ...at, width: 260, height: 320 }));
    if (kind === "rect") addBox(shapeBox({ ...at }));
    if (kind === "ellipse") addBox(shapeBox({ ...at, shape: "ellipse" }));
    if (kind === "line") addBox(shapeBox({ ...at, width: 300, height: 2, fill: "#1b1a17" }));
  };

  /** Brings pictures in: into the frame they were meant for, or as new boxes shaped like the photographs. */
  const addPhotos = async (files: File[], at: { x: number; y: number } | null, target: string | null) => {
    setError(null);
    const loaded: Photo[] = [];
    for (const file of files) {
      try {
        loaded.push(await loadPhoto(file));
      } catch (problem) {
        setError((problem as Error).message);
      }
    }
    if (loaded.length === 0) return;
    setPhotos(current => ({ ...current, ...Object.fromEntries(loaded.map(photo => [photo.id, photo])) }));

    const [first, ...rest] = loaded;
    const fresh: Box[] = [];
    if (target) history.commit(onPage(item => ({ ...item, boxes: item.boxes.map(entry => (entry.id === target ? { ...entry, photo: first!.id } : entry)) })));
    for (const [offset, photo] of (target ? rest : loaded).entries()) {
      const width = 260;
      const height = Math.min(SHEET.height - 40, Math.round((width * photo.height) / photo.width));
      const origin = at ? { x: at.x - width / 2 + offset * 20, y: at.y - height / 2 + offset * 20 } : spot(page.boxes.length + offset);
      fresh.push(clampBox(photoBox({ ...origin, width, height, photo: photo.id })));
    }
    if (fresh.length > 0) {
      history.commit(onPage(item => ({ ...item, boxes: [...item.boxes, ...fresh] })));
      setSelected(fresh[fresh.length - 1]!.id);
    } else if (target) setSelected(target);
  };

  const picker = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string | null>(null);
  const pickPhoto = (target: string | null) => {
    pickFor.current = target;
    picker.current?.click();
  };

  const remove = () => {
    if (!selected) return;
    history.commit(onPage(item => ({ ...item, boxes: item.boxes.filter(entry => entry.id !== selected) })));
    setSelected(null);
    setEditing(null);
  };

  const duplicate = () => {
    if (!box) return;
    const copy = clampBox(cloneBox(box, 16));
    history.commit(onPage(item => ({ ...item, boxes: [...item.boxes, copy] })));
    setSelected(copy.id);
  };

  const layer = (to: Layer) => {
    if (!selected) return;
    history.commit(
      onPage(item => {
        const from = item.boxes.findIndex(entry => entry.id === selected);
        if (from < 0) return item;
        const boxes = [...item.boxes];
        const [moving] = boxes.splice(from, 1);
        const target = to === "front" ? boxes.length : to === "back" ? 0 : to === "forward" ? Math.min(boxes.length, from + 1) : Math.max(0, from - 1);
        boxes.splice(target, 0, moving!);
        return { ...item, boxes };
      }),
    );
  };

  const align = (to: PageAlign) => {
    if (!box) return;
    const place = {
      left: { x: 0 },
      hcenter: { x: (SHEET.width - box.width) / 2 },
      right: { x: SHEET.width - box.width },
      top: { y: 0 },
      vcenter: { y: (SHEET.height - box.height) / 2 },
      bottom: { y: SHEET.height - box.height },
    }[to];
    boxEdits.commit(place);
  };

  /* ----------------------------------------------------------- pages */

  const goTo = (at: number) => {
    setIndex(at);
    setSelected(null);
    setEditing(null);
  };

  const addPage = (starter: StarterId = "blank") => {
    const fresh = STARTERS[starter].build();
    history.commit(doc => ({ pages: [...doc.pages.slice(0, current + 1), fresh, ...doc.pages.slice(current + 1)] }));
    goTo(current + 1);
  };

  const duplicatePage = () => {
    history.commit(doc => ({ pages: [...doc.pages.slice(0, current + 1), clonePage(page), ...doc.pages.slice(current + 1)] }));
    goTo(current + 1);
  };

  const deletePage = () => {
    if (doc.pages.length === 1) {
      history.commit({ pages: [blankPage()] });
      goTo(0);
      return;
    }
    history.commit(doc => ({ pages: doc.pages.filter((_, at) => at !== current) }));
    goTo(Math.max(0, current - 1));
  };

  const movePage = (step: -1 | 1) => {
    const target = current + step;
    if (target < 0 || target >= doc.pages.length) return;
    history.commit(doc => {
      const pages = [...doc.pages];
      [pages[current], pages[target]] = [pages[target]!, pages[current]!];
      return { pages };
    });
    setIndex(target);
  };

  const applyStarter = (id: StarterId) => {
    if (page.boxes.length > 0 && !window.confirm("Replace everything on this page with the layout? Undo brings it back.")) return;
    history.commit(onPage(() => STARTERS[id].build()));
    setSelected(null);
  };

  /* -------------------------------------------------------- keyboard */

  const clipboard = useRef<Box | null>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      // The preview turns its pages with the arrow keys, and an undo taken
      // there would change a page the reader cannot see being changed.
      if (previewing) return;
      if (editing || target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        history.redo();
        return;
      }
      if (mod && key === "d" && box) {
        event.preventDefault();
        duplicate();
        return;
      }
      if (mod && key === "c" && box) {
        clipboard.current = box;
        return;
      }
      if (mod && key === "v" && clipboard.current) {
        event.preventDefault();
        addBox(clampBox(cloneBox(clipboard.current, 16)));
        return;
      }
      if (!box) return;
      if (key === "delete" || key === "backspace") {
        event.preventDefault();
        remove();
      } else if (key === "escape") {
        setSelected(null);
      } else if (key === "enter" && box.kind === "text" && !box.locked) {
        event.preventDefault();
        setEditing(box.id);
      } else if (key.startsWith("arrow") && !box.locked) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        boxEdits.commit({ x: box.x + dx, y: box.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ------------------------------------------- arriving and leaving */

  // Back from signing in (the page was parked, photographs and all), or sent
  // here from the directory with a layout to start from. Once, on arrival.
  const arrived = useRef(false);
  useEffect(() => {
    if (arrived.current) return;
    arrived.current = true;
    const layout = new URLSearchParams(location.search).get("layout");

    void popRecord(PARKED).then(async value => {
      if (isParked(value) && value.mode === mode) {
        const restored = Object.fromEntries(value.photos.map(photo => [photo.id, { ...photo, url: URL.createObjectURL(photo.file) }]));
        setPhotos(restored);
        history.reset(value.doc);
        setIndex(0);
        if (value.submit) setSubmitting(true);
        return;
      }
      if (!layout) return;
      try {
        const found = await getLayout(layout);
        if (found.kind !== "poster" || !("pages" in found.design)) throw new Error("That is a magazine layout; it opens on the desk.");
        const pages = found.design.pages.map(item => clonePage(item as unknown as PosterPage));
        history.reset({ pages: config.pages ? pages : pages.slice(0, 1) });
        setIndex(0);
        setNotice(`Started from “${found.title}”${found.author ? ` by ${found.author}` : ""}. Every box is yours to change.`);
      } catch (problem) {
        setError((problem as Error).message);
      } finally {
        navigate(location.pathname, { replace: true });
      }
    });
    // Once, on arrival: the address and the parked record are read a single time.
  }, []);

  /** Puts the page away with its photographs, signs in, and comes back to the submit panel. */
  const signInToSubmit = async () => {
    const parked: Parked = { mode, doc, photos: Object.values(photos).map(({ url: _url, ...photo }) => photo), submit: true };
    await putRecord(PARKED, parked);
    await signInWithGoogle(location.pathname);
  };

  /* ---------------------------------------------------------- export */

  const sheets = useRef<HTMLDivElement>(null);

  /**
   * The sample a submission carries: this page, drawn with its photographs
   * and words exactly as the press would draw it.
   */
  const makeSample = useCallback(async () => {
    setSelected(null);
    setEditing(null);
    setExporting("sample");
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const holder = sheets.current;
      if (!holder) throw new Error("The page could not be prepared.");
      await Promise.all(Array.from(holder.querySelectorAll("img")).map(image => image.decode().catch(() => undefined)));
      const press = await import("@/lib/magazine/press");
      const canvas = await press.drawLeaf(holder.children[current] as HTMLElement, 2);
      try {
        return canvasToSample(canvas);
      } finally {
        press.releaseCanvas(canvas);
      }
    } finally {
      setExporting(null);
    }
  }, [current]);

  /**
   * Draws the pages with the magazine's own press, so a poster comes out
   * exactly as it looks here — on a phone too, whose print dialog would
   * choose its own paper. The press is a large module and only this button
   * needs it, so it is fetched on the first press rather than with the page.
   */
  const download = async (format: "pdf" | "png") => {
    setError(null);
    setSelected(null);
    setEditing(null);
    setExporting(format);
    try {
      // Let the full-size sheets render and their pictures decode before anything is drawn.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const holder = sheets.current;
      if (!holder) throw new Error("The pages could not be prepared.");
      await Promise.all(Array.from(holder.querySelectorAll("img")).map(image => image.decode().catch(() => undefined)));

      const press = await import("@/lib/magazine/press");
      const leaves = Array.from(holder.children) as HTMLElement[];
      const title = titleOf(doc);
      if (format === "pdf") {
        press.saveIssue(await press.pressPdf(leaves, title), title);
      } else {
        const canvas = await press.drawLeaf(leaves[current]!, 3);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
        press.releaseCanvas(canvas);
        if (!blob) throw new Error("The page was too large to save as a picture.");
        press.saveBlob(blob, `${press.slugOf(title)}-page-${current + 1}.png`);
      }
    } catch (problem) {
      setError((problem as Error).message || "The download could not be made.");
    } finally {
      setExporting(null);
    }
  };

  /* ------------------------------------------------------------ view */

  const tool = "h-9 rounded-full bg-white/80 px-3 text-stone-700 ring-1 ring-stone-200 hover:bg-white hover:text-stone-900";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          {config.kicker}
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">{config.title}</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">{config.intro}</p>
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-5 py-2">
          {/* Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className={tool} onClick={() => add("heading")}>
              <Heading className="size-4" /> Heading
            </Button>
            <Button variant="ghost" size="sm" className={tool} onClick={() => add("body")}>
              <Pilcrow className="size-4" /> Paragraph
            </Button>
            <Button variant="ghost" size="sm" className={tool} onClick={() => pickPhoto(null)}>
              <ImagePlus className="size-4" /> Photo
            </Button>
            <Button variant="ghost" size="sm" className={tool} onClick={() => add("frame")}>
              <SquareDashed className="size-4" /> Frame
            </Button>
            <Button variant="ghost" size="sm" className={tool} aria-label="Rectangle" title="Rectangle" onClick={() => add("rect")}>
              <Square className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className={tool} aria-label="Circle" title="Circle" onClick={() => add("ellipse")}>
              <Circle className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className={tool} aria-label="Line" title="Line" onClick={() => add("line")}>
              <Minus className="size-4" />
            </Button>

            <span className="mx-1 hidden h-6 w-px bg-stone-300 sm:block" />
            <Button variant="ghost" size="sm" className={tool} aria-label="Undo" title="Undo (⌘Z)" disabled={!history.canUndo} onClick={history.undo}>
              <Undo2 className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className={tool} aria-label="Redo" title="Redo (⇧⌘Z)" disabled={!history.canRedo} onClick={history.redo}>
              <Redo2 className="size-4" />
            </Button>

            <div className="ml-auto flex gap-2">
              {config.pages && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={tool}
                  disabled={!hasWork}
                  onClick={() => {
                    setSelected(null);
                    setEditing(null);
                    setPreviewing(true);
                  }}
                  title="Turn through every page as the finished magazine"
                >
                  <BookOpen className="size-4" /> Preview
                </Button>
              )}
              <Button variant="ghost" size="sm" className={tool} disabled={exporting !== null} onClick={() => void download("png")} title="This page as a picture">
                {exporting === "png" ? <Loader2 className="size-4 animate-spin" /> : <FileImage className="size-4" />} PNG
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={tool}
                disabled={!hasWork}
                onClick={() => setSubmitting(true)}
                title="Send this layout to the directory"
              >
                <Send className="size-4" /> Submit layout
              </Button>
              <Button size="sm" className="h-9 rounded-full px-4" disabled={exporting !== null} onClick={() => void download("pdf")}>
                {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Download PDF
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && (
            <p className="text-sm text-emerald-800">
              {notice}{" "}
              <Link to="/layouts?kind=poster" className="underline underline-offset-2">
                More layouts
              </Link>
            </p>
          )}

          {hydrated && (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* The page */}
            <div className="flex min-w-0 flex-1 flex-col items-center gap-10">
              <div ref={stage} className="flex w-full justify-center">
                <PosterCanvas
                  page={page}
                  photos={photos}
                  scale={scale}
                  selected={selected}
                  editing={editing}
                  showGuides={showGuides}
                  onSelect={setSelected}
                  onEdit={setEditing}
                  onCheckpoint={history.checkpoint}
                  onPreview={next => history.preview(replaceBox(next))}
                  onCommitText={(id, text) =>
                    history.commit(
                      onPage(item => ({
                        ...item,
                        boxes: item.boxes.map(entry => (entry.id === id && entry.kind === "text" ? { ...entry, text } : entry)),
                      })),
                    )
                  }
                  onPickPhoto={id => pickPhoto(id)}
                  onDropFiles={(files, at, target) => void addPhotos(files, at, target)}
                />
              </div>

              {page.boxes.length === 0 && !config.starters && (
                <p className="-mt-4 text-center text-sm text-stone-600">An empty page. Add a box from the toolbar, or drop photos on it.</p>
              )}
              {page.boxes.length === 0 && config.starters && (
                <div className="-mt-4 flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-stone-600">An empty page. Add a box from the toolbar, drop photos on it, or start from a layout:</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {(["cover", "poster", "story", "grid"] as StarterId[]).map(id => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => applyStarter(id)}
                        className="rounded-full bg-white px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200 hover:text-stone-900"
                      >
                        {STARTERS[id].name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pages: Editor in Chief only; the poster is one sheet by definition. */}
              {config.pages && (
                <div className="flex w-full flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium tracking-[0.2em] text-stone-500 uppercase">
                      Page {current + 1} of {doc.pages.length}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label="Move page earlier" title="Move page earlier" disabled={current === 0} onClick={() => movePage(-1)}>
                        <ChevronLeft className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Move page later" title="Move page later" disabled={current === doc.pages.length - 1} onClick={() => movePage(1)}>
                        <ChevronRight className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Duplicate page" title="Duplicate page" onClick={duplicatePage}>
                        <Copy className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete page" title="Delete page" className="text-red-600 hover:bg-red-50" onClick={deletePage}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {doc.pages.map((item, at) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => goTo(at)}
                        aria-label={`Page ${at + 1}`}
                        aria-current={at === current ? "page" : undefined}
                        className={cn(
                          "relative shrink-0 overflow-hidden rounded-sm ring-2 transition-shadow",
                          at === current ? "ring-emerald-600" : "ring-stone-200 hover:ring-stone-400",
                      )}
                      style={{ width: SHEET.width * THUMB, height: SHEET.height * THUMB }}
                    >
                      <div className="pointer-events-none origin-top-left" style={{ transform: `scale(${THUMB})` }}>
                        <Sheet page={item} photos={photos} />
                      </div>
                      <span className="absolute right-1 bottom-1 rounded bg-stone-900/70 px-1 text-[10px] text-white">{at + 1}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addPage()}
                    className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-stone-300 text-xs text-stone-500 hover:border-stone-400 hover:text-stone-700"
                    style={{ width: SHEET.width * THUMB, height: SHEET.height * THUMB }}
                  >
                    <Plus className="size-4" />
                    Add page
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* The options */}
            <aside className="w-full shrink-0 rounded-2xl bg-stone-50/90 p-4 ring-1 ring-stone-200 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:w-80 lg:overflow-y-auto">
              <Inspector
                page={page}
                box={box}
                pageEdits={pageEdits}
                boxEdits={boxEdits}
                showGuides={showGuides}
                onGuides={setShowGuides}
                onStarter={config.starters ? applyStarter : undefined}
                onPickPhoto={() => pickPhoto(selected)}
                onLayer={layer}
                onAlign={align}
                onDuplicate={duplicate}
                onRemove={remove}
              />
            </aside>
          </div>
          )}
        </CardContent>
      </Card>

      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void addPhotos(files, null, pickFor.current);
        }}
      />

      {previewing && (
        <IssuePreview
          doc={doc}
          photos={photos}
          exporting={exporting === "pdf"}
          onDownload={() => void download("pdf")}
          onClose={() => setPreviewing(false)}
        />
      )}

      {submitting && (
        <SubmitLayout
          kind="poster"
          design={{ pages: config.pages ? doc.pages : [page] }}
          makeSample={makeSample}
          onSignIn={() => void signInToSubmit()}
          onClose={() => setSubmitting(false)}
        />
      )}

      {/* Full-size pages for the press, laid out only while a download or a sample is being made. */}
      {exporting && (
        <div ref={sheets} aria-hidden style={{ position: "fixed", top: 0, left: -10000, width: SHEET.width, pointerEvents: "none" }}>
          {doc.pages.map(item => (
            <Sheet key={item.id} page={item} photos={photos} />
          ))}
        </div>
      )}
    </div>
  );
}
