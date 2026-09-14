import { useEffect, useRef } from "react";

import { SectionHeading } from "@/components/section-heading";
import { loadScrollTrigger, type Gsap } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { Picture } from "@/components/picture";
import { SAMPLE_PHOTOS } from "@/lib/sample-photos";

/**
 * Five prints dealt out on a table — overlapping, none of them straight.
 * Positions are hand-placed rather than generated so the pile reads as
 * deliberately careless instead of evenly spaced.
 *
 * Each card is drawn at its resting angle in its own inline style, so the pile
 * is already laid out in the pre-rendered HTML and for anyone whose browser
 * never fetches GSAP. GSAP takes over the transform once it arrives, for the
 * deal-in and the hover, so rotation lives here as a number rather than a
 * utility class: a Tailwind `rotate-*` would be overwritten by the inline
 * transform anyway.
 */
const PILE = [
  {
    src: SAMPLE_PHOTOS.cityFromHill,
    caption: "the whole city",
    alt: "Aerial view of a city spreading toward distant hills, a large domed cathedral at its centre",
    place: "left-[0%] top-[8%] sm:left-[1%] sm:top-[6%]",
    rotate: -9,
    z: 20,
  },
  {
    src: SAMPLE_PHOTOS.farmhouse,
    caption: "nobody home",
    alt: "A stone farmhouse with shuttered windows, terracotta urns and pots of red geraniums",
    place: "left-[16%] top-[44%] sm:left-[20%] sm:top-[36%]",
    rotate: 5,
    z: 10,
  },
  {
    src: SAMPLE_PHOTOS.gull,
    caption: "breakfast guest",
    alt: "A person in a wetsuit on a small boat holding food up to a gull in flight over the sea",
    place: "left-[33%] top-[2%] sm:left-[38%] sm:top-[2%]",
    rotate: -4,
    z: 30,
  },
  {
    src: SAMPLE_PHOTOS.cafeTerrace,
    caption: "before noon",
    alt: "A café terrace with white-clothed tables and cane chairs beneath a red awning",
    place: "left-[49%] top-[46%] sm:left-[55%] sm:top-[38%]",
    rotate: 8,
    z: 10,
  },
  {
    src: SAMPLE_PHOTOS.palms,
    caption: "shutters, palms",
    alt: "Palm trees against a clear blue sky above pastel apartment buildings with green shutters",
    place: "left-[64%] top-[10%] sm:left-[73%] sm:top-[8%]",
    rotate: -11,
    z: 20,
  },
];

/** Where each card pivots, for the deal-in, the hover and the resting angle alike. */
const ORIGIN = "50% 60%";

/** How far below the screen the pile is when GSAP is sent for: well before a reader gets there. */
const FETCH_AHEAD = "800px";

const prefersStill = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function PhotoPile() {
  const table = useRef<HTMLDivElement>(null);
  const engine = useRef<Gsap | null>(null);

  useEffect(() => {
    const host = table.current;
    if (!host) return;

    let cancelled = false;
    let revert: (() => void) | undefined;

    const arm = (gsap: Gsap) => {
      if (cancelled) return;
      engine.current = gsap;

      // Nothing to animate for readers who would rather things sat still. And
      // if the pile is already on screen when the library lands (a restored
      // scroll position, a very quick reader), the prints are resting where they
      // belong: sweeping them away to deal them back in would read as a glitch.
      if (prefersStill() || host.getBoundingClientRect().top < window.innerHeight) return;

      const context = gsap.context(() => {
        const cards = gsap.utils.toArray<HTMLElement>(".pile-card");
        gsap.set(cards, { rotate: 0, x: 0, y: 70, scale: 0.9, opacity: 0, transformOrigin: ORIGIN });
        gsap.to(cards, {
          rotate: (i: number) => PILE[i]!.rotate,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.75,
          ease: "power3.out",
          stagger: 0.09,
          scrollTrigger: { trigger: host, start: "top 78%", once: true },
        });
      }, host);
      revert = () => context.revert();
    };

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        // A failed fetch leaves the pile at rest, which is how it was drawn.
        loadScrollTrigger().then(arm, () => {});
      },
      { rootMargin: `${FETCH_AHEAD} 0px` },
    );
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      revert?.();
    };
  }, []);

  const lift = (element: HTMLElement, index: number, up: boolean) => {
    const gsap = engine.current;
    // Before GSAP has arrived the prints simply stay put under the pointer.
    if (!gsap || prefersStill()) return;
    gsap.set(element, { zIndex: up ? 40 : PILE[index]!.z });
    gsap.to(element, {
      rotate: up ? 0 : PILE[index]!.rotate,
      scale: up ? 1.06 : 1,
      y: up ? -8 : 0,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <section className="flex flex-col gap-8">
      <SectionHeading
        kicker="The archive"
        title="Already in print"
        description="A few of the places people brought home — the pictures are only half of it."
      />

      <div ref={table} className="relative mx-auto h-110 w-full max-w-3xl sm:h-120">
        {PILE.map((photo, i) => (
          <figure
            key={photo.alt}
            style={{ zIndex: photo.z, transform: `rotate(${photo.rotate}deg)`, transformOrigin: ORIGIN }}
            onMouseEnter={event => lift(event.currentTarget, i, true)}
            onMouseLeave={event => lift(event.currentTarget, i, false)}
            className={cn(
              "pile-card absolute w-[35%] rounded-md bg-white p-1.5 pb-6 shadow-xl shadow-black/25 sm:w-[25%] sm:p-2 sm:pb-7",
              photo.place,
            )}
          >
            <Picture
              photo={photo.src}
              alt={photo.alt}
              loading="lazy"
              decoding="async"
              className="aspect-4/5 w-full rounded-xs object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-1.5 text-center font-serif text-[11px] text-stone-500 italic sm:bottom-2 sm:text-xs">
              {photo.caption}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
