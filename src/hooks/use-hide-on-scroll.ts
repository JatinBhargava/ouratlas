import { useEffect, useRef, useState } from "react";

type Options = {
  /** Distance from the top before hiding is allowed, so the nav never flickers at rest. */
  threshold?: number;
  /** Movement needed before reacting, so trackpad jitter doesn't toggle the nav. */
  tolerance?: number;
};

/**
 * Reports whether a fixed header should be tucked away: true while the reader
 * is moving down the page, false as soon as they scroll back up or reach the top.
 */
export function useHideOnScroll({ threshold = 96, tolerance = 6 }: Options = {}) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const queued = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const update = () => {
      queued.current = false;
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < tolerance) return;
      setHidden(y > threshold && delta > 0);
      lastY.current = y;
    };

    const onScroll = () => {
      if (queued.current) return;
      queued.current = true;
      requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold, tolerance]);

  return hidden;
}
