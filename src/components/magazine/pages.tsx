import { createContext, use, useMemo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react";
import { ChevronsUpDown, GripVertical, Move, Wand2 } from "lucide-react";

import { COPY_CLASS, paragraphsHtml, type Slice } from "@/lib/magazine/copy";
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
  OPENER_HEAD,
  plateAxes,
  STACK_GAP,
  type Axis,
  type PlateBox,
  type TemplateId,
} from "@/lib/magazine/templates";
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
};

const PlateEditContext = createContext<PlateEdit | null>(null);

export function PlateEditProvider({
  children,
  ...edit
}: PlateEdit & { children: ReactNode }) {
  const { scale, onSwap, onResize, onPan } = edit;
  // The viewer re-renders on every resize; a fresh object here would drag
  // every plate on the spread through a re-render with it.
  const value = useMemo(() => ({ scale, onSwap, onResize, onPan }), [scale, onSwap, onResize, onPan]);
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
    return page.template === "plate-below" ? -1 : 1;
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
  if (!slice) return null;
  return (
    <div
      className={cn(COPY_CLASS, "flow-root overflow-hidden")}
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: paragraphsHtml(slice, { dropCap }) }}
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

const CAPTION_CLASS = "truncate text-[7px] tracking-[0.14em] text-stone-400 uppercase";

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

  if (!plate) return <div style={{ width, height }} />;
  return (
    <figure className="flex flex-col" style={{ width, height }}>
      <div className="relative overflow-hidden rounded-[2px]" style={{ height: height - CAPTION }} {...handle.target}>
        <img
          src={plate.photo.url}
          alt=""
          {...pan.handlers}
          style={focusStyle(pan.focus)}
          className={cn("size-full bg-stone-200 object-cover", pan.pannable && "cursor-move", handle.over && OVER)}
        />
        {handle.swappable && <SwapGrip grip={handle.grip} />}
      {pan.placement}
        {pan.placement}
      </div>
      <figcaption className={cn(CAPTION_CLASS, "pt-[5px]")} style={{ height: CAPTION }}>
        {plate.label}
      </figcaption>
    </figure>
  );
}

const KICKER = "text-[8px] font-medium tracking-[0.28em] text-stone-400 uppercase";
const HEADLINE = "font-editorial text-stone-900";

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
            alt=""
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
          <span className="font-editorial text-[22px] leading-none">Atlas</span>
          <span className="text-[8px] tracking-[0.28em] uppercase">{dateline}</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[8px] font-medium tracking-[0.28em] text-white/70 uppercase">The issue</span>
          <h1 className="font-editorial text-[40px] leading-[1.02] text-balance text-white">{title}</h1>
        </div>
      </div>
    </div>
  );
}

function Contents({ page, title, dateline }: PageProps) {
  return (
    <div className="flex h-full flex-col">
      <span className="font-editorial text-[30px] leading-none text-stone-900">Atlas</span>
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
            <span key={entry.label} className="flex items-baseline gap-2 text-[9px] text-stone-500">
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
      <div className="group/plate relative shrink-0" style={{ height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={size.height} />
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
      <div className="group/plate relative shrink-0" style={{ height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={size.height} />
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
      <div className="group/plate relative shrink-0" style={{ height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={size.height} />
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
      <div className="group/plate relative shrink-0" style={{ height: size.height }}>
        <PlateFigure plate={page.plates[0]} width={TEXT_WIDTH} height={size.height} />
        {grips}
      </div>
      <Columns page={page} height={below} from={2} />
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
        alt=""
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
          ? "Set with Atlas. The photographs never left your browser. The words were sent once to be copy-edited, and were not kept."
          : "Set with Atlas. The photographs and the words were laid out in your browser and were never uploaded to us."}
      </p>
    </div>
  );
}

type PageProps = { page: Page; title: string; dateline: string; polished: boolean };

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
  "full-plate": ({ page }) => <FullPlate page={page} />,
  "paired-plates": ({ page }) => <PairedPlates page={page} />,
  blank: Blank,
  colophon: Colophon,
};

/** Layouts that run to the trim and so take no margin or folio. */
const BLEEDS = new Set<TemplateId>(["cover", "full-plate"]);

/** One page of the issue, drawn at full size. Scale it from the outside. */
export function MagazinePage({ page, title, dateline, polished }: PageProps) {
  const Layout = LAYOUTS[page.template];
  const bleeds = BLEEDS.has(page.template);

  return (
    <div
      className="relative shrink-0 overflow-hidden bg-white"
      style={{ width: PAGE.width, height: PAGE.height }}
    >
      <div className="size-full" style={bleeds ? undefined : { padding: MARGIN, paddingBottom: MARGIN }}>
        {bleeds ? (
          <Layout page={page} title={title} dateline={dateline} polished={polished} />
        ) : (
          <div style={{ height: TEXT_HEIGHT }}>
            <Layout page={page} title={title} dateline={dateline} polished={polished} />
          </div>
        )}
      </div>

      {!bleeds && page.folio !== null && (
        <span
          className="absolute text-[8px] text-stone-400 tabular-nums"
          style={{ left: MARGIN, bottom: MARGIN / 2 }}
        >
          {page.folio}
        </span>
      )}
    </div>
  );
}
