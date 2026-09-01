import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { SectionHeading } from "@/components/section-heading";
import { cn } from "@/lib/utils";

import { SAMPLE_PHOTOS } from "@/lib/sample-photos";

gsap.registerPlugin(ScrollTrigger);

/**
 * Five prints dealt out on a table — overlapping, none of them straight.
 * Positions are hand-placed rather than generated so the pile reads as
 * deliberately careless instead of evenly spaced.
 *
 * GSAP owns every transform on these cards (the deal-in, the resting angle and
 * the hover), so rotation lives here as a number rather than a utility class —
 * a Tailwind `rotate-*` would be overwritten by the inline transform anyway.
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

export function PhotoPile() {
  const table = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".pile-card");
      const settled = (i: number) => ({ rotate: PILE[i]!.rotate, x: 0, y: 0, scale: 1, opacity: 1 });

      // Nothing to animate for readers who would rather things sat still.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cards.forEach((card, i) => gsap.set(card, settled(i)));
        return;
      }

      gsap.set(cards, { rotate: 0, x: 0, y: 70, scale: 0.9, opacity: 0, transformOrigin: "50% 60%" });

      gsap.to(cards, {
        rotate: (i: number) => PILE[i]!.rotate,
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 0.75,
        ease: "power3.out",
        stagger: 0.09,
        scrollTrigger: { trigger: table.current, start: "top 78%", once: true },
      });
    }, table);

    return () => context.revert();
  }, []);

  const lift = (element: HTMLElement, index: number, up: boolean) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
            key={photo.src}
            style={{ zIndex: photo.z }}
            onMouseEnter={event => lift(event.currentTarget, i, true)}
            onMouseLeave={event => lift(event.currentTarget, i, false)}
            className={cn(
              "pile-card absolute w-[35%] rounded-md bg-white p-1.5 pb-6 shadow-xl shadow-black/25 sm:w-[25%] sm:p-2 sm:pb-7",
              photo.place,
            )}
          >
            <img
              src={photo.src}
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
