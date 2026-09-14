/**
 * GSAP, fetched when an animation is about to be wanted rather than with the page.
 *
 * Only two things on the home page use it, both well below the first screen:
 * the photo pile dealing itself out, and the album scene cycling spreads on
 * hover. Imported statically, it was about 45 KB gzipped that every reader
 * downloaded and parsed before the page could respond, and most never scroll
 * that far. Each loader is a dynamic import, which the bundler splits into its
 * own file.
 *
 * The promise is shared so two callers fetch once, and forgotten on failure so
 * a dropped connection can be retried by the next hover or scroll rather than
 * leaving the animation switched off for the visit.
 */

import type { gsap as GsapCore } from "gsap";

export type Gsap = typeof GsapCore;

let core: Promise<Gsap> | null = null;
let scrolling: Promise<Gsap> | null = null;

export function loadGsap(): Promise<Gsap> {
  core ??= import("gsap")
    .then(module => module.gsap)
    .catch(error => {
      core = null;
      throw error;
    });
  return core;
}

/** GSAP with ScrollTrigger registered, for animations that wait to be scrolled to. */
export function loadScrollTrigger(): Promise<Gsap> {
  scrolling ??= Promise.all([loadGsap(), import("gsap/ScrollTrigger")])
    .then(([gsap, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      return gsap;
    })
    .catch(error => {
      scrolling = null;
      throw error;
    });
  return scrolling;
}
