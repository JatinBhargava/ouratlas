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

export function render(location: string): string {
  return renderToString(
    <StrictMode>
      <StaticRouter location={location}>
        <AppRoutes />
      </StaticRouter>
    </StrictMode>,
  );
}
