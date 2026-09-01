import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { SceneBackground } from "@/components/scene-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

/**
 * App shell. The marketing footer belongs to the landing page; the album
 * workspace stays clear of it.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const isLanding = useLocation().pathname === "/";

  return (
    <div className="relative flex min-h-screen flex-col">
      <SceneBackground />
      <SiteNav />
      <main className="mx-auto w-full max-w-5xl grow px-6 pt-32 pb-20">{children}</main>
      {isLanding && <SiteFooter />}
    </div>
  );
}
