import type { ReactNode } from "react";
import { MotionConfig, motion } from "motion/react";

type RevealProps = {
  children: ReactNode;
  /** Seconds to hold before starting, for staggering neighbours. */
  delay?: number;
  className?: string;
};

/**
 * Lifts a block into place the first time it scrolls into view.
 *
 * The same element whatever the reader's motion setting. The home page is
 * rendered to HTML at build time, where no setting can be read, and then
 * hydrated. Returning a plain `<div>` for reduced motion would draw different
 * markup in the browser than the build sent, and React keeps the server's
 * attributes on a mismatch: those readers would be left with sections held at
 * opacity 0. `reducedMotion="user"` makes the same choice inside the animation
 * instead, where it cannot change the markup: the rise is dropped and only the
 * fade remains.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  );
}
