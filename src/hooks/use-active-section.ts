import { useEffect, useRef, useState } from "react";

/**
 * Tracks which of the given section ids is currently in view, so the nav can
 * show the reader where they are on the route.
 *
 * Visibility is accumulated across callbacks: an IntersectionObserver only
 * reports entries whose intersection *changed*, so a section that is still on
 * screen from an earlier callback would otherwise be missed.
 */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  const visible = useRef(new Set<string>());
  const key = ids.join(",");

  useEffect(() => {
    const elements = ids.map(id => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const seen = visible.current;
    seen.clear();

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        // Earliest stop on the route wins, so the marker moves in reading order.
        setActive(ids.find(id => seen.has(id)) ?? null);
      },
      // A band across the upper-middle of the view: a section counts as "here"
      // once it leads the screen, and stops counting once it has mostly passed.
      { rootMargin: "-20% 0px -55% 0px", threshold: 0 },
    );

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [key]);

  return active;
}
