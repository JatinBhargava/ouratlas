/**
 * The app rendered to HTML, for `build.ts` to write into a page ahead of time.
 *
 * Built by `build.ts` as a separate Bun bundle, never shipped to the browser.
 * It goes through the same bundler, plugins and `BUN_PUBLIC_*` values as the
 * browser bundle, so image addresses carry the same content hashes and
 * build-time switches (sign-in, checkout) draw the same way: markup that
 * differed from what the browser renders would fail hydration.
 *
 * `StrictMode` is kept to match `frontend.tsx` exactly, for the same reason.
 */

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router";

import { AppRoutes } from "./App";

/**
 * Drawn until it stops changing, and every drawing but the last thrown away.
 *
 * A page behind `lazy()` in App.tsx (the studio is one) is not there the
 * first time: `renderToString` cannot wait, so it writes the Suspense
 * fallback, which is nothing. That first pass is what starts the import, and
 * in this bundle the import is already in memory, so one turn of the event
 * loop later the second pass finds the page loaded and draws it. An eager page
 * such as the home page comes out the same both times.
 *
 * `prerender` from react-dom/static waits by itself, but it writes a resolved
 * boundary as a template plus an inline script that moves it into place, and
 * a crawler that runs no script would read an empty page.
 */
export async function render(location: string): Promise<string> {
  const app = (
    <StrictMode>
      <StaticRouter location={location}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>
  );
  // Usually twice. A Journal post is a lazy page holding a lazy body, and
  // each pass can only start the import it reaches, so it needs a third. The
  // cap is there so a page that never settles fails the build's <h1> check
  // instead of hanging it.
  let markup = renderToString(app);
  for (let pass = 0; pass < 5; pass++) {
    await new Promise(resolve => setTimeout(resolve));
    const next = renderToString(app);
    if (next === markup) break;
    markup = next;
  }
  return markup;
}
