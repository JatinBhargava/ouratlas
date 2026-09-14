import type { CSSProperties } from "react";
import { ArrowRight, Download, Images, PenLine } from "lucide-react";
import { Link } from "react-router";

import { AlbumPreview } from "@/components/album-preview";
import { FaqSection } from "@/components/faq-section";
import { FeaturesSection } from "@/components/features-section";
import { HowItWorks } from "@/components/how-it-works";
import { PricingSection } from "@/components/pricing-section";
import { PhotoPile } from "@/components/photo-pile";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";

/** The three inputs, stated plainly under the hero. */
const BEATS = [
  { icon: Images, label: "Ten photos" },
  { icon: PenLine, label: "Your own words" },
  { icon: Download, label: "A magazine to keep" },
];

/**
 * The masthead sets itself line by line, the way a page is made up.
 *
 * In CSS (`animate-rise` in globals.css) rather than motion, because this page
 * now arrives as finished HTML from `build.ts`. An entrance run by JavaScript
 * starts every line invisible and holds it there until the bundle has
 * downloaded and run, which is exactly the wait the ready-made HTML removes.
 * A CSS animation starts with the first paint. The stagger is the one motion
 * had: 50 ms, then 90 ms more for each line.
 */
const line = (index: number): CSSProperties => ({ animationDelay: `${50 + index * 90}ms` });

export function Home() {
  return (
    <div className="flex flex-col gap-16 sm:gap-24 lg:gap-28">
      <section className="flex flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-5">
          <span
            style={line(0)}
            className="animate-rise flex items-center gap-3 text-[11px] font-medium tracking-[0.3em] text-white/70 uppercase drop-shadow-sm"
          >
            <span aria-hidden className="h-px w-8 bg-white/40" />
            Vol. I — your trip, in print
            <span aria-hidden className="h-px w-8 bg-white/40" />
          </span>

          <h1
            style={line(1)}
            className="font-editorial animate-rise max-w-3xl text-6xl leading-[1.02] tracking-tight text-white drop-shadow-lg sm:text-7xl"
          >
            The trip is over.
            <br />
            The <em className="italic">story</em> isn't.
          </h1>

          <p style={line(2)} className="animate-rise max-w-xl text-lg text-white/90 drop-shadow-sm">
            Ten photos and the story behind them, set as a magazine of your own trip — cover story, spreads, folios and
            all. Yours to export, never kept on our servers.
          </p>

          <div style={line(3)} className="animate-rise flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button size="lg" className="rounded-full" asChild>
              <Link to="/create">
                Start your story
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full text-white hover:bg-white/15 hover:text-white"
              asChild
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <ul
            style={line(4)}
            className="animate-rise flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-sm text-white/80"
          >
            {BEATS.map(beat => (
              <li key={beat.label} className="flex items-center gap-1.5">
                <beat.icon className="size-4" />
                {beat.label}
              </li>
            ))}
          </ul>
        </div>

        {/*
          Rises into place but no longer fades in. It holds the largest image on
          the page, and neither a reader nor Largest Contentful Paint counts an
          image that cannot be seen: the old fade, held back 0.45 s, kept the
          plate invisible for most of a second after it had loaded.
        */}
        <div className="animate-rise-plate w-full">
          <AlbumPreview />
        </div>
      </section>

      <Reveal>
        <HowItWorks />
      </Reveal>
      <PhotoPile />
      <Reveal>
        <FeaturesSection />
      </Reveal>
      <Reveal>
        <PricingSection />
      </Reveal>
      <Reveal>
        <FaqSection />
      </Reveal>
    </div>
  );
}
