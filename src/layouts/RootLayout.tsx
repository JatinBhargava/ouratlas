import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";

import { BetaNotice } from "@/components/beta-notice";
import { SceneBackground } from "@/components/scene-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

/** The site's own origin, which the canonical link must be absolute against. */
const SITE = "https://ouratlas.co.in";

/**
 * App shell. The marketing footer belongs to the landing page; the album
 * workspace stays clear of it.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  /**
   * Keeps the canonical link pointing at the page actually being shown.
   *
   * `index.html` is one file serving every route, so its canonical is written
   * for the home page. Left alone it would tell a crawler that /pricing and
   * /create are duplicates of / — the opposite of what a canonical is for, and
   * enough to keep them out of the index entirely.
   */
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (link) link.href = new URL(pathname, SITE).toString();
  }, [pathname]);

  return (
    <div className="relative flex min-h-screen flex-col">
      <SceneBackground />
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl grow px-4 pt-24 pb-12 sm:px-6 sm:pt-32 sm:pb-20 print:max-w-none print:p-0">
        <BetaNotice />
        {children}
      </main>
      {isLanding && <SiteFooter />}
    </div>
  );
}
