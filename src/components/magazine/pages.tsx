import { createContext, use, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronsUpDown, GripVertical, Move, Wand2 } from "lucide-react";

import { COPY_CLASS, paragraphsHtml, type Cursor, type Slice } from "@/lib/magazine/copy";
import {
  CAPTION,
  COLUMN_WIDTH,
  GUTTER,
  MARGIN,
  PAGE,
  TEXT_HEIGHT,
  TEXT_WIDTH,
} from "@/lib/magazine/geometry";
import {
  BAND_ABOVE,
  besideColumn,
  besideFoot,
  clampPlate,
  BAND_HEAD,
  COLUMN_QUARTER,
  CENTRED_HEAD,
  CENTRED_WIDTH,
  ORNAMENT,
  ORNAMENT_HEAD,
  OPENER_HEAD,
  plateAxes,
  STACK_GAP,
  ZINE_NARROW,
  ZINE_PLATES,
  ZINE_ROW,
  ZINE_TEXT_LEFT,
  ZINE_WIDE,
  type Axis,
  type PlateBox,
  type TemplateId,
} from "@/lib/magazine/templates";
import { DEFAULT_THEME, THEMES, type Surface, type ThemeId } from "@/lib/magazine/themes";
import {
  clampBox,
  plateBoxes,
  quoteBoxes,
  sketchBoxes,
  textBoxes,
  type CustomBox,
  type CustomSlot,
  type Palette,
  type QuoteTone,
} from "@/lib/magazine/custom";
import { surfaceOf, type TypeChoice } from "@/lib/magazine/typography";
import type { Page, Plate } from "@/lib/magazine/types";
import { CENTRED, type Focus, type Photo } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Everything the reader can do to a plate, supplied by whoever is showing the
 * issue.
 *
 * One context rather than three: a plate sits three or four components down
 * inside a layout, and eleven layouts would otherwise each have to pass the
 * lot through untouched. Each ability is optional and its affordance appears
 * only when it is given, which is how the printed sheet stays inert — it
 * renders the same pages with no provider at all.
 *
 * `scale` is here because every one of these is a drag, and pages are drawn at
 * print size then scaled down to fit the viewport: a pixel of pointer travel is
 * more than a pixel on the page.
 */
type PlateEdit = {
  scale: number;
  /** Exchanges the photographs on two plates. */
  onSwap?: (from: string, to: string) => void;
  /** Sets one axis of one page's plate. */
  onResize?: (index: number, axis: Axis, value: number) => void;
  /**
   * Places a photograph inside its frame, or hands the placing back to the
   * plate with null.
   */
  onPan?: (photoId: string, focus: Focus | null) => void;
  /**
   * Moves or resizes one box on one of the reader's own pages.
   *
   * Changes that page alone, addressed by its index: the shared design is
   * edited in the layout designer, and a reader dragging a box on the fifth
   * left-hand page means the fifth, not every left-hand page in the issue.
   */
  onEditBox?: (index: number, slot: CustomSlot, box: CustomBox) => void;
  /**
   * Replaces the run of story a box is showing with what was typed into it.
   *
   * Addressed by the two cursors the slice was cut with rather than by the
   * box, because the box is not where the words live — the story is, and it is
   * the story that has to change for the edit to survive the next setting.
   */
  onEditCopy?: (from: Cursor, to: Cursor, text: string) => void;
  /**
   * Records a drawing, against the id of the surface it was made on.
   *
   * Keyed rather than single, because a reader may put several drawing boxes
   * on one of their own pages and each has to keep its own marks.
   */
  onSketch?: (id: string, dataUrl: string) => void;
};

const PlateEditContext = createContext<PlateEdit | null>(null);

export function PlateEditProvider({
  children,
  ...edit
}: PlateEdit & { children: ReactNode }) {
  const { scale, onSwap, onResize, onPan, onEditBox, onEditCopy, onSketch } = edit;
  // The viewer re-renders on every resize; a fresh object here would drag
  // every plate on the spread through a re-render with it.
  const value = useMemo(
    () => ({ scale, onSwap, onResize, onPan, onEditBox, onEditCopy, onSketch }),
    [scale, onSwap, onResize, onPan, onEditBox, onEditCopy, onSketch],
  );
  return <PlateEditContext value={value}>{children}</PlateEditContext>;
}

/** Our own type, so a photograph dragged in from the desktop is ignored. */
const PLATE_MIME = "application/x-atlas-plate";

/**
 * Swapping: a grip to pick the plate up by, and a target to drop another on.
 *
 * The grip is deliberately separate from the picture. The picture itself is
 * how the photograph is moved *within* its frame, and one press cannot mean
 * both "take this plate somewhere else" and "shift what it shows".
 */
function usePlateHandle(photoId: string | undefined) {
  const edit = use(PlateEditContext);
  const [over, setOver] = useState(false);

  if (!edit?.onSwap || !photoId) return { swappable: false, over: false, grip: {}, target: {} };
  const { onSwap } = edit;

  return {
    swappable: true,
    over,
    grip: {
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.setData(PLATE_MIME, photoId);
        event.dataTransfer.effectAllowed = "move";
      },
      onDragEnd: () => setOver(false),
    },
    target: {
      onDragOver: (event: DragEvent) => {
        if (!event.dataTransfer.types.includes(PLATE_MIME)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        const from = event.dataTransfer.getData(PLATE_MIME);
        if (from && from !== photoId) onSwap(from, photoId);
      },
    },
  };
}

/** How a plate reads while one is held over it. */
const OVER = "outline-2 outline-offset-2 outline-emerald-500";

/**
 * Layouts whose plate hangs from the foot of its cell rather than the head.
 *
 * The grip has to be on the edge that actually moves, or the plate grows away
 * from the direction it is being pulled.
 */
const FOOT_ANCHORED = new Set<TemplateId>(["plate-below"]);

/**
 * The paper and ink of the issue being drawn.
 *
 * A theme is mostly a running order of layouts, but one of them is a zine, and
 * a zine is not a grid decision — it is cream paper, raspberry ink and
 * photographs printed as snapshots. Those reach the layouts through here
 * rather than as a prop, because a plate sits several components down and
 * every layout would otherwise have to pass the surface through untouched.
 *
 * Defaulted, so the printed sheet and any caller that knows nothing about
 * themes still draws the house style.
 */
const SurfaceContext = createContext<Surface>(THEMES[DEFAULT_THEME].surface);

/** The badge a plate is picked up by, shown once the plate is hovered. */
function SwapGrip({ grip }: { grip: Record<string, unknown> }) {
  return (
    <span
      {...grip}
      title="Drag onto another photograph to swap the two"
      aria-label="Drag onto another photograph to swap the two"
      className="absolute top-1 left-1 z-20 flex cursor-grab items-center gap-0.5 rounded-full bg-stone-900/60 px-1 py-0.5 text-[7px] tracking-[0.14em] text-white uppercase opacity-0 transition-opacity group-hover/plate:opacity-100 active:cursor-grabbing"
    >
      <GripVertical className="size-2.5" aria-hidden />
      Swap
    </span>
  );
}

/**
 * How a photograph sits inside its frame, and the switch between the two ways
 * of deciding that.
 *
 * A plate is a window on a picture that is nearly always a different shape.
 * On **auto** the plate decides: the picture fills the frame and the middle is
 * kept, which is the original behaviour and right most of the time. On
 * **manual** the person who took it decides, by dragging the picture behind
 * the window — because when auto is wrong, only they know which part matters.
 *
 * Auto is not a position that happens to be centred: it is the absence of one.
 * Switching back to auto forgets where the picture had been put rather than
 * leaving a stale placement behind the scenes.
 *
 * Only the axis that actually overflows can move; a picture that exactly fits
 * its frame has nothing to shift and does not pretend otherwise. How far a
 * drag travels depends on how much of the picture is hidden, measured off the
 * loaded image rather than assumed.
 */
function usePhotoPan(photo: Photo | undefined) {
  const edit = use(PlateEditContext);
  const [live, setLive] = useState<Focus | null>(null);
  const latest = useRef<Focus | null>(null);

  const manual = photo?.focus !== undefined;
  const focus = live ?? photo?.focus ?? CENTRED;

  if (!edit?.onPan || !photo) return { focus, manual, pannable: false, handlers: {}, placement: null };
  const { onPan, scale } = edit;

  const onPointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (!manual) return;

    const image = event.currentTarget;
    const { naturalWidth, naturalHeight } = image;
    if (!naturalWidth || !naturalHeight) return;

    // The frame in page pixels, and the picture as `cover` actually draws it.
    const frame = image.getBoundingClientRect();
    const width = frame.width / (scale || 1);
    const height = frame.height / (scale || 1);
    const drawn = Math.max(width / naturalWidth, height / naturalHeight);
    const hiddenX = naturalWidth * drawn - width;
    const hiddenY = naturalHeight * drawn - height;
    if (hiddenX < 1 && hiddenY < 1) return;

    event.preventDefault();
    event.stopPropagation();
    image.setPointerCapture(event.pointerId);

    const fromX = event.clientX;
    const fromY = event.clientY;
    const start = photo.focus ?? CENTRED;

    const move = (moved: globalThis.PointerEvent) => {
      // Dragging the picture right should bring its left-hand side into view,
      // which is a *lower* object-position — hence the subtraction.
      const next: Focus = {
        x: hiddenX < 1 ? start.x : hold(start.x - ((moved.clientX - fromX) / (scale || 1) / hiddenX) * 100),
        y: hiddenY < 1 ? start.y : hold(start.y - ((moved.clientY - fromY) / (scale || 1) / hiddenY) * 100),
      };
      latest.current = next;
      setLive(next);
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);

      const settled = latest.current;
      latest.current = null;
      setLive(null);
      if (settled) onPan(photo.id, settled);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const placement = (
    <button
      type="button"
      // The badge sits on top of the picture, which is itself a drag surface.
      onPointerDown={event => event.stopPropagation()}
      onClick={() => onPan(photo.id, manual ? null : CENTRED)}
      title={manual ? "Let the plate place this picture again" : "Place this picture yourself"}
      className={cn(
        "absolute top-1 right-1 z-20 flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[7px] tracking-[0.14em] uppercase opacity-0 transition-opacity group-hover/plate:opacity-100",
        manual ? "bg-emerald-600 text-white" : "bg-stone-900/60 text-white",
      )}
    >
      {manual ? <Move className="size-2.5" aria-hidden /> : <Wand2 className="size-2.5" aria-hidden />}
      {manual ? "Move" : "Auto"}
    </button>
  );

  return {
    focus,
    manual,
    pannable: manual,
    placement,
    handlers: {
      onPointerDown,
      // Otherwise the browser's own image dragging starts instead of a pan.
      draggable: false,
      onDragStart: (event: DragEvent) => event.preventDefault(),
    },
  };
}

const hold = (value: number) => Math.min(100, Math.max(0, value));

/** `object-position` for a focal point. */
const focusStyle = (focus: Focus) => ({ objectPosition: `${focus.x}% ${focus.y}%` });

/**
 * The size to draw a page's plate at, and the grips that change it.
 *
 * While a drag is running the plate is redrawn at the new size but the copy is
 * not re-fitted — it is the slice measured for the old one, so it clips or
 * leaves a gap as the boundary moves. Re-fitting on every frame would mean
 * measuring real type sixty times a second; the issue is set again once, on
 * release.
 */
function usePlateSize(page: Page): { size: PlateBox; grips: ReactNode } {
  const edit = use(PlateEditContext);
  const [live, setLive] = useState<Partial<PlateBox> | null>(null);
  // The drag's own copy of the size. Reading it back out of state on pointer
  // up would read whatever React had committed, not the last move.
  const latest = useRef<{ axis: Axis; value: number } | null>(null);

  const axes = plateAxes(page.template);
  const enabled = Boolean(edit?.onResize) && axes.length > 0;
  const size: PlateBox = { ...page.plate, ...(enabled && live ? live : null) };

  if (!enabled || !edit?.onResize) return { size, grips: null };
  const { onResize, scale } = edit;

  /**
   * Which way a boundary has to travel to give the plate more room.
   *
   * Two layouts are built the other way round — `plate-below` sits at the foot
   * of the page and `plate-beside-right` against the outer edge — so on those
   * the plate grows towards the reader's start rather than away from it. Only
   * the mirrored axis flips: a beside plate is always anchored to the top of
   * the leaf, so its depth always grows downwards.
   */
  const towards = (axis: Axis): number => {
    if (axis === "width") return page.template === "plate-beside-right" ? -1 : 1;
    return FOOT_ANCHORED.has(page.template) ? -1 : 1;
  };

  const grip = (axis: Axis) => {
    const sideways = axis === "width";
    const direction = towards(axis);

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      const from = sideways ? event.clientX : event.clientY;
      const startSize = page.plate[axis];
      handle.setPointerCapture(event.pointerId);

      const move = (moved: globalThis.PointerEvent) => {
        const travelled = (sideways ? moved.clientX : moved.clientY) - from;
        const value = clampPlate(page.template, axis, startSize + (travelled / (scale || 1)) * direction);
        latest.current = { axis, value };
        setLive({ [axis]: value });
      };

      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);

        const settled = latest.current;
        latest.current = null;
        setLive(null);
        if (settled && settled.value !== page.plate[axis]) onResize(page.index, settled.axis, settled.value);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    const dragging = live?.[axis] !== undefined;

    return (
      <div
        key={axis}
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation={sideways ? "vertical" : "horizontal"}
        aria-label={sideways ? "Drag to set how wide this plate is" : "Drag to set how deep this plate is"}
        title={sideways ? "Drag sideways to set the width" : "Drag up or down to set the depth"}
        className={cn(
          "absolute z-20 flex items-center justify-center",
          sideways ? "inset-y-0 w-6 cursor-ew-resize" : "inset-x-0 h-6 cursor-ns-resize",
        )}
        style={
          sideways
            ? direction === 1
              ? { right: -12 }
              : { left: -12 }
            : direction === 1
              ? { bottom: -12 }
              : { top: -12 }
        }
      >
        <span
          className={cn(
            "pointer-events-none flex items-center gap-1 rounded-full text-[7px] tracking-[0.14em] uppercase shadow-sm transition-colors",
            sideways ? "flex-col px-[2px] py-1.5" : "px-1.5 py-[2px]",
            dragging
              ? "bg-emerald-600 text-white"
              : "bg-stone-300 text-stone-600 group-hover/plate:bg-emerald-600 group-hover/plate:text-white",
          )}
        >
          <ChevronsUpDown className={cn("size-2.5", sideways && "rotate-90")} aria-hidden />
          {dragging ? (
            <span className={cn("tabular-nums", sideways && "[writing-mode:vertical-rl]")}>
              {Math.round(size[axis])}
            </span>
          ) : (
            <span className={cn("hidden group-hover/plate:inline", sideways && "[writing-mode:vertical-rl]")}>
              {sideways ? "Width" : "Depth"}
            </span>
          )}
        </span>
      </div>
    );
  };

  /**
   * One grip per axis the layout leaves free. The grips have to be visible
   * before they are hovered, or there is nothing to aim at: each sits quietly
   * on its boundary at all times, names itself when the plate is hovered, and
   * reads out its measurement while it is being pulled.
   */
  return { size, grips: axes.map(grip) };
}

/**
 * The printed page. Every layout here draws from the same constants the fitter
 * measured against, so what was measured is what appears.
 */

/** A box of body copy, clipped to the height it was fitted to. */
function Copy({
  slice,
  height,
  width = COLUMN_WIDTH,
  dropCap,
}: {
  slice: Slice | undefined;
  height: number;
  /** Only the beside layouts set this: their column takes what the plate leaves. */
  width?: number;
  dropCap?: boolean;
}) {
  // The very same overrides the fitter measured this slice against. Taken from
  // the surface rather than passed down, so no layout can forget to hand them
  // on and quietly set a column in the wrong face.
  const { copy, punctuation } = use(SurfaceContext);
  const edit = use(PlateEditContext);

  if (!slice) return null;

  const { from, to } = slice;
  const writable = Boolean(edit?.onEditCopy && from && to);

  return (
    <div
      className={cn(COPY_CLASS, "flow-root overflow-hidden", writable && "outline-offset-2 focus:outline-2 focus:outline-emerald-600")}
      style={{ width, height, ...copy }}
      // Typed into in place. React owns this subtree until the moment it does
      // not, which is why nothing else on the page changes while a box has the
      // caret: the issue is set again on blur, not on every keystroke.
      contentEditable={writable || undefined}
      suppressContentEditableWarning={writable}
      role={writable ? "textbox" : undefined}
      aria-label={writable ? "The words on this part of the page" : undefined}
      title={writable ? "Click to edit these words" : undefined}
      onBlur={
        writable
          ? event => {
              // Read paragraph by paragraph. `innerText` alone separates them
              // with a single newline, which the story parser reads as one
              // paragraph — every edit would quietly weld them together.
              const blocks = [...event.currentTarget.querySelectorAll("p")].map(node => node.innerText);
              const text = (blocks.length > 0 ? blocks : [event.currentTarget.innerText]).join("\n\n");
              edit!.onEditCopy!(from!, to!, text);
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: paragraphsHtml(slice, { dropCap, punctuation }) }}
    />
  );
}

/** The two-column text row shared by most layouts. */
function Columns({ page, height, from = 0 }: { page: Page; height: number; from?: number }) {
  return (
    <div className="flex" style={{ gap: GUTTER }}>
      <Copy slice={page.slices[from]} height={height} dropCap={page.dropCap} />
      <Copy slice={page.slices[from + 1]} height={height} />
    </div>
  );
}

/**
 * Copy set in four narrow measures.
 *
 * Only the modernist page takes this, and it is the whole of its character:
 * at roughly twenty characters a line the page stops reading as columns of
 * text and starts reading as texture, which is what the enormous headline
 * above it needs underneath it.
 */
function Quad({ page, height }: { page: Page; height: number }) {
  return (
    <div className="flex" style={{ gap: GUTTER }}>
      {[0, 1, 2, 3].map(n => (
        <Copy key={n} slice={page.slices[n]} width={COLUMN_QUARTER} height={height} />
      ))}
    </div>
  );
}

// Inked from the leaf rather than fixed, so a caption under a plate on a
// reversed page is legible instead of dark grey on near-black.
const CAPTION_CLASS =
  "truncate text-[7px] tracking-[0.14em] uppercase text-[color:var(--ink,var(--color-stone-400))] opacity-55";

/**
 * A photograph with its plate number set beneath it.
 *
 * Three separate gestures live on this one small object, so each has its own
 * surface: the picture is dragged to move it inside the frame, the badge in
 * the corner is dragged to swap the plate with another, and the grips on the
 * edges are pulled to resize it. Nothing is hidden behind a modifier key.
 */
function PlateFigure({ plate, width, height }: { plate: Plate | undefined; width: number; height: number }) {
  const handle = usePlateHandle(plate?.photo.id);
  const pan = usePhotoPan(plate?.photo);

  const surface = use(SurfaceContext);

  if (!plate) return <div style={{ width, height }} />;
  return (
    <figure className="flex flex-col" style={{ width, height }}>
      {/*
        A snapshot surface prints the picture inside a white border, the way a
        photograph pasted into a zine still carries the edge of the print. The
        border is inside the plate, so nothing the fitter measured moves.
      */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[2px]",
          surface.snapshots && "bg-white p-[5px] shadow-[0_1px_3px_rgba(0,0,0,0.18)]",
        )}
        style={{ height: height - CAPTION }}
        {...handle.target}
      >
        <img
          src={plate.photo.url}
          alt={plate.label}
          {...pan.handlers}
          style={focusStyle(pan.focus)}
          className={cn("size-full bg-stone-200 object-cover", pan.pannable && "cursor-move", handle.over && OVER)}
        />
        {handle.swappable && <SwapGrip grip={handle.grip} />}
        {pan.placement}
      </div>
      <figcaption className={cn(CAPTION_CLASS, "pt-[5px]")} style={{ height: CAPTION }}>
        {plate.label}
        {/* The editor's line, set lighter and in sentence case after the
            number so the two read as a credit and a caption, not one shout. */}
        {plate.caption && (
          <span className="ml-1.5 font-serif text-[8px] tracking-normal normal-case italic">{plate.caption}</span>
        )}
      </figcaption>
    </figure>
  );
}

// The accent is a CSS variable so one declaration on the leaf re-inks every
// kicker on it, whatever layout drew them.
const KICKER =
  "text-[8px] font-medium tracking-[0.28em] uppercase text-[color:var(--ink-accent,var(--color-stone-400))]";
// Both are CSS variables declared on the leaf, so one theme declaration
// re-sets every headline the layouts draw without any of them knowing.
const HEADLINE =
  "[font-family:var(--display-font,var(--font-editorial))] [font-weight:var(--display-weight,400)] [letter-spacing:var(--display-tracking,normal)] text-[color:var(--ink,var(--color-stone-900))]";

function Cover({ page, title, dateline }: { page: Page; title: string; dateline: string }) {
  const plate = page.plates[0];
  const handle = usePlateHandle(plate?.photo.id);
  const pan = usePhotoPan(plate?.photo);
  return (
    <div className="relative size-full overflow-hidden bg-stone-900">
      {plate && (
        <div className="group/plate absolute inset-0" {...handle.target}>
          <img
            src={plate.photo.url}
            alt={plate.label}
            {...pan.handlers}
            style={focusStyle(pan.focus)}
            className={cn(
              "size-full object-cover",
              pan.pannable && "cursor-move",
              handle.over && "outline-2 -outline-offset-4 outline-emerald-500",
            )}
          />
          {handle.swappable && <SwapGrip grip={handle.grip} />}
          {pan.placement}
        </div>
      )}
      {/* Keeps the masthead legible whatever the photograph is doing. */}
      <div className="absolute inset-0 bg-linear-to-b from-black/55 via-black/10 to-black/70" />
      <div className="absolute inset-0 flex flex-col justify-between" style={{ padding: MARGIN }}>
        <div className="flex items-baseline justify-between text-white/85">
          <span className="[font-family:var(--display-font)] text-[22px] leading-none">Atlas</span>
          <span className="text-[8px] tracking-[0.28em] uppercase">{dateline}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[8px] font-medium tracking-[0.28em] text-white/70 uppercase">The issue</span>
          <h1 className="[font-family:var(--display-font)] text-[40px] leading-[1.02] text-balance text-white">{title}</h1>
        </div>
      </div>
    </div>
  );
}

function Contents({ page, title, dateline }: PageProps) {
  return (
    <div className="flex h-full flex-col">
      <span className={cn(HEADLINE, "text-[30px] leading-none")}>Atlas</span>
      <p className="mt-2 text-[8px] tracking-[0.28em] text-stone-400 uppercase">{dateline}</p>
      <div className="mt-5 h-px bg-stone-300" style={{ width: COLUMN_WIDTH }} />

      {/* Set well below the opener's headline: this page faces it, and two
          headlines of the same size on one spread read as a mistake. */}
      <span className={cn(KICKER, "mt-6")}>In this issue</span>
      <h2 className={cn(HEADLINE, "mt-2 text-[17px] leading-[1.2] text-balance")} style={{ width: COLUMN_WIDTH * 1.3 }}>
        {title}
      </h2>

      {(page.entries?.length ?? 0) > 0 && (
        <div className="mt-auto flex flex-col gap-1" style={{ width: COLUMN_WIDTH }}>
          <span className={cn(KICKER, "mb-1")}>Plates</span>
          {page.entries!.map(entry => (
            <span key={`${entry.label}-${entry.folio}`} className="flex items-baseline gap-2 text-[9px] text-stone-500">
              {entry.label}
              <span aria-hidden className="min-w-4 grow border-b border-dotted border-stone-300" />
              <span className="tabular-nums">{entry.folio}</span>
            </span>
          ))}
        </div>
      )}

      <p className="mt-6 text-[8px] tracking-[0.14em] text-stone-400 uppercase">
        Words and pictures — you · Set with Atlas
      </p>
    </div>
  );
}

function Opener({ page, title }: { page: Page; title: string }) {
  const { size, grips } = usePlateSize(page);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      {/* Fixed height, so the columns below start where the fitter expects.
          The headline is clamped for the same reason: a long title would
          otherwise push the copy off the page. */}
      <div className="flex flex-col justify-end" style={{ height: OPENER_HEAD }}>
        <span className={KICKER}>Feature</span>
        <h2 className={cn(HEADLINE, "mt-2 line-clamp-2 text-[34px] leading-[1.04] text-balance")}>{title}</h2>
        <p className="mt-2 text-[9px] text-stone-400 italic">Words and pictures — you</p>
      </div>
      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>
      <Columns page={page} height={TEXT_HEIGHT - OPENER_HEAD - size.height - STACK_GAP * 2} />
    </div>
  );
}

function PlateAbove({ page }: { page: Page }) {
  const { size, grips } = usePlateSize(page);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>
      <Columns page={page} height={TEXT_HEIGHT - size.height - STACK_GAP} />
    </div>
  );
}

function PlateBelow({ page }: { page: Page }) {
  const { size, grips } = usePlateSize(page);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <Columns page={page} height={TEXT_HEIGHT - size.height - STACK_GAP} />
      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>
    </div>
  );
}

/**
 * A plate against one edge with copy beside it, and — once the plate is pulled
 * short enough to leave room — two columns running underneath.
 *
 * The foot appears and disappears at the same threshold the fitter uses, so
 * the boxes measured and the boxes drawn are always the same set.
 */
function Beside({ page, side }: { page: Page; side: "left" | "right" }) {
  const { size, grips } = usePlateSize(page);
  const column = besideColumn(size.width);
  const foot = besideFoot(size.height);

  // The same order the fitter filled them in: the column alongside the plate,
  // then the pair beneath. With no column beside it, the foot starts at nought.
  const footFrom = column > 0 ? 1 : 0;

  const plate = (
    <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
      <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
      {grips}
    </div>
  );
  const beside = column > 0 ? <Copy slice={page.slices[0]} width={column} height={size.height} /> : null;

  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <div className="flex shrink-0" style={{ gap: GUTTER, height: size.height }}>
        {side === "left" ? plate : beside}
        {side === "left" ? beside : plate}
      </div>
      {foot > 0 && <Columns page={page} height={foot} from={footFrom} />}
    </div>
  );
}

function PlateBeside({ page }: { page: Page }) {
  return <Beside page={page} side="left" />;
}

/** The mirror of `PlateBeside`: copy first, photograph against the outer edge. */
function PlateBesideRight({ page }: { page: Page }) {
  return <Beside page={page} side="right" />;
}

/** A wide, shallow plate with copy running above and below it. */
function PlateBand({ page }: { page: Page }) {
  const { size, grips } = usePlateSize(page);
  const below = TEXT_HEIGHT - BAND_ABOVE - size.height - STACK_GAP * 2;
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <Columns page={page} height={BAND_ABOVE} />
      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>
      <Columns page={page} height={below} from={2} />
    </div>
  );
}

/**
 * Three bands down the leaf, each a narrow column of text against a wide
 * photograph, the two changing places row by row.
 *
 * Each photograph leans a little, and alternately — one way, the other, back
 * again — because three prints pasted at the same angle read as a mistake in
 * the printing rather than as a hand. How far they lean is the reader's, set
 * from the desk.
 *
 * The lean is on a wrapper, not on the plate: rotating the plate would rotate
 * its drag surfaces with it, and a picture that pans along a tilted axis is
 * not what anyone means by dragging it sideways. It also means the boxes the
 * fitter measured are untouched, so the slider never re-sets the type.
 */
function ZineRows({ page }: { page: Page }) {
  const { tilt = 0 } = use(SurfaceContext);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      {ZINE_TEXT_LEFT.map((textLeft, row) => {
        const copy = <Copy slice={page.slices[row]} width={ZINE_NARROW} height={ZINE_ROW} />;
        const plate = (
          <div
            className="group/plate shrink-0"
            style={{
              width: ZINE_WIDE,
              height: ZINE_ROW,
              rotate: `${row % 2 === 0 ? tilt : -tilt}deg`,
            }}
          >
            <PlateFigure plate={page.plates[row]} width={ZINE_WIDE} height={ZINE_ROW} />
          </div>
        );
        return (
          <div key={row} className="flex shrink-0" style={{ gap: GUTTER, height: ZINE_ROW }}>
            {textLeft ? copy : plate}
            {textLeft ? plate : copy}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The zine page: a column of copy, and two photographs pinned up beside it at
 * angles, overlapping.
 *
 * Nothing here is on the grid, which is the point — a zine is pasted up, not
 * set. The plates are placed absolutely from `ZINE_PLATES` and tilted, and
 * because they are lifted out of the flow they cannot push the copy around:
 * the column beside them is an ordinary measured box, so the story still fits
 * exactly as the fitter said it would.
 *
 * The tilt is on a wrapper rather than on the plate itself. Rotating the plate
 * would rotate the drag surfaces with it, and a picture that pans along a
 * tilted axis is not what anyone means by dragging it up.
 */
function ZineCollage({ page }: { page: Page }) {
  const { tilt = 0 } = use(SurfaceContext);
  return (
    <div className="flex h-full" style={{ gap: GUTTER }}>
      <Copy slice={page.slices[0]} width={COLUMN_WIDTH} height={TEXT_HEIGHT} dropCap={page.dropCap} />
      <div className="relative shrink-0" style={{ width: COLUMN_WIDTH, height: TEXT_HEIGHT }}>
        {ZINE_PLATES.map((spot, n) => (
          <div
            key={n}
            className="group/plate absolute"
            style={{
              top: spot.top,
              left: spot.left,
              width: spot.width,
              height: spot.height,
              // The theme's angles, scaled by whatever the reader has set. At
              // nought they lie flat and the page becomes a plain paste-up.
              rotate: `${(spot.tilt / 3.2) * tilt}deg`,
              // The second print is pasted over the first.
              zIndex: n + 1,
            }}
          >
            <PlateFigure plate={page.plates[n]} width={spot.width} height={spot.height} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Which of the reader's three pages a leaf was drawn from. */
const SLOT_OF: Partial<Record<TemplateId, CustomSlot>> = {
  "custom-left": "left",
  "custom-right": "right",
  "custom-special": "special",
};

/**
 * One box on a drawn page, with the handles that move and size it in place.
 *
 * A component rather than a hook called in a loop, because each box keeps its
 * own live position while it is being dragged: the box is redrawn at the new
 * size on every frame, and the issue is set again once, on release. Re-fitting
 * type sixty times a second is the thing this exists to avoid.
 *
 * The handles are deliberately small and cornered rather than the whole box
 * being a drag surface. A plate already answers to three gestures — swap it,
 * place the picture inside it, size it — and a text box has to stay
 * selectable, so neither can afford to have its middle claimed as well.
 */
function DrawnBox({
  index,
  slot,
  box,
  children,
}: {
  /** The page this box is on, so an edit lands on that page alone. */
  index: number;
  slot: CustomSlot | undefined;
  box: CustomBox;
  children: (drawn: CustomBox) => ReactNode;
}) {
  const edit = use(PlateEditContext);
  const [live, setLive] = useState<CustomBox | null>(null);
  const latest = useRef<CustomBox | null>(null);

  const drawn = live ?? box;
  const place = {
    position: "absolute" as const,
    left: drawn.x,
    top: drawn.y,
    width: drawn.width,
    height: drawn.height,
  };

  if (!edit?.onEditBox || !slot) {
    return <div style={place}>{children(drawn)}</div>;
  }
  const { onEditBox, scale } = edit;

  const grab = (mode: "move" | "size") => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const fromX = event.clientX;
    const fromY = event.clientY;
    const start = box;
    event.currentTarget.setPointerCapture(event.pointerId);

    // Pages are drawn at print size and scaled to fit, so a pixel of pointer
    // travel is more than a pixel on the leaf.
    const moved = (event_: globalThis.PointerEvent) => {
      const dx = (event_.clientX - fromX) / (scale || 1);
      const dy = (event_.clientY - fromY) / (scale || 1);
      const next = clampBox(
        mode === "move"
          ? { ...start, x: start.x + dx, y: start.y + dy }
          : { ...start, width: start.width + dx, height: start.height + dy },
      );
      latest.current = next;
      setLive(next);
    };

    const up = () => {
      window.removeEventListener("pointermove", moved);
      window.removeEventListener("pointerup", up);
      const settled = latest.current;
      latest.current = null;
      setLive(null);
      if (settled) onEditBox(index, slot, settled);
    };

    window.addEventListener("pointermove", moved);
    window.addEventListener("pointerup", up);
  };

  const dragging = live !== null;

  return (
    <div className={cn("group/box", dragging && "z-30")} style={place}>
      {children(drawn)}

      {/* The box's own outline, shown while it is being handled so the reader
          can see what they are moving even where the box is empty. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 border border-dashed border-emerald-600 transition-opacity",
          dragging ? "opacity-100" : "opacity-0 group-hover/box:opacity-60",
        )}
      />

      <span
        onPointerDown={grab("move")}
        role="button"
        tabIndex={-1}
        aria-label="Drag to move this box"
        title="Drag to move this box"
        className="absolute bottom-1 left-1 z-20 flex cursor-move items-center gap-0.5 rounded-full bg-stone-900/60 px-1 py-0.5 text-[7px] tracking-[0.14em] text-white uppercase opacity-0 transition-opacity group-hover/box:opacity-100"
      >
        <Move className="size-2.5" aria-hidden />
        Place
      </span>

      <span
        onPointerDown={grab("size")}
        role="button"
        tabIndex={-1}
        aria-label="Drag to resize this box"
        title="Drag to resize this box"
        className={cn(
          "absolute -right-[3px] -bottom-[3px] z-20 size-[10px] cursor-nwse-resize rounded-[1px] border border-white transition-opacity",
          dragging ? "bg-emerald-600 opacity-100" : "bg-emerald-600 opacity-0 group-hover/box:opacity-100",
        )}
      />

      {dragging && (
        <span className="absolute -top-4 left-0 z-30 rounded bg-emerald-600 px-1 text-[7px] text-white tabular-nums">
          {Math.round(drawn.width)} × {Math.round(drawn.height)}
        </span>
      )}
    </div>
  );
}

/**
 * A page the reader drew.
 *
 * Every box is placed absolutely from the design, because that is what a
 * design is — positions, not a flow. The two runs are matched to their
 * contents by reading order, the same order the composer poured into: the
 * third text box down the page holds the third slice, and the second plate box
 * holds the second photograph, whatever order they happen to sit in the array.
 *
 * A page with no design falls back to plain columns rather than drawing
 * nothing, so choosing this theme before drawing anything still gives an issue.
 */
function CustomLayout({ page, sketches }: { page: Page; sketches?: Record<string, string> }) {
  if (!page.layout) return <Columns page={page} height={TEXT_HEIGHT} />;
  if (page.layout.bleed) return <BleedPage page={page} />;

  const slot = SLOT_OF[page.template];
  const texts = textBoxes(page.layout);
  const plates = plateBoxes(page.layout);
  const pads = sketchBoxes(page.layout);
  const quotes = quoteBoxes(page.layout);

  return (
    <div className="relative" style={{ width: TEXT_WIDTH, height: TEXT_HEIGHT }}>
      {texts.map((box, n) => (
        <DrawnBox key={box.id} index={page.index} slot={slot} box={box}>
          {drawn => (
            <Copy
              slice={page.slices[n]}
              width={drawn.width}
              height={drawn.height}
              dropCap={n === 0 && page.dropCap}
            />
          )}
        </DrawnBox>
      ))}
      {plates.map((box, n) => (
        <DrawnBox key={box.id} index={page.index} slot={slot} box={box}>
          {drawn => (
            <div className="group/plate size-full">
              <PlateFigure plate={page.plates[n]} width={drawn.width} height={drawn.height} />
            </div>
          )}
        </DrawnBox>
      ))}
      {quotes.map((box, n) => (
        <DrawnBox key={box.id} index={page.index} slot={slot} box={box}>
          {drawn => (
            <QuoteBlock
              text={page.quotes?.[n] ?? ""}
              width={drawn.width}
              height={drawn.height}
              tone={box.tone}
              signOff={box.signOff}
            />
          )}
        </DrawnBox>
      ))}
      {/* Nothing is poured into these and no photograph dealt to them: each
          holds only what was drawn on it, kept against its own id so a page
          may carry several and each keep its own marks. */}
      {pads.map(box => (
        <DrawnBox key={box.id} index={page.index} slot={slot} box={box}>
          {drawn => (
            <SketchPad
              id={box.id}
              width={drawn.width}
              height={drawn.height}
              sketch={sketches?.[box.id]}
              compact
            />
          )}
        </DrawnBox>
      ))}
    </div>
  );
}

/** Four narrow measures of reading, and nothing else on the leaf. */
function QuadText({ page }: { page: Page }) {
  return <Quad page={page} height={TEXT_HEIGHT} />;
}

/**
 * One narrow measure standing in the middle of the leaf.
 *
 * The air either side is the layout. A centred kicker and a hairline over it,
 * then a single column that runs to the foot — the page an issue gives to a
 * piece that wants to be read slowly rather than looked at.
 */
function CentredArticle({ page }: { page: Page }) {
  const { accent } = use(SurfaceContext);
  return (
    <div className="flex h-full flex-col items-center" style={{ gap: STACK_GAP }}>
      <div
        className="flex shrink-0 flex-col items-center justify-end gap-2 text-center"
        style={{ height: CENTRED_HEAD }}
      >
        <span className={KICKER}>The essay</span>
        <span aria-hidden className="h-px w-10" style={{ backgroundColor: accent, opacity: 0.6 }} />
      </div>
      <Copy
        slice={page.slices[0]}
        width={CENTRED_WIDTH}
        height={TEXT_HEIGHT - CENTRED_HEAD - STACK_GAP}
        dropCap={page.dropCap}
      />
    </div>
  );
}

/**
 * A rule of repeated ornament, closing the head or the foot of a page.
 *
 * Drawn as one line of the mark repeated and clipped, rather than a counted
 * number of them, so it fills the measure exactly at any width and never ends
 * on half a flourish.
 */
function Ornament() {
  const { ornament, accent } = use(SurfaceContext);
  if (!ornament) return <div style={{ height: ORNAMENT }} />;
  return (
    <div
      aria-hidden
      className="overflow-hidden text-center leading-none whitespace-nowrap select-none"
      style={{ height: ORNAMENT, color: accent, fontSize: 13, letterSpacing: "0.06em" }}
    >
      {ornament.repeat(48)}
    </div>
  );
}

/**
 * The ornamented feature: rule, a centred headline, the plate, the copy, and
 * the rule again.
 *
 * Centred rather than ranged left, and set between two closed ends — the older
 * way of opening a piece. It earns its place here by sitting opposite the
 * squared-off pages the rest of the issue is made of.
 */
function OrnamentFeature({ page, title }: { page: Page; title: string }) {
  const { size, grips } = usePlateSize(page);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <Ornament />

      <div className="flex shrink-0 flex-col items-center justify-center text-center" style={{ height: ORNAMENT_HEAD }}>
        <span className={cn(KICKER, "italic")}>Feature</span>
        <h2
          className={cn(HEADLINE, "mt-3 line-clamp-3 text-[30px] leading-[1.14] text-balance")}
          style={{ maxWidth: COLUMN_WIDTH * 1.5 }}
        >
          {title}
        </h2>
      </div>

      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>

      <Columns page={page} height={TEXT_HEIGHT - ORNAMENT * 2 - ORNAMENT_HEAD - size.height - STACK_GAP * 4} />

      <Ornament />
    </div>
  );
}

/**
 * A black band off the head of the leaf with the headline reversed out of it,
 * the plate beneath, and the copy in four narrow measures under that.
 *
 * The band is the one thing on the page that ignores the margin: it is drawn
 * from the trim, pulled out and up by exactly the margin the page applies, so
 * it reaches three edges the way a printed band does. Nothing is measured
 * against the bled part — the fitter only ever sees the depth below it — so
 * the two cannot drift apart.
 */
function FourColumn({ page, title }: { page: Page; title: string }) {
  const { size, grips } = usePlateSize(page);
  const surface = use(SurfaceContext);
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <div className="relative shrink-0" style={{ height: BAND_HEAD }}>
        <div
          aria-hidden
          className="absolute"
          style={{
            top: -MARGIN,
            left: -MARGIN,
            width: PAGE.width,
            height: BAND_HEAD + MARGIN,
            backgroundColor: surface.ink,
          }}
        />
        {/* Hung from the foot of the band, so a one-line title and a two-line
            one both sit on the same baseline above the plate. */}
        <div className="relative flex h-full flex-col justify-end pb-3">
          <h2
            className={cn(
              HEADLINE,
              "line-clamp-2 text-[46px] leading-[0.88] tracking-[-0.03em] text-balance lowercase",
            )}
            style={{ color: surface.paper }}
          >
            {title}
          </h2>
        </div>
      </div>

      <div className="group/plate relative shrink-0" style={{ width: size.width, height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={size.width} height={size.height} />
        {grips}
      </div>

      <Quad page={page} height={TEXT_HEIGHT - BAND_HEAD - size.height - STACK_GAP * 2} />
    </div>
  );
}

/**
 * The size a pull quote is set at: the largest that fits its block.
 *
 * Worked out from the length of the line and the block's shape rather than
 * measured, because a quote is not the story — nothing is poured after it, so
 * nothing downstream depends on its exact wrap, and a line of display type
 * averages about half an em a character in every face offered here.
 */
function quoteSize(text: string, width: number, height: number): number {
  for (let size = 40; size > 9; size -= 1) {
    const perLine = Math.max(1, Math.floor(width / (size * 0.5)));
    // Words do not break mid-line, so lines run short: allow for it.
    const lines = Math.ceil((text.length * 1.12) / perLine);
    // The opening mark takes most of a line above the quote.
    if (lines * size * 1.14 + size * 0.8 <= height) return size;
  }
  return 9;
}

/**
 * A pull quote: a line from the story, set large in the display face on a
 * block of the issue's accent or ink, or straight onto the paper in accent.
 */
function QuoteBlock({
  text,
  width,
  height,
  tone = "accent",
  signOff = false,
}: {
  text: string;
  width: number;
  height: number;
  tone?: QuoteTone;
  signOff?: boolean;
}) {
  const { accent, ink, paper } = use(SurfaceContext);
  if (!text) return <div style={{ width, height }} />;

  // Where the story ends: the title, centred, as the last thing on the leaf.
  if (signOff) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 text-center"
        style={{ width, height, background: accent, color: paper, padding: 24 }}
      >
        <span aria-hidden className="text-[8px] tracking-[0.3em] uppercase opacity-80">
          The end
        </span>
        <p className={cn(HEADLINE, "text-balance")} style={{ color: "inherit", fontSize: Math.min(40, quoteSize(text, width - 48, height * 0.45)), lineHeight: 1.05 }}>
          {text}
        </p>
        <span aria-hidden className="h-px w-10 opacity-60" style={{ background: paper }} />
      </div>
    );
  }

  const block = tone !== "paper";
  const pad = block ? 16 : 4;
  const size = quoteSize(text, width - pad * 2, height - pad * 2);
  return (
    <figure
      className="flex flex-col justify-center overflow-hidden"
      style={{
        width,
        height,
        padding: pad,
        background: tone === "accent" ? accent : tone === "ink" ? ink : "transparent",
        color: block ? paper : accent,
      }}
    >
      <span aria-hidden className={HEADLINE} style={{ color: "inherit", fontSize: size * 1.7, lineHeight: 0.55, opacity: 0.55 }}>
        “
      </span>
      <blockquote className={cn(HEADLINE, "text-balance")} style={{ color: "inherit", fontSize: size, lineHeight: 1.12 }}>
        {text}
      </blockquote>
    </figure>
  );
}

/**
 * A photograph run to the trim, with the page's pull quote set over its foot
 * on a darkening gradient — the page a reader stops on. The picture keeps
 * every gesture a full plate has (swap, pan); the words lie over it without
 * catching the pointer.
 */
function BleedPage({ page }: { page: Page }) {
  const quote = page.quotes?.[0];
  return (
    <div className="relative size-full">
      <FullPlate page={page} />
      {quote && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/35 to-transparent"
          style={{ height: "46%", padding: MARGIN, paddingBottom: MARGIN + 34 }}
        >
          <span aria-hidden className={HEADLINE} style={{ color: "white", fontSize: 58, lineHeight: 0.5, opacity: 0.7 }}>
            “
          </span>
          <blockquote
            className={cn(HEADLINE, "text-balance")}
            style={{ color: "white", fontSize: quoteSize(quote, TEXT_WIDTH, 170), lineHeight: 1.1 }}
          >
            {quote}
          </blockquote>
        </div>
      )}
    </div>
  );
}

/** A plate given the whole page, run to the trim on every side. */
function FullPlate({ page }: { page: Page }) {
  const plate = page.plates[0];
  const handle = usePlateHandle(plate?.photo.id);
  const pan = usePhotoPan(plate?.photo);
  if (!plate) return <div className="size-full bg-stone-100" />;
  return (
    <div className="group/plate relative size-full overflow-hidden bg-stone-200" {...handle.target}>
      <img
        src={plate.photo.url}
        alt={plate.label}
        {...pan.handlers}
        style={focusStyle(pan.focus)}
        className={cn(
          "size-full object-cover",
          pan.pannable && "cursor-move",
          handle.over && "outline-2 -outline-offset-4 outline-emerald-500",
        )}
      />
      {handle.swappable && <SwapGrip grip={handle.grip} />}
      <span
        className="absolute bottom-0 left-0 bg-white/85 px-2 py-1 text-[7px] tracking-[0.14em] text-stone-500 uppercase"
        style={{ marginLeft: MARGIN, marginBottom: MARGIN }}
      >
        {plate.label}
        {plate.caption && <span className="ml-1.5 font-serif text-[8px] tracking-normal normal-case italic">{plate.caption}</span>}
      </span>
    </div>
  );
}

function PairedPlates({ page }: { page: Page }) {
  const half = (TEXT_HEIGHT - STACK_GAP) / 2;
  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={half} />
      <PlateFigure plate={page.plates[1]} width={TEXT_WIDTH} height={half} />
    </div>
  );
}

/**
 * The leaf that exists to keep the colophon on a recto.
 *
 * It has to be here; it does not have to be empty. The answer is set upside
 * down at the foot in the old way, so it is not read on the way past.
 */
function Blank({ page }: PageProps) {
  const riddle = page.riddle;
  if (!riddle) return <div className="size-full" />;
  return (
    <div className="flex h-full flex-col items-center text-center">
      <div className="flex grow flex-col items-center justify-center gap-4">
        <span className={KICKER}>The blank page</span>
        <p
          className={cn(HEADLINE, "text-[15px] leading-[1.5] text-balance text-stone-700")}
          style={{ maxWidth: COLUMN_WIDTH * 1.35 }}
        >
          {riddle.question}
        </p>
        <span aria-hidden className="h-px w-10 bg-stone-300" />
      </div>
      <div className="flex flex-col items-center gap-1 pb-1">
        <span className="text-[7px] tracking-[0.14em] text-stone-300 uppercase">Answer</span>
        <span className="rotate-180 text-[9px] text-stone-400">{riddle.answer}</span>
      </div>
    </div>
  );
}

function Colophon({ title, dateline, polished }: PageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <span className={KICKER}>Colophon</span>
      <h2 className={cn(HEADLINE, "text-[22px] leading-[1.1] text-balance")}>{title}</h2>
      <p className="text-[9px] text-stone-500">{dateline}</p>
      <div className="my-2 h-px w-16 bg-stone-300" />
      <p className="max-w-[300px] text-[9px] leading-[1.6] text-stone-500">
        {polished
          ? "Set with Atlas. Laid out in your browser; the words were sent once to be copy-edited, and nothing of this issue was kept."
          : "Set with Atlas. Laid out in your browser, and nothing of this issue — photographs or words — was ever stored by us."}
      </p>
    </div>
  );
}

type PageProps = {
  page: Page;
  title: string;
  dateline: string;
  polished: boolean;
  /**
   * What the reader has drawn, by the id of the surface it was drawn on.
   *
   * Handed down rather than kept on the page, because it belongs to the issue
   * and not to a leaf of it: the page is thrown away and rebuilt on every
   * recomposition, and a drawing must not be.
   */
  sketches?: Record<string, string>;
};

const LAYOUTS: Record<TemplateId, (props: PageProps) => React.ReactNode> = {
  cover: Cover,
  contents: Contents,
  opener: ({ page, title }) => <Opener page={page} title={title} />,
  "two-column": ({ page }) => <Columns page={page} height={TEXT_HEIGHT} />,
  "plate-above": ({ page }) => <PlateAbove page={page} />,
  "plate-below": ({ page }) => <PlateBelow page={page} />,
  "plate-beside": ({ page }) => <PlateBeside page={page} />,
  "plate-beside-right": ({ page }) => <PlateBesideRight page={page} />,
  "plate-band": ({ page }) => <PlateBand page={page} />,
  "zine-collage": ({ page }) => <ZineCollage page={page} />,
  "zine-rows": ({ page }) => <ZineRows page={page} />,
  "four-column": ({ page, title }) => <FourColumn page={page} title={title} />,
  "ornament-feature": ({ page, title }) => <OrnamentFeature page={page} title={title} />,
  "quad-text": ({ page }) => <QuadText page={page} />,
  "custom-left": ({ page, sketches }) => <CustomLayout page={page} sketches={sketches} />,
  "custom-right": ({ page, sketches }) => <CustomLayout page={page} sketches={sketches} />,
  "custom-special": ({ page, sketches }) => <CustomLayout page={page} sketches={sketches} />,
  "centred-article": ({ page }) => <CentredArticle page={page} />,
  "full-plate": ({ page }) => <FullPlate page={page} />,
  "paired-plates": ({ page }) => <PairedPlates page={page} />,
  canvas: ({ sketches }) => <SketchPage sketches={sketches} />,
  blank: Blank,
  colophon: Colophon,
};

/**
 * The surface this particular leaf is printed on.
 *
 * A theme with a `reverse` prints cream and black by turns. The cover has no
 * folio and is never reversed; after it every spread is verso then recto, so
 * the even numbers are the left-hand leaves and taking those gives a reader
 * one of each on every opening.
 *
 * Only colours are exchanged. The body face, its size and its leading are
 * what the fitter measured every box against, and swapping any of those here
 * would set a page in type the composer never fitted.
 */
function leafOf(surface: Surface, folio: number | null): Surface {
  const reverse = surface.reverse;
  if (!reverse || folio === null || folio % 2 !== 0) return surface;
  return {
    ...surface,
    paper: reverse.paper,
    ink: reverse.ink,
    copy: { ...surface.copy, color: reverse.copy },
  };
}

/**
 * The page number at the foot.
 *
 * The house rule is a small number in the corner, out of the way of the
 * reading. The modernist theme makes a device of it instead: an outsized
 * light numeral against the *outer* edge with the issue named beside it
 * behind a hairline, mirrored on the verso, so an open spread reads as one
 * running foot rather than two corners that happen to match.
 *
 * Which edge is outer is decided by the folio itself. The cover stands alone
 * and every spread after it is verso-then-recto, which puts the even numbers
 * on the left-hand leaf.
 */
function Folio({ folio, dateline, surface }: { folio: number; dateline: string; surface: Surface }) {
  if (surface.folio !== "large") {
    return (
      <span
        className="absolute text-[8px] tabular-nums opacity-45"
        style={{ left: MARGIN, bottom: MARGIN / 2, color: surface.ink }}
      >
        {folio}
      </span>
    );
  }

  const verso = folio % 2 === 0;
  const label = (
    <span className="flex flex-col text-[6.5px] leading-[1.5] tracking-[0.16em] uppercase">
      <span>Atlas</span>
      <span className="opacity-60">{dateline}</span>
    </span>
  );

  return (
    <div
      className="absolute flex items-center gap-3"
      style={{
        left: verso ? MARGIN : undefined,
        right: verso ? undefined : MARGIN,
        bottom: MARGIN / 2 - 6,
        color: surface.ink,
      }}
    >
      {verso && (
        <span className="text-[30px] leading-none font-light tabular-nums">{folio}</span>
      )}
      <span aria-hidden className="h-7 w-px" style={{ backgroundColor: surface.ink, opacity: 0.35 }} />
      {label}
      {!verso && (
        <>
          <span aria-hidden className="h-7 w-px" style={{ backgroundColor: surface.ink, opacity: 0.35 }} />
          <span className="text-[30px] leading-none font-light tabular-nums">{folio}</span>
        </>
      )}
    </div>
  );
}

/**
 * The pens, and what they are loaded with.
 *
 * A set rather than a colour picker: the point of a drawing box is a signature
 * or a scrawl, and a full spectrum would make it a paint program on a surface
 * two inches wide on screen.
 */
export const INKS = [
  "#1c1917",
  "#78716c",
  "#c1121f",
  "#ea580c",
  "#ca8a04",
  "#15803d",
  "#0e7490",
  "#1d4ed8",
  "#7e22ce",
  "#be185d",
];

export const NIBS = [2, 5, 11, 20];

/**
 * How a stroke is laid down.
 *
 * The marker is opaque and even — one pass is one mark, and going over it
 * again changes nothing. The brush is thin ink: every pass darkens what is
 * under it, so a shape built up slowly looks built up. The rubber takes marks
 * off rather than painting the paper over them, which matters because the leaf
 * is transparent and the page behind it is not always white.
 */
export type Tool = "marker" | "brush" | "rubber";

const TOOLS: { id: Tool; name: string }[] = [
  { id: "marker", name: "Marker" },
  { id: "brush", name: "Brush" },
  { id: "rubber", name: "Rubber" },
];

/**
 * A surface to draw on: a whole leaf, or one box on a page the reader drew.
 *
 * Painted at twice its shown size so a signature is not a staircase in the
 * PDF, and what is kept is the finished bitmap rather than the strokes —
 * nothing here needs replaying, and a data URL survives the parking, the
 * recomposition and the print sheet without any of them knowing what a stroke
 * is.
 *
 * Where there is nothing to draw with — the printed sheet — it is an image of
 * what was drawn. An image prints; a live canvas is a gamble.
 */
function SketchPad({
  id,
  width,
  height,
  sketch,
  compact,
}: {
  id: string;
  width: number;
  height: number;
  sketch?: string;
  /** Floats the tools over the surface instead of standing them above it. */
  compact?: boolean;
}) {
  const edit = use(PlateEditContext);
  const surface = use(SurfaceContext);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ink, setInk] = useState(INKS[0]!);
  const [nib, setNib] = useState(NIBS[1]!);
  const [tool, setTool] = useState<Tool>("marker");
  const drawing = useRef(false);

  const onSketch = edit?.onSketch;

  // Whatever was drawn before is painted back in first, so a stroke made now
  // composites onto the strokes made earlier rather than onto an empty leaf.
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const brush = node.getContext("2d");
    if (!brush) return;
    brush.clearRect(0, 0, node.width, node.height);
    if (!sketch) return;
    const image = new globalThis.Image();
    image.onload = () => brush.drawImage(image, 0, 0, node.width, node.height);
    image.src = sketch;
  }, [sketch]);

  if (!onSketch) {
    return sketch ? (
      <img src={sketch} alt="" style={{ width, height }} className="object-contain" />
    ) : (
      <div style={{ width, height }} />
    );
  }

  /** Pointer position in canvas pixels, whatever the page is scaled to. */
  const at = (event: PointerEvent<HTMLCanvasElement>) => {
    const node = event.currentTarget;
    const frame = node.getBoundingClientRect();
    return {
      x: ((event.clientX - frame.left) / frame.width) * node.width,
      y: ((event.clientY - frame.top) / frame.height) * node.height,
    };
  };

  const load = (node: HTMLCanvasElement) => {
    const brush = node.getContext("2d");
    if (!brush) return null;
    brush.lineCap = "round";
    brush.lineJoin = "round";
    // The canvas is twice its shown size, so the nib has to be too or a
    // two-pixel pen would draw a one-pixel line.
    brush.lineWidth = nib * 2 * (tool === "brush" ? 1.6 : 1);
    brush.globalAlpha = tool === "brush" ? 0.3 : 1;
    brush.globalCompositeOperation = tool === "rubber" ? "destination-out" : "source-over";
    brush.strokeStyle = tool === "rubber" ? "#000" : ink;
    return brush;
  };

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const brush = load(event.currentTarget);
    if (!brush) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = at(event);
    brush.beginPath();
    brush.moveTo(x, y);
    // So a tap leaves a dot rather than nothing.
    brush.lineTo(x + 0.01, y);
    brush.stroke();
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const brush = load(event.currentTarget);
    if (!brush) return;
    const { x, y } = at(event);
    brush.lineTo(x, y);
    brush.stroke();
  };

  // Kept on release: one data URL a stroke, not one a pixel.
  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    onSketch(id, event.currentTarget.toDataURL("image/png"));
  };

  const clear = () => {
    const node = canvas.current;
    const brush = node?.getContext("2d");
    if (!node || !brush) return;
    brush.globalCompositeOperation = "source-over";
    brush.clearRect(0, 0, node.width, node.height);
    onSketch(id, node.toDataURL("image/png"));
  };

  const tools = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1",
        compact &&
          "absolute top-1 left-1 z-20 rounded bg-white/90 px-1.5 py-1 opacity-0 shadow-sm transition-opacity group-hover/pad:opacity-100",
      )}
    >
      <div className="flex items-center gap-1">
        {TOOLS.map(({ id: which, name }) => (
          <button
            key={which}
            type="button"
            onClick={() => setTool(which)}
            aria-pressed={which === tool}
            title={name}
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[7px] tracking-[0.14em] uppercase transition-colors",
              which === tool ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-100",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <span aria-hidden className="h-3 w-px bg-stone-300" />

      <div className="flex items-center gap-1">
        {INKS.map(colour => (
          <button
            key={colour}
            type="button"
            onClick={() => {
              setInk(colour);
              // Choosing a colour is asking to draw with it.
              if (tool === "rubber") setTool("marker");
            }}
            aria-label="Draw in this colour"
            aria-pressed={colour === ink && tool !== "rubber"}
            className={cn(
              "size-[9px] rounded-full transition-transform",
              colour === ink && tool !== "rubber" && "scale-[1.45] ring-1 ring-stone-400 ring-offset-1",
            )}
            style={{ backgroundColor: colour }}
          />
        ))}
      </div>

      <span aria-hidden className="h-3 w-px bg-stone-300" />

      <div className="flex items-center gap-1">
        {NIBS.map(size => (
          <button
            key={size}
            type="button"
            onClick={() => setNib(size)}
            aria-label={`Nib ${size} across`}
            aria-pressed={size === nib}
            className={cn(
              "flex size-4 items-center justify-center rounded-full",
              size === nib ? "bg-stone-200" : "hover:bg-stone-100",
            )}
          >
            <span
              className="rounded-full bg-stone-700"
              style={{ width: Math.min(11, size), height: Math.min(11, size) }}
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={clear}
        className="rounded-full px-1 text-[7px] tracking-[0.14em] text-stone-500 uppercase hover:text-stone-800"
      >
        Clear
      </button>
    </div>
  );

  const board = (
    <canvas
      ref={canvas}
      width={width * 2}
      height={height * 2}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      // Or a drag on a touchscreen scrolls the spread instead of drawing.
      className="touch-none rounded-[2px]"
      style={{
        width,
        height,
        border: `1px dashed ${surface.accent}`,
        cursor: tool === "rubber" ? "cell" : "crosshair",
      }}
    />
  );

  if (compact) {
    return (
      <div className="group/pad relative" style={{ width, height }}>
        {board}
        {tools}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ gap: STACK_GAP }}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <span className={KICKER}>Your own hand</span>
        {tools}
      </div>
      {board}
    </div>
  );
}

/** The leaf left blank for the reader to draw, write or sign on. */
function SketchPage({ sketches }: { sketches?: Record<string, string> }) {
  return (
    <SketchPad id={SKETCH_LEAF} width={TEXT_WIDTH} height={TEXT_HEIGHT - STACK_GAP - 18} sketch={sketches?.[SKETCH_LEAF]} />
  );
}

/** The key the whole-leaf drawing is kept under. */
export const SKETCH_LEAF = "leaf";

/** Layouts that run to the trim and so take no margin or folio. */
const BLEEDS = new Set<TemplateId>(["cover", "full-plate"]);

/**
 * One page of the issue, drawn at full size. Scale it from the outside.
 *
 * The theme is taken by id rather than as a resolved surface so that callers
 * — the spread viewer, the printed sheet — only have to pass along what the
 * issue already records, and an issue composed before themes existed still
 * draws on white.
 */
export function MagazinePage({
  page,
  title,
  dateline,
  polished,
  theme,
  tilt,
  type,
  sketches,
  palette,
}: PageProps & { theme?: ThemeId; tilt?: number; type?: TypeChoice; palette?: Palette }) {
  const Layout = LAYOUTS[page.template];
  const bleeds = BLEEDS.has(page.template) || page.layout?.bleed === true;
  const themed = THEMES[theme ?? DEFAULT_THEME]?.surface ?? THEMES[DEFAULT_THEME].surface;
  // Exactly what the composer fitted against — same function, same input.
  const typed = type ? { ...themed, ...surfaceOf(type) } : themed;
  // A designed issue's own colours. Only colours: the body face and size are
  // what the fitter measured, and a palette changes neither.
  const base = palette
    ? { ...typed, paper: palette.paper, ink: palette.ink, accent: palette.accent, copy: { ...typed.copy, color: palette.ink } }
    : typed;
  // The reader's lean wins over the theme's, and none at all is a real answer
  // rather than "unset" — hence the explicit undefined check.
  const surface = { ...leafOf(base, page.folio), tilt: tilt ?? base.tilt };

  return (
    <SurfaceContext value={surface}>
    <div
      className="relative shrink-0 overflow-hidden"
      style={
        {
          width: PAGE.width,
          height: PAGE.height,
          // Printed backgrounds are dropped by default in every browser's
          // print dialog, so the stock is set as a real element behind the
          // page rather than as the page's own background.
          backgroundColor: surface.paper,
          "--ink-accent": surface.accent,
          "--ink": surface.ink,
          "--display-font": surface.display,
          "--display-weight": surface.displayWeight ?? "400",
          "--display-tracking": surface.displayTracking ?? "normal",
        } as CSSProperties
      }
    >
      <div className="size-full" style={bleeds ? undefined : { padding: MARGIN, paddingBottom: MARGIN }}>
        {bleeds ? (
          <Layout page={page} title={title} dateline={dateline} polished={polished} sketches={sketches} />
        ) : (
          <div style={{ height: TEXT_HEIGHT }}>
            <Layout page={page} title={title} dateline={dateline} polished={polished} sketches={sketches} />
          </div>
        )}
      </div>

      {!bleeds && page.folio !== null && (
        <Folio folio={page.folio} dateline={dateline} surface={surface} />
      )}
    </div>
    </SurfaceContext>
  );
}
