/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { App } from "./App";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

/**
 * Hydrates the page the build already drew, or draws one from nothing.
 *
 * `build.ts` renders the home page into index.html and marks the root with the
 * address it drew. Hydrating keeps that markup and attaches React to it, so a
 * reader sees the page before the bundle has run instead of after.
 *
 * The mark is checked against the real address because a server may hand
 * index.html to some other path as a catch-all. Hydrating the cover's markup as
 * the desk would fail, so anything else is cleared and rendered fresh, the way
 * every page was before.
 */
function mount(): Root {
  if (elem.dataset.prerendered === window.location.pathname) return hydrateRoot(elem, app);
  elem.replaceChildren();
  const root = createRoot(elem);
  root.render(app);
  return root;
}

// Hydration starts as soon as the bundle runs. Deferring it until after the
// first paint was tried and measured (four alternated Lighthouse rounds, both
// throttling modes) and changed nothing beyond noise, so it is not done.
// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
if (import.meta.hot.data.root) import.meta.hot.data.root.render(app);
else import.meta.hot.data.root = mount();
