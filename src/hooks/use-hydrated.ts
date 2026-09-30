import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * False while a page is being drawn ahead of time or hydrated, true in every
 * other render in the browser.
 *
 * `build.ts` draws the public pages at build time, with no query string, no
 * window and no reader. Anything that draws from those (a shelf in the
 * address, a measured width) has to wait for this before it may differ from
 * the build's markup: hydration keeps the build's attributes without checking
 * them, so a difference would stay wrong on screen.
 *
 * `useSyncExternalStore` rather than a `useEffect` that flips a flag: a page
 * reached by a link inside the app, where nothing was drawn ahead, gets true
 * on its very first render instead of spending one frame on the build's
 * version.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false,
  );
}
