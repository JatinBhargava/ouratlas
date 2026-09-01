import { ArrowRight, Download, Images, PenLine } from "lucide-react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "motion/react";

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

/** The masthead sets itself line by line, the way a page is made up. */
const MASTHEAD = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const LINE = {
  hidden: { opacity: 0, y: 22 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

export function Home() {
  const reduce = useReducedMotion();
  const variants = reduce ? undefined : MASTHEAD;
  const line = reduce ? undefined : LINE;

  return (
    <div className="flex flex-col gap-28">
      <section className="flex flex-col items-center gap-10 text-center">
        <motion.div
          className="flex flex-col items-center gap-5"
          variants={variants}
          initial={reduce ? undefined : "hidden"}
          animate={reduce ? undefined : "shown"}
        >
          <motion.span
            variants={line}
            className="flex items-center gap-3 text-[11px] font-medium tracking-[0.3em] text-white/70 uppercase drop-shadow-sm"
          >
            <span aria-hidden className="h-px w-8 bg-white/40" />
            Vol. I — your trip, in print
            <span aria-hidden className="h-px w-8 bg-white/40" />
          </motion.span>

          <motion.h1
            variants={line}
            className="font-editorial max-w-3xl text-6xl leading-[1.02] tracking-tight text-white drop-shadow-lg sm:text-7xl"
          >
            The trip is over.
            <br />
            The <em className="italic">story</em> isn't.
          </motion.h1>

          <motion.p variants={line} className="max-w-xl text-lg text-white/90 drop-shadow-sm">
            Ten photos and the story behind them, set as a magazine of your own trip — cover story, spreads, folios and
            all. Yours to export, never kept on our servers.
          </motion.p>

          <motion.div variants={line} className="flex flex-wrap items-center justify-center gap-3 pt-1">
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
          </motion.div>

          <motion.ul
            variants={line}
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-2 text-sm text-white/80"
          >
            {BEATS.map(beat => (
              <li key={beat.label} className="flex items-center gap-1.5">
                <beat.icon className="size-4" />
                {beat.label}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          className="w-full"
          initial={reduce ? undefined : { opacity: 0, y: 40 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <AlbumPreview />
        </motion.div>
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
