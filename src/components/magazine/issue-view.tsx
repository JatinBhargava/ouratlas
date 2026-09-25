import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MagazinePage, PlateEditProvider } from "@/components/magazine/pages";
import { Button } from "@/components/ui/button";
import { PAGE } from "@/lib/magazine/geometry";
import type { Axis } from "@/lib/magazine/templates";
import type { CustomBox, CustomSlot } from "@/lib/magazine/custom";
import type { Cursor } from "@/lib/magazine/copy";
import type { Focus } from "@/types";
import type { Issue, Page } from "@/lib/magazine/types";
import { cn } from "@/lib/utils";

/** Gap between the two leaves of an open spread. */
const BINDING = 2;

/**
 * How long a page takes to turn on its own, and how it moves. The same turn
 * as the magazine reader on the portfolio, so an issue reads the same here as
 * it does when it is shown off there.
 */
const TURN_MS = 750;
const TURN_EASE = "cubic-bezier(0.45, 0.05, 0.25, 1)";
/** How dark the turning leaf gets side-on to the light. */
const DIM = 0.25;
/** Below this width the proof shows one page at a time: a spread would be too small to read or edit. */
const SINGLE_BELOW = 620;
/** A swipe shorter than this is a tap, not a turn. */
const SWIPE = 50;
/** How fast a page let go of finishes (or falls back): quicker than a full turn, it is already moving. */
const RELEASE_RATE = 1.8;
/** Past this share of the turn a released page carries on over; short of it, it falls back. */
const COMMIT = 0.3;
/** Width of the grip along a page's outer edge, in page pixels — inside the margin, clear of the content. */
const EDGE = 44;

/** Where the right-hand leaf of a spread starts. */
const RECTO = PAGE.width + BINDING;

/**
 * The book is laid out two leaves wide throughout, and the cover sits on the
 * right-hand one — where a cover is. At rest it is slid back by half a spread
 * so it stands centred on its own; turning it slides the book open as the
 * cover swings over, the way a magazine opens on a table.
 */
const CLOSED = -RECTO / 2;

/**
 * A page turn in progress: from one spread to the next, forwards or back.
 * `hand` is set when the reader is turning it themselves, and the turn then
 * follows the pointer instead of playing.
 */
type Turn = { from: number; to: number; dir: 1 | -1; hand?: boolean };

/** The cover stands alone; everything after it reads as verso and recto. */
function toSpreads(pages: Page[]): Page[][] {
  if (pages.length === 0) return [];
  const spreads: Page[][] = [[pages[0]!]];
  for (let i = 1; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));
  return spreads;
}

type IssueViewProps = {
  issue: Issue;
  className?: string;
  /**
   * Swaps the two photographs when one plate is dropped on another. Omitting
   * it leaves every plate fixed, which is what the printed sheet wants.
   */
  onSwapPlates?: (from: string, to: string) => void;
  /** Sets one axis of the plate on one page, by page index. */
  onResizePlate?: (index: number, axis: Axis, value: number) => void;
  /** Places a photograph inside its frame, or hands the placing back with null. */
  onPanPhoto?: (photoId: string, focus: Focus | null) => void;
  /**
   * How far pasted-up plates lean, in degrees, overriding the theme.
   *
   * A prop rather than something on the issue: the lean changes no box the
   * fitter measured, so moving it is a redraw and never a recomposition.
   */
  tilt?: number;
  /** Moves or sizes one box on one of the reader's own pages. */
  onEditBox?: (index: number, slot: CustomSlot, box: CustomBox) => void;
  /** Replaces the run of story a box is showing with what was typed into it. */
  onEditCopy?: (from: Cursor, to: Cursor, text: string) => void;
  /** What has been drawn, by surface id, and how to keep a new stroke. */
  sketches?: Record<string, string>;
  onSketch?: (id: string, dataUrl: string) => void;
};

export function IssueView({
  issue,
  className,
  onSwapPlates,
  onResizePlate,
  onPanPhoto,
  onEditBox,
  onEditCopy,
  sketches,
  onSketch,
  tilt,
}: IssueViewProps) {
  const spreads = useMemo(() => toSpreads(issue.pages), [issue.pages]);
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [turn, setTurn] = useState<Turn | null>(null);
  const leaf = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  // The dimming on each face of the turning leaf.
  const frontShade = useRef<HTMLDivElement>(null);
  const backShade = useRef<HTMLDivElement>(null);
  /** Every animation of the turn in progress, driven together. */
  const motion = useRef<Animation[]>([]);

  // Narrow screens read one page at a time, as the portfolio's reader does.
  const [single, setSingle] = useState(false);
  const [page, setPage] = useState(0);
  const [slide, setSlide] = useState<{ from: number; to: number; dir: 1 | -1 } | null>(null);
  const incoming = useRef<HTMLDivElement>(null);
  const outgoing = useRef<HTMLDivElement>(null);

  // An issue set again while a page is turning (a plate swapped, a box
  // dragged) may have fewer spreads than the turn was heading for.
  const at = Math.min(index, Math.max(0, spreads.length - 1));
  const spread = spreads[at] ?? [];
  // Two leaves wide whenever there is anything past the cover, so the stage
  // does not change size — and the scale jump with it — as the book opens.
  const width = spreads.length > 1 ? PAGE.width * 2 + BINDING : PAGE.width;

  // Pages are drawn at print size and scaled down to whatever room there is,
  // so text wraps identically at every viewport.
  useLayoutEffect(() => {
    const host = stage.current;
    if (!host) return;
    const fit = () => {
      const narrow = host.clientWidth < SINGLE_BELOW;
      setSingle(narrow);
      setScale(Math.min(1, host.clientWidth / (narrow ? PAGE.width : width)));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [width]);

  // Changing between the two keeps the reader where they were: the first page
  // of the spread they were on, or the spread holding the page they were on.
  const firstOf = (s: number) => (s === 0 ? 0 : 2 * s - 1);
  const spreadOf = (p: number) => (p === 0 ? 0 : Math.ceil(p / 2));
  const wasSingle = useRef(single);
  useEffect(() => {
    if (wasSingle.current === single) return;
    wasSingle.current = single;
    if (single) setPage(firstOf(at));
    else setIndex(spreadOf(page));
  }, [single]);

  const pageAt = Math.min(page, Math.max(0, issue.pages.length - 1));

  /** One page along, in the one-page reader: the new page slides in as the old one swings away. */
  useLayoutEffect(() => {
    if (!slide) return;
    const easing = "cubic-bezier(0.4, 0, 0.2, 1)";
    const enter = incoming.current?.animate(
      [{ transform: `translateX(${slide.dir > 0 ? 100 : -100}%)` }, { transform: "translateX(0)" }],
      { duration: 450, easing, fill: "both" },
    );
    const leave = outgoing.current?.animate(
      [
        { transform: "rotateY(0deg)", opacity: 1 },
        { transform: `rotateY(${slide.dir > 0 ? -70 : 70}deg)`, opacity: 0 },
      ],
      { duration: 450, easing, fill: "both" },
    );
    const done = () => {
      setPage(slide.to);
      setSlide(null);
    };
    if (enter) enter.onfinish = done;
    else done();
    return () => {
      enter?.cancel();
      leave?.cancel();
    };
  }, [slide]);

  // Read through refs by the key handler, which is bound once.
  const state = useRef({ at, turn, count: spreads.length, single, page: pageAt, slide, pages: issue.pages.length });
  state.current = { at, turn, count: spreads.length, single, page: pageAt, slide, pages: issue.pages.length };

  const go = (step: number) => {
    const { at: from, turn: turning, count } = state.current;
    if (state.current.single) {
      const { page: current, slide: sliding, pages } = state.current;
      if (sliding) return;
      const to = Math.min(pages - 1, Math.max(0, current + step));
      if (to === current) return;
      const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (still) setPage(to);
      else setSlide({ from: current, to, dir: step > 0 ? 1 : -1 });
      return;
    }
    // One page at a time: a click mid-turn is ignored rather than queued, so
    // hammering the arrow does not leave the book turning for seconds.
    if (turning) return;
    const to = Math.min(count - 1, Math.max(0, from + step));
    if (to === from) return;

    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || count < 2) {
      setIndex(to);
      return;
    }
    setTurn({ from, to, dir: step > 0 ? 1 : -1 });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Arrow keys belong to whatever is being typed into.
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Builds the turn as one timeline — the leaf's swing, the light across it,
   * the shadows it throws, the book sliding open or shut — every part of it an
   * animation of the same length, so that played they stay in step and under
   * the hand they can all be set to the same moment at once.
   *
   * The leaf lifts toward the reader as it rises (translateZ, before the
   * rotation) and settles back as it lands; a page does not turn flat on the
   * table. The spread changes only when the leaf lands, and not at all if a
   * page let go of falls back.
   */
  useLayoutEffect(() => {
    if (!turn) return;
    // Under the hand, time is position: linear, so the page stays under the
    // finger. On its own, the page falls with a paper-like ease.
    const timing: KeyframeAnimationOptions = {
      duration: TURN_MS,
      easing: turn.hand ? "linear" : TURN_EASE,
      fill: "both",
    };
    const sign = turn.dir > 0 ? -1 : 1;
    const list: Animation[] = [];
    const make = (element: HTMLElement | null, frames: Keyframe[]) => {
      const animation = element?.animate(frames, timing);
      if (!animation) return undefined;
      animation.pause();
      list.push(animation);
      return animation;
    };

    const swing = make(leaf.current, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${sign * 180}deg)` }]);
    // The face going away dims as it tilts from the light; the face coming
    // round arrives dim and brightens as it lies down.
    make(frontShade.current, [{ opacity: 0 }, { opacity: DIM, offset: 0.5 }, { opacity: DIM }]);
    make(backShade.current, [{ opacity: DIM }, { opacity: DIM, offset: 0.5 }, { opacity: 0 }]);

    const fromX = turn.from === 0 ? CLOSED : 0;
    const toX = turn.to === 0 ? CLOSED : 0;
    if (fromX !== toX) make(book.current, [{ translate: `${fromX}px 0` }, { translate: `${toX}px 0` }]);

    motion.current = list;
    const done = (forward: boolean) => {
      if (forward) setIndex(turn.to);
      setTurn(null);
    };
    if (!swing) {
      done(true);
      return;
    }
    swing.onfinish = () => done(swing.playbackRate > 0);

    // Played on its own, it waits two frames first: the pages of the turn
    // are drawn in the first and composited in the second, so the motion
    // starts on a finished picture instead of stuttering through the paint.
    let frame = 0;
    if (!turn.hand) {
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => list.forEach(animation => animation.play()));
      });
    }

    return () => {
      cancelAnimationFrame(frame);
      list.forEach(animation => animation.cancel());
      motion.current = [];
    };
  }, [turn]);

  /**
   * Takes hold of a page by its outer edge. The page follows the pointer
   * across the spread; let go past a third of the way (or with a flick) and it
   * carries on over, short of that and it falls back where it was. A tap on
   * the edge turns the page outright.
   */
  const grab = (dir: 1 | -1) => (event: ReactPointerEvent<HTMLElement>) => {
    const { at: from, turn: turning, count } = state.current;
    const to = from + dir;
    if (turning || to < 0 || to >= count) return;
    event.preventDefault();
    event.stopPropagation();

    // A full turn is about a page and a half of travel on screen.
    const span = PAGE.width * scale * 1.5;
    const startX = event.clientX;
    let progress = 0;
    let lastX = startX;
    let lastT = performance.now();
    let speed = 0;

    setTurn({ from, to, dir, hand: true });

    const move = (e: PointerEvent) => {
      const travelled = dir > 0 ? startX - e.clientX : e.clientX - startX;
      progress = Math.min(1, Math.max(0, travelled / span));
      const now = performance.now();
      // Pixels per millisecond in the direction of the turn, for the flick.
      speed = ((dir > 0 ? lastX - e.clientX : e.clientX - lastX) / Math.max(1, now - lastT)) * 0.6 + speed * 0.4;
      lastX = e.clientX;
      lastT = now;
      motion.current.forEach(animation => (animation.currentTime = progress * TURN_MS));
    };
    const up = (e: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const tapped = Math.abs(e.clientX - startX) < 6;
      const over = tapped || progress > COMMIT || speed > 0.5;
      if (motion.current.length === 0) {
        if (over) setIndex(to);
        setTurn(null);
        return;
      }
      motion.current.forEach(animation => {
        animation.playbackRate = over ? RELEASE_RATE : -RELEASE_RATE;
        animation.play();
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const draw = (page: Page | undefined) =>
    page ? (
      <MagazinePage
        page={page}
        title={issue.title}
        dateline={issue.dateline}
        polished={issue.polished}
        theme={issue.theme}
        tilt={tilt}
        type={issue.type}
        palette={issue.palette}
        sketches={sketches}
      />
    ) : null;

  /**
   * The soft shade a page takes toward the spine, where it curves into the
   * binding. On every page at rest and in motion, so the book always reads as
   * a book rather than two cards side by side.
   */
  const gutter = (side: "verso" | "recto") => (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 z-30 w-10"
      style={{
        [side === "verso" ? "right" : "left"]: 0,
        background: `linear-gradient(${side === "verso" ? "to left" : "to right"}, rgba(0,0,0,0.15), rgba(0,0,0,0))`,
      }}
    />
  );

  /** Each leaf throws its shadow outward and down, away from the spine. */
  const lift = (side: "verso" | "recto") =>
    side === "verso" ? "-8px 14px 30px -12px rgba(0,0,0,0.35)" : "8px 14px 30px -12px rgba(0,0,0,0.35)";

  /** One leaf of the open book, at the verso or recto position, with a grip on its outer edge when it can turn. */
  const slot = (page: Page | undefined, side: "verso" | "recto", key?: string, grip?: 1 | -1, open = true) =>
    page ? (
      <div
        key={key ?? `${side}-${page.id}`}
        className="absolute top-0"
        style={{ left: side === "verso" ? 0 : RECTO, width: PAGE.width, height: PAGE.height, boxShadow: lift(side) }}
      >
        {draw(page)}
        {/* A closed cover has no spine beside it to shade toward. */}
        {open && gutter(side)}
        {grip && <Grip side={grip > 0 ? "right" : "left"} onPointerDown={grab(grip)} />}
      </div>
    ) : null;

  /** The fold between the two leaves, when both are down. */
  const spine = (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 z-30 w-px bg-black/10" style={{ left: RECTO - BINDING / 2 }} />
  );

  // The book at rest. A lone cover sits on the recto, slid back to centre.
  const resting = (
    <div
      ref={turn ? undefined : book}
      className="relative"
      style={{
        width,
        height: PAGE.height,
        scale: `${scale}`,
        transformOrigin: "top left",
        translate: spreads.length > 1 && at === 0 ? `${CLOSED}px 0` : undefined,
      }}
    >
      {at === 0
        ? slot(spread[0], spreads.length > 1 ? "recto" : "verso", undefined, spreads.length > 1 ? 1 : undefined, false)
        : [
            slot(spread[0], "verso", undefined, -1),
            slot(spread[1], "recto", undefined, at < spreads.length - 1 ? 1 : undefined),
          ]}
      {at !== 0 && spread.length === 2 && spine}
    </div>
  );

  /**
   * The book mid-turn, drawn without the editing layer: nothing on a page in
   * motion should be picked up. Going forward, the recto lifts and swings
   * left, showing the next verso on its back and uncovering the next recto
   * beneath it; going back, the verso swings right the same way.
   */
  const turning = turn
    ? (() => {
        const from = spreads[turn.from] ?? [];
        const to = spreads[turn.to] ?? [];
        const cover = (i: number) => i === 0;
        const fwd = turn.dir > 0;
        // What stays put while the leaf moves, and what the leaf carries.
        const still = fwd ? (cover(turn.from) ? undefined : from[0]) : from[1];
        const under = fwd ? to[1] : cover(turn.to) ? undefined : to[0];
        const front = fwd ? (cover(turn.from) ? from[0] : from[1]) : from[0];
        const back = fwd ? to[0] : cover(turn.to) ? to[0] : to[1];
        // The front of a forward leaf is a recto, its back a verso; a leaf
        // turning back the other way round.
        const face = (page: Page | undefined, flipped: boolean) => {
          const side = fwd !== flipped ? "recto" : "verso";
          const isCover = page?.template === "cover";
          return (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ backfaceVisibility: "hidden", transform: flipped ? "rotateY(180deg)" : undefined }}
            >
              {draw(page)}
              {!isCover && gutter(side)}
              <div
                ref={flipped ? backShade : frontShade}
                className="absolute inset-0 z-40 bg-black"
                style={{ opacity: flipped ? DIM : 0 }}
              />
            </div>
          );
        };

        return (
          <div
            ref={book}
            className="pointer-events-none relative"
            style={{
              width,
              height: PAGE.height,
              scale: `${scale}`,
              transformOrigin: "top left",
              perspective: 2400,
              translate: cover(turn.from) ? `${CLOSED}px 0` : undefined,
            }}
          >
            {fwd
              ? [slot(still, "verso", "still"), slot(under, "recto", "under")]
              : [slot(under, "verso", "under"), slot(still, "recto", "still")]}
            <div
              ref={leaf}
              className="absolute top-0 z-10"
              style={{
                left: fwd ? RECTO : 0,
                width: PAGE.width,
                height: PAGE.height,
                transformStyle: "preserve-3d",
                transformOrigin: fwd ? "left center" : "right center",
                willChange: "transform",
              }}
            >
              {face(front, false)}
              {face(back, true)}
            </div>
            {still && under && <div className="z-20">{spine}</div>}
          </div>
        );
      })()
    : null;

  /** The one-page reader: a page on its own, or two in passing while it turns. */
  const onePage = (
    <div
      className="relative overflow-hidden"
      style={{
        width: PAGE.width,
        height: PAGE.height,
        scale: `${scale}`,
        transformOrigin: "top left",
        perspective: 1600,
        boxShadow: "0 14px 30px -12px rgba(0,0,0,0.35)",
      }}
    >
      {slide ? (
        <>
          <div
            ref={outgoing}
            className="pointer-events-none absolute inset-0"
            style={{ transformOrigin: slide.dir > 0 ? "left center" : "right center" }}
          >
            {draw(issue.pages[slide.from])}
          </div>
          <div ref={incoming} className="pointer-events-none absolute inset-0">
            {draw(issue.pages[slide.to])}
          </div>
        </>
      ) : (
        draw(issue.pages[pageAt])
      )}
    </div>
  );

  const leaves = single ? onePage : (turning ?? resting);

  /**
   * A swipe across the book turns it — by finger only. A mouse dragged across
   * a page is selecting text or moving a plate, and must not turn it away.
   * Anything that takes hold of the pointer itself (a grip, a plate handle)
   * stops the event before it gets here.
   */
  const swipeFrom = useRef<number | null>(null);
  const onSwipeStart = (event: ReactPointerEvent<HTMLElement>) => {
    swipeFrom.current = event.pointerType === "touch" ? event.clientX : null;
  };
  const onSwipeEnd = (event: ReactPointerEvent<HTMLElement>) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (from === null) return;
    const dx = event.clientX - from;
    if (Math.abs(dx) > SWIPE) go(dx < 0 ? 1 : -1);
  };

  const moving = turn !== null || slide !== null;
  const first = single ? pageAt === 0 : at === 0;
  const last = single ? pageAt === issue.pages.length - 1 : at === spreads.length - 1;
  const where = single
    ? pageAt === 0
      ? "Cover"
      : `Page ${issue.pages[pageAt]?.folio ?? pageAt + 1}`
    : at === 0
      ? "Cover"
      : `Pages ${spread[0]?.folio}–${spread[1]?.folio ?? spread[0]?.folio}`;

  // Mounted only when there is something for it to do, so a read-only viewer
  // draws plates that cannot be picked up, pulled or moved.
  const editable =
    !moving && (onSwapPlates || onResizePlate || onPanPhoto || onEditBox || onEditCopy || onSketch) ? (
      <PlateEditProvider
        scale={scale}
        onSwap={onSwapPlates}
        onResize={onResizePlate}
        onPan={onPanPhoto}
        onEditBox={onEditBox}
        onEditCopy={onEditCopy}
        onSketch={onSketch}
      >
        {leaves}
      </PlateEditProvider>
    ) : (
      leaves
    );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div ref={stage} className="flex justify-center">
        <div
          style={{ width: (single ? PAGE.width : width) * scale, height: PAGE.height * scale }}
          className="relative touch-pan-y"
          onPointerDown={onSwipeStart}
          onPointerUp={onSwipeEnd}
        >
          {editable}
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => go(-1)}
          disabled={first || moving}
          aria-label="Previous spread"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm text-white/90 tabular-nums drop-shadow-sm">
          {where}
          <span className="text-white/60"> · {issue.pages.length} pages</span>
        </p>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => go(1)}
          disabled={last || moving}
          aria-label="Next spread"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <p className="-mt-2 text-center text-[11px] text-white/70 drop-shadow-sm">
        Use ← → keys, swipe, or {single ? "the arrows" : "drag a page by its edge"}
      </p>
    </div>
  );
}

/**
 * The strip along a page's outer edge that takes hold of it. Invisible until
 * the pointer finds it; then the corner lifts a little, the way a reader's
 * thumb lifts the corner of a page before turning it.
 */
function Grip({ side, onPointerDown }: { side: "left" | "right"; onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void }) {
  const right = side === "right";
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label={right ? "Turn the page" : "Turn back"}
      title={right ? "Drag to turn the page" : "Drag to turn back"}
      onPointerDown={onPointerDown}
      className="group/grip absolute top-0 bottom-0 z-40 cursor-grab touch-none active:cursor-grabbing"
      style={{ [right ? "right" : "left"]: 0, width: EDGE }}
    >
      <span
        aria-hidden
        className="absolute bottom-0 size-0 transition-[width,height] duration-300 ease-out group-hover/grip:size-9"
        style={{
          [right ? "right" : "left"]: 0,
          background: `linear-gradient(${right ? "to top left" : "to top right"}, rgba(0,0,0,0) 50%, #f5f5f4 50%, #e7e5e4 72%, #d6d3d1 100%)`,
          boxShadow: right ? "-3px -3px 6px rgba(0,0,0,0.12)" : "3px -3px 6px rgba(0,0,0,0.12)",
        }}
      />
    </div>
  );
}
