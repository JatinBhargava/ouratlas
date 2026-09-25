import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";

import { AuthProvider } from "@/lib/auth";
import { RootLayout } from "@/layouts/RootLayout";
import { Home } from "@/pages/Home";
import { NotFound } from "@/pages/NotFound";
import { Pricing } from "@/pages/Pricing";
import { About } from "@/pages/legal/About";
import { Contact } from "@/pages/legal/Contact";
import { Privacy } from "@/pages/legal/Privacy";
import { Refunds } from "@/pages/legal/Refunds";
import { Terms } from "@/pages/legal/Terms";
import "@/styles/globals.css";

/**
 * The desk and the account page, fetched only when someone goes to them.
 *
 * Between them they carry the magazine engine, the PDF press
 * (modern-screenshot), the layout designer and the type and theme panels —
 * none of which the cover, the plans or the legal pages use. In the first
 * bundle, every reader of the home page downloaded and parsed all of it before
 * seeing a word. The home page and the small pages stay eager: they are what
 * arrives from search and shared links, and a second round trip before their
 * first paint would cost more than it saves.
 *
 * The return from Google lands on /create after a full page load, and the
 * desk decides whether to hold the interlude from `isSignInReturn()`. That is
 * recorded when `lib/auth` first runs, so this chunk arriving after the code
 * has been spent and tidied out of the address does not change the answer.
 *
 * Both pages are named exports, re-wrapped as the default `lazy` expects.
 */
const Create = lazy(() => import("@/pages/Create").then(module => ({ default: module.Create })));
const Account = lazy(() => import("@/pages/Account").then(module => ({ default: module.Account })));
// A shared magazine and the archive: the book and the sealing, nothing more.
const Read = lazy(() => import("@/pages/Read").then(module => ({ default: module.Read })));
const Magazines = lazy(() => import("@/pages/Magazines").then(module => ({ default: module.Magazines })));

/**
 * Everything inside the router, so a router can be chosen from outside.
 *
 * The browser wraps it in `BrowserRouter` (below). `build.ts` renders the home
 * page ahead of time through `src/prerender.tsx`, which wraps the same tree in
 * a `StaticRouter` fixed at "/". Both routers draw no element of their own, so
 * the markup they produce is identical, which hydration depends on.
 */
export function AppRoutes() {
  return (
    <>
      {/* Inside the router so sign-in can send people back where they were. */}
      <AuthProvider>
        <RootLayout>
          {/* No fallback drawn: the nav and the scene are already on screen,
              the wait is one small request, and there is nothing below the
              page for a placeholder's removal to shift. */}
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create" element={<Create />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/account" element={<Account />} />
              <Route path="/magazines" element={<Magazines />} />
              <Route path="/read" element={<Read />} />

              {/* Real pages, not placeholders: a merchant of record checks that
                  these exist and are reachable before it will process payments. */}
              <Route path="/about" element={<About />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refunds" element={<Refunds />} />
              <Route path="/contact" element={<Contact />} />
              {/* Last, and matching anything left: an address with no page of
                  its own arrives as 404.html, and React Router still has to
                  draw something for it. */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </RootLayout>

        {/*
          Vercel's own instrumentation: page views and Core Web Vitals for the
          frontend only — the API is on Render and is not covered.

          Both are cookieless and collect no personal data, which matters here:
          photographs and story text are never stored, and nothing about them is
          measured. Both scripts are served from the deployment, so they
          are inert anywhere other than Vercel, development included.

          Inside the router on purpose — that is what lets them attribute views
          to /create and /account rather than recording every visit as "/".
        */}
        <Analytics />
        <SpeedInsights />
      </AuthProvider>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
