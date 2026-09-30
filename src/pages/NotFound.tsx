import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, PenLine, Undo2 } from "lucide-react";
import { Link, useLocation } from "react-router";

import { Picture } from "@/components/picture";
import { Button } from "@/components/ui/button";
import { SAMPLE_PHOTOS } from "@/lib/sample-photos";
import { cn } from "@/lib/utils";

/** The cover's own size; on a phone the whole stage is scaled down around it. */
const COVER = { width: 300, height: 400 };

/** How close to home, in cover pixels, a piece has to be let go to snap into place. */
const SNAP = 40;

/**
 * The three pieces the cover was torn into, as clip paths over one whole cover.
 *
 * The tears are shared point for point, so the pieces meet with no gap and no
 * overlap when they are home. Each is scattered to a fixed spot (not a random
 * one) so the page draws the same on every visit, and closer in on a phone,
 * where the stage is narrower than the pieces' full scatter.
 */
const PIECES = [
  {
    clip: "polygon(0 0, 56% 0, 52% 8%, 57% 15%, 53% 24%, 58% 33%, 54% 42%, 59% 50%, 55% 58%, 48% 61%, 40% 57%, 31% 62%, 22% 58%, 13% 63%, 6% 59%, 0 62%)",
    scatter: { x: -150, y: -24, rotate: -11 },
  },
  {
    clip: "polygon(56% 0, 100% 0, 100% 64%, 92% 60%, 84% 65%, 75% 60%, 66% 64%, 59% 59%, 55% 58%, 59% 50%, 54% 42%, 58% 33%, 53% 24%, 57% 15%, 52% 8%)",
    scatter: { x: 160, y: -48, rotate: 13 },
  },
  {
    clip: "polygon(0 62%, 6% 59%, 13% 63%, 22% 58%, 31% 62%, 40% 57%, 48% 61%, 55% 58%, 59% 59%, 66% 64%, 75% 60%, 84% 65%, 92% 60%, 100% 64%, 100% 100%, 0 100%)",
    scatter: { x: -10, y: 120, rotate: -6 },
  },
];

type Offset = { x: number; y: number };
const home = (offset: Offset) => offset.x === 0 && offset.y === 0;

/** An Atlas cover, whole. Drawn once per piece and clipped, so every tear lines up with the next. */
function Cover() {
  return (
    <div className="relative size-full overflow-hidden bg-[#f4efe6] text-stone-900">
      <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-3 text-[8px] font-medium tracking-[0.22em] uppercase">
        <span>No. 404</span>
        <span>The missing issue</span>
      </div>
      <div className="font-editorial absolute top-5 left-3.5 text-[92px] leading-none tracking-tight">Atlas</div>
      <Picture photo={SAMPLE_PHOTOS.cityFromHill} alt="" draggable={false} className="absolute inset-x-4 top-[122px] h-[178px] w-[268px] object-cover" />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1.5">
        <span className="w-fit bg-[#b4562c] px-1.5 py-0.5 text-[8px] font-bold tracking-[0.2em] text-white uppercase">Cover story</span>
        <p className="font-editorial text-[30px] leading-[0.95]">
          The page that <em>got away</em>
        </p>
        <p className="text-[9px] tracking-[0.16em] text-stone-600 uppercase">Four days, one missing page</p>
      </div>
    </div>
  );
}

/** Where to turn instead, set as a contents page: real destinations, with the lost one struck through. */
const CONTENTS = [
  { title: "Start a story", to: "/create", folio: "03" },
  { title: "Atlas Studio", to: "/studio", folio: "12" },
  { title: "Plans and prices", to: "/pricing", folio: "24" },
  { title: "What’s new", to: "/whats-new", folio: "31" },
];

/**
 * The page for an address that isn't one.
 *
 * A single-page app answers every path with the same shell, so without this a
 * mistyped URL would render an empty layout and look broken. It keeps the
 * magazine's voice — a page pulled before press — and makes it literal: the
 * issue's cover lies torn in three, and the reader can drag it back together.
 *
 * The puzzle is a small pleasure, not a gate. Every way out (the buttons, the
 * contents list) works without touching it, and "Put it back" does the whole
 * thing for anyone who cannot or would rather not drag, with the result
 * announced for screen readers.
 */
export function NotFound() {
  const { pathname } = useLocation();
  // The cover arrives whole and tears a moment later: the error happening,
  // rather than already happened. Until then it is not a puzzle to solve.
  const [offsets, setOffsets] = useState<Offset[]>(() => PIECES.map(() => ({ x: 0, y: 0 })));
  const [torn, setTorn] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [top, setTop] = useState<number[]>([0, 1, 2]);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; pointer: number; from: Offset; start: Offset; scale: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reach = window.innerWidth < 640 ? 0.55 : 1;
      setOffsets(PIECES.map(piece => ({ x: piece.scatter.x * reach, y: piece.scatter.y * reach })));
      setTorn(true);
    }, 500);
    return () => window.clearTimeout(timer);
  }, []);

  const solved = torn && offsets.every(home);

  const grab = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!torn || solved) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // The stage is scaled down on a phone; the pointer moves in screen pixels.
    const scale = (stage.current?.getBoundingClientRect().width ?? COVER.width) / COVER.width;
    drag.current = { index, pointer: event.pointerId, from: { x: event.clientX, y: event.clientY }, start: offsets[index]!, scale };
    setDragging(index);
    setTop(order => [...order.filter(entry => entry !== index), index]);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    const next = {
      x: current.start.x + (event.clientX - current.from.x) / current.scale,
      y: current.start.y + (event.clientY - current.from.y) / current.scale,
    };
    setOffsets(all => all.map((offset, index) => (index === current.index ? next : offset)));
  };

  const drop = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(null);
    setOffsets(all =>
      all.map((offset, index) => (index === current.index && Math.hypot(offset.x, offset.y) < SNAP ? { x: 0, y: 0 } : offset)),
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center sm:py-10">
      <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
        <span aria-hidden className="h-px w-6 bg-white/40" />
        Erratum · No. 404
        <span aria-hidden className="h-px w-6 bg-white/40" />
      </span>

      <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md sm:text-6xl">
        This page was pulled
        <br />
        before it went to press.
      </h1>

      <p className="max-w-prose text-white/90 drop-shadow-sm">
        Nothing is set at <code className="rounded bg-black/20 px-1.5 py-0.5 text-sm break-all">{pathname}</code>. The cover took the hit — drag it back
        together, or turn to a page that exists. Your own issues are unaffected: they live in your browser, not here.
      </p>

      {/* The stage: room around the cover for its scattered pieces, scaled down whole on a phone. */}
      <div className="flex h-[400px] w-full items-center justify-center overflow-hidden sm:h-[560px] sm:overflow-visible">
        <div
          ref={stage}
          role="img"
          aria-label={solved ? "An Atlas cover, whole again" : "An Atlas cover torn into three pieces"}
          className="relative shrink-0 scale-[0.62] sm:scale-100"
          style={{ width: COVER.width, height: COVER.height }}
        >
          {/* Where the cover belongs: a faint outline, so there is somewhere to aim. */}
          <div aria-hidden className={cn("absolute inset-0 rounded-sm border-2 border-dashed border-white/40 transition-opacity", solved && "opacity-0")} />
          {PIECES.map((piece, index) => {
            const offset = offsets[index]!;
            const distance = Math.hypot(offset.x, offset.y);
            // The piece straightens as it nears home, so the last few pixels feel like fitting, not placing.
            const rotate = piece.scatter.rotate * Math.min(1, distance / 160);
            return (
              <div
                key={index}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0",
                  dragging !== index && "transition-transform duration-500 ease-[cubic-bezier(.2,.9,.25,1.15)] motion-reduce:transition-none",
                )}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${dragging === index ? 1.04 : 1})`,
                  zIndex: top.indexOf(index) + 1,
                  filter: solved ? "drop-shadow(0 24px 40px rgba(0,0,0,.35))" : "drop-shadow(0 14px 18px rgba(0,0,0,.35))",
                }}
              >
                <div
                  onPointerDown={grab(index)}
                  onPointerMove={move}
                  onPointerUp={drop}
                  onPointerCancel={drop}
                  className={cn("pointer-events-auto size-full touch-none select-none", solved ? "cursor-default" : dragging === index ? "cursor-grabbing" : "cursor-grab")}
                  style={{ clipPath: solved ? "none" : piece.clip }}
                >
                  <Cover />
                </div>
              </div>
            );
          })}
          {solved && (
            <span className="absolute -top-4 -right-6 z-10 rotate-12 rounded-sm border-2 border-[#b4562c] bg-[#f4efe6] px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-[#b4562c] uppercase shadow-lg">
              Restored
            </span>
          )}
        </div>
      </div>

      <p aria-live="polite" className="min-h-6 text-white drop-shadow-sm">
        {solved ? (
          <span className="font-editorial text-2xl">There it is. The cover was here all along.</span>
        ) : (
          <span className="text-sm text-white/75">Three pieces. Drag them home.</span>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!solved && (
          <Button variant="secondary" className="rounded-full" onClick={() => setOffsets(PIECES.map(() => ({ x: 0, y: 0 })))}>
            <Undo2 className="size-4" />
            Put it back
          </Button>
        )}
        <Button asChild className="rounded-full">
          <Link to="/create">
            <PenLine className="size-4" />
            Start a story
          </Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back to the cover
          </Link>
        </Button>
      </div>

      <nav aria-label="Pages that exist" className="mt-4 w-full max-w-md rounded-2xl bg-[#f4efe6] p-6 text-left text-stone-900 shadow-lg shadow-black/10">
        <p className="text-[11px] font-medium tracking-[0.28em] text-[#b4562c] uppercase">Contents</p>
        <p className="font-editorial mt-1 text-3xl">Turn to instead</p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {CONTENTS.map(entry => (
            <li key={entry.to}>
              <Link to={entry.to} className="group flex items-baseline gap-2 hover:text-[#b4562c]">
                <span className="group-hover:underline group-hover:underline-offset-4">{entry.title}</span>
                <span aria-hidden className="grow border-b border-dotted border-stone-400" />
                <span className="font-editorial text-lg tabular-nums">{entry.folio}</span>
              </Link>
            </li>
          ))}
          <li className="flex items-baseline gap-2 text-stone-500">
            <span className="line-through decoration-[#b4562c] decoration-2">The page you wanted</span>
            <span aria-hidden className="grow border-b border-dotted border-stone-300" />
            <span className="font-editorial text-lg text-[#b4562c] tabular-nums">404</span>
          </li>
        </ul>
      </nav>
    </div>
  );
}
