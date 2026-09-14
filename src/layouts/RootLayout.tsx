import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";

import { BetaNotice } from "@/components/beta-notice";
import { SceneBackground } from "@/components/scene-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { applyHead } from "@/lib/seo";

/**
 * App shell. The marketing footer belongs to the landing page; the album
 * workspace stays clear of it.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  /**
   * Keeps the title, description, canonical and robots tag in step with the
   * page being shown.
   *
   * Each route is now served with its own head, written by `build.ts` from
   * the same table, so on a first load this changes nothing. It matters on
   * navigation inside the app, where no new document arrives and the tab
   * would otherwise keep the previous page's title — and it only ever sets
   * the values the server sent for that address, which is what Google asks of
   * a canonical set by script.
   */
  useEffect(() => {
    applyHead(pathname);
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
