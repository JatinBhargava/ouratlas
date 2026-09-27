/**
 * Whether this page is running inside the Android or iPhone app.
 *
 * Capacitor's native side injects `window.Capacitor` into the web view before
 * any page script runs, and its `isNativePlatform()` is what `@capacitor/core`
 * itself answers from. Read directly rather than by importing that package, so
 * a website visitor downloads nothing extra to learn they are on the website.
 * The plugins the app needs later will import `@capacitor/core` from the chunks
 * that use them.
 *
 * False while prerendering in `build.ts`, where there is no `window`: the
 * prerendered page is the website's, and the app hydrates it.
 */

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function inApp(): boolean {
  if (typeof window === "undefined") return false;
  const capacitor = (window as { Capacitor?: CapacitorGlobal }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}
