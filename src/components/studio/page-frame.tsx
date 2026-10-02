import { useLayoutEffect, useMemo, useState, type Ref, type RefObject } from "react";

import { pageDocument, type StudioPage } from "@/lib/studio";
import { cn } from "@/lib/utils";

/**
 * The size an element is drawn at, kept current as the window changes.
 *
 * Read once straight away as well as observed: an observer reports only after
 * the next frame is laid out, and until then every page would be drawn at no
 * size at all.
 */
export function useSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    setSize({ width, height });
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry!.contentRect.width, height: entry!.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** How far off screen, in px, a page's frame is made ahead of being scrolled to. */
const MARGIN = 600;

/**
 * Whether an element is on screen or close to it.
 *
 * Every page is a document of its own, and two hundred of them live at once
 * held a few hundred megabytes on a phone. A page's frame is made as it
 * scrolls near and dropped again once it is well past, so only a screenful or
 * two ever exist.
 */
export function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measured once at once, for the same reason as `useSize`: the pages on
    // screen when the studio opens should not wait a frame for the observer.
    const { top, bottom } = element.getBoundingClientRect();
    setNear(bottom > -MARGIN && top < window.innerHeight + MARGIN);
    const observer = new IntersectionObserver(([entry]) => setNear(entry!.isIntersecting), { rootMargin: `${MARGIN}px 0px` });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return near;
}

type Props = {
  page: StudioPage;
  width: number;
  /** False draws the page's outline only; the frame is made once it is true. */
  live: boolean;
  /** Names the frame for assistive technology. Without one the frame is hidden from it, as a decoration of the button around it. */
  label?: string;
  /** The page can be typed into and clicked, rather than only looked at. */
  interactive?: boolean;
  frameRef?: Ref<HTMLIFrameElement>;
  onLoad?: (frame: HTMLIFrameElement) => void;
};

/**
 * One page, drawn at its own size and scaled to `width`.
 *
 * Scaled rather than laid out at the smaller size: the pages are fixed-size
 * print layouts, and reflowing one into a card would draw a different page.
 * See `pageDocument` for why each is a frame.
 */
export function PageFrame({ page, width, live, label, interactive = false, frameRef, onLoad }: Props) {
  const source = useMemo(() => pageDocument(page), [page]);
  const scale = width / page.width;
  return (
    <div className="relative overflow-hidden bg-stone-200 shadow-sm" style={{ width, height: page.height * scale }}>
      {live && width > 0 && (
        <iframe
          ref={frameRef}
          srcDoc={source}
          sandbox="allow-same-origin"
          tabIndex={interactive ? undefined : -1}
          title={label ?? ""}
          aria-hidden={label ? undefined : true}
          onLoad={event => onLoad?.(event.currentTarget)}
          className={cn("absolute top-0 left-0 origin-top-left border-0", !interactive && "pointer-events-none")}
          style={{ width: page.width, height: page.height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}
