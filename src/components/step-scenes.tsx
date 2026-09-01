import { useEffect, useRef } from "react";
import gsap from "gsap";
import { Download } from "lucide-react";

import { cn } from "@/lib/utils";
import { PHOTO_SWATCHES } from "@/lib/palette";
import { SAMPLE_PHOTOS } from "@/lib/sample-photos";

/** A photograph, over a coloured swatch that shows while the file loads. */
function Shot({ src, swatch, className }: { src: string; swatch: string; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("bg-linear-to-br object-cover", swatch, className)}
    />
  );
}

/** Step one: a handful of pictures, fanned as if just tipped out. */
export function PhotoStackScene() {
  return (
    <div className="relative flex h-32 items-center justify-center">
      <div
        style={{ transitionDelay: "90ms" }}
        className="absolute -translate-x-12 -rotate-12 rounded-lg bg-white p-1 shadow-lg shadow-black/15 transition-transform duration-300 ease-out motion-safe:group-hover:-translate-x-[4.5rem] motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-[19deg] motion-reduce:transition-none"
      >
        <Shot src={SAMPLE_PHOTOS.farmhouse} swatch={PHOTO_SWATCHES[1]} className="h-16 w-13 rounded" />
      </div>
      <div
        style={{ transitionDelay: "45ms" }}
        className="absolute translate-x-12 rotate-[9deg] rounded-lg bg-white p-1 shadow-lg shadow-black/15 transition-transform duration-300 ease-out motion-safe:group-hover:translate-x-[4.5rem] motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:rotate-[17deg] motion-reduce:transition-none"
      >
        <Shot src={SAMPLE_PHOTOS.cityFromHill} swatch={PHOTO_SWATCHES[2]} className="h-16 w-13 rounded" />
      </div>
      <div className="relative rounded-lg bg-white p-1 shadow-xl shadow-black/20 transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-1.5 motion-safe:group-hover:scale-105 motion-reduce:transition-none">
        <Shot src={SAMPLE_PHOTOS.palms} swatch={PHOTO_SWATCHES[0]} className="h-20 w-16 rounded" />
      </div>
    </div>
  );
}

/** Bar heights for the waveform, fixed so the scene never jitters. */
const WAVE = [28, 52, 40, 78, 96, 64, 88, 44, 70, 100, 58, 34, 62, 46, 24];

/**
 * Step two: a voice mid-transcription. The copy stops in the middle of a word
 * with the caret still blinking, so the panel reads as work in progress.
 */
export function StoryScene() {
  return (
    <div className="flex h-32 flex-col justify-center gap-3">
      <div className="flex h-8 items-center justify-center gap-0.75">
        {WAVE.map((height, i) => (
          <span
            key={i}
            className="animate-wave w-0.75 rounded-full bg-emerald-700/70"
            style={{
              height: `${Math.max(12, height)}%`,
              // Offset and vary each bar so the row ripples instead of pulsing as one.
              animationDelay: `${(i % 5) * -170}ms`,
              animationDuration: `${820 + (i % 4) * 190}ms`,
            }}
          />
        ))}
      </div>

      <div className="rounded-lg bg-white/90 p-2.5 shadow-sm ring-1 ring-black/5">
        <p className="text-left text-[6px] leading-[1.75] text-stone-600">
          We left the hut at four, when the valley below was still only a rumour and the loudest thing on the mountain
          was our own boots on the loose stone. For the first hour nobody spo
          <span
            aria-hidden
            className="animate-caret ml-px inline-block h-[6px] w-px translate-y-px bg-stone-800 align-baseline"
          />
        </p>
      </div>
    </div>
  );
}


/** Tiny magazine furniture, shared by the spread layouts. */
const RUBRIC = "text-[3.5px] font-medium tracking-[0.2em] text-stone-400 uppercase";
const COPY = "hyphens-auto text-justify text-[3.5px] leading-[1.7] text-stone-500";
const HEAD = "font-editorial text-stone-900 leading-[1.1]";

/**
 * Three ways the same trip can be set. Each spread uses different pictures and
 * a different arrangement, so cycling them shows off the layout themes rather
 * than just shuffling photographs.
 */
const SPREADS = [
  // One plate given the page, feature opposite.
  <>
    <div className="flex flex-col gap-1 rounded-l-md border-r border-stone-200 p-2">
      <Shot src={SAMPLE_PHOTOS.daisies} swatch={PHOTO_SWATCHES[0]} className="aspect-3/2 w-full rounded-xs" />
      <p className="text-[3.5px] tracking-[0.14em] text-stone-400 uppercase">Plate II — the meadow</p>
      <p className={COPY}>
        She carried them the whole way down and would not let anyone else take a turn.
      </p>
    </div>
    <div className="flex flex-col gap-1 rounded-r-md p-2">
      <span className={RUBRIC}>Feature</span>
      <p className={cn(HEAD, "text-[7px]")}>We walked out before the light came up</p>
      <p className={COPY}>
        We left the hut at four, when the valley below was still only a rumour and the loudest thing on the mountain was
        our own boots on the loose stone. For the first hour nobody spoke. There was nothing worth saying that the light
        was not already saying better.
      </p>
      <Shot src={SAMPLE_PHOTOS.rooftops} swatch={PHOTO_SWATCHES[3]} className="aspect-5/2 w-full rounded-xs" />
    </div>
  </>,

  // Paired plates, text running long opposite.
  <>
    <div className="flex flex-col gap-1 rounded-l-md border-r border-stone-200 p-2">
      <div className="grid grid-cols-2 gap-1">
        <Shot src={SAMPLE_PHOTOS.gull} swatch={PHOTO_SWATCHES[1]} className="aspect-3/4 w-full rounded-xs" />
        <Shot src={SAMPLE_PHOTOS.cafeTerrace} swatch={PHOTO_SWATCHES[2]} className="aspect-3/4 w-full rounded-xs" />
      </div>
      <p className="text-[3.5px] tracking-[0.14em] text-stone-400 uppercase">Plates IV & V</p>
      <p className={COPY}>
        The square filled slowly after that, the way squares do, and we sat until the light went hard.
      </p>
    </div>
    <div className="flex flex-col gap-1 rounded-r-md p-2">
      <span className={RUBRIC}>Dispatch</span>
      <p className={cn(HEAD, "text-[6px]")}>Breakfast, shared with a gull</p>
      <p className={COPY}>
        He came out of the glare without a sound and hung there, close enough that we could see the wind moving through
        his feathers. Nobody reached for a camera until it was nearly too late. By eight we were down among the olive
        terraces and somebody produced a thermos, which is the part of the day I remember most clearly.
      </p>
    </div>
  </>,

  // Full-page plate, pull quote opposite.
  <>
    <div className="relative rounded-l-md border-r border-stone-200">
      {/* Positioned out of flow: at intrinsic aspect this portrait plate would
          stretch the grid row past the page. */}
      <Shot src={SAMPLE_PHOTOS.cityFromHill} swatch={PHOTO_SWATCHES[3]} className="absolute inset-1.5 rounded-xs" />
    </div>
    <div className="flex flex-col justify-center gap-1 rounded-r-md p-2">
      <span className={RUBRIC}>Portfolio</span>
      <p className={cn(HEAD, "text-[6.5px] italic")}>
        “The whole city, laid out like something you could carry.”
      </p>
      <p className={COPY}>We climbed an hour to look at it and said almost nothing.</p>
      <Shot src={SAMPLE_PHOTOS.farmhouse} swatch={PHOTO_SWATCHES[1]} className="aspect-5/2 w-full rounded-xs" />
    </div>
  </>,
];

const SWAP_INTERVAL = 1900;

/**
 * Step three: the finished spread. Hovering sends the whole spread flying off
 * the card and brings the next layout in behind it.
 */
export function AlbumScene() {
  const stage = useRef<HTMLDivElement>(null);
  const active = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const swap = () => {
    const host = stage.current;
    if (!host || busy.current) return;

    const decks = Array.from(host.querySelectorAll<HTMLElement>("[data-spread]"));
    const leaving = decks[active.current];
    const nextIndex = (active.current + 1) % decks.length;
    const arriving = decks[nextIndex];
    if (!leaving || !arriving) return;

    busy.current = true;
    // A short entry: the card no longer clips, so a big offset would show the
    // incoming spread sitting over the heading below.
    gsap.set(arriving, { zIndex: 1, opacity: 0, x: -18, y: 12, rotate: -4, scale: 0.94 });
    gsap.set(leaving, { zIndex: 2 });

    gsap
      .timeline({
        onComplete: () => {
          active.current = nextIndex;
          busy.current = false;
        },
      })
      // The whole spread lifts off the card and away over the shoulder.
      .to(leaving, { x: 210, y: -140, rotate: 17, scale: 0.82, opacity: 0, duration: 0.6, ease: "power2.in" })
      .to(arriving, { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, duration: 0.55, ease: "power3.out" }, 0.22);
  };

  const start = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (timer.current) return;
    swap();
    timer.current = setInterval(swap, SWAP_INTERVAL);
  };

  const stop = () => {
    if (!timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  return (
    <div ref={stage} className="relative flex h-32 items-center justify-center" onMouseEnter={start} onMouseLeave={stop}>
      {SPREADS.map((spread, i) => (
        <div
          key={i}
          data-spread
          style={{ opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 2 : 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="grid h-full w-full max-w-60 grid-cols-2 overflow-hidden rounded-md bg-white shadow-xl shadow-black/20 ring-1 ring-black/5">
            {spread}
          </div>
        </div>
      ))}

      <span className="absolute -right-1 -bottom-1 z-10 flex size-8 items-center justify-center rounded-full bg-emerald-700 text-white shadow-lg shadow-black/20 transition-transform duration-300 ease-out motion-safe:group-hover:scale-115 motion-reduce:transition-none">
        <Download className="size-4" />
      </span>
    </div>
  );
}
