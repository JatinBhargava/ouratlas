import { Fragment } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { Link, useLocation } from "react-router";

import { AtlasMark } from "@/components/atlas-mark";
import { AuthMenu } from "@/components/auth-menu";
import { Button } from "@/components/ui/button";
import { useActiveSection } from "@/hooks/use-active-section";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { useScrollProgress } from "@/hooks/use-scroll-progress";
import { cn } from "@/lib/utils";

type SiteNavProps = {
  /** Visitors to date. Placeholder until a counter is wired up. */
  visitors?: number;
};

/** Sections on the route, in the order you walk them. */
const STOPS = [
  { id: "how-it-works", label: "Production" },
  { id: "features", label: "Contents" },
  { id: "pricing", label: "Subscribe" },
  { id: "faq", label: "Letters" },
] as const;

const STOP_IDS = STOPS.map(stop => stop.id);
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Floating navigation shaped like a trail: a compass mark, then each section as
 * a waypoint on a dashed route that lights up as the reader passes it.
 */
export function SiteNav({ visitors = 12480 }: SiteNavProps) {
  const hidden = useHideOnScroll();
  const progress = useScrollProgress();
  const active = useActiveSection([...STOP_IDS]);
  const isLanding = useLocation().pathname === "/";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-4 z-50 flex justify-center px-4 transition-transform duration-300 ease-out motion-reduce:transition-none print:hidden",
        hidden && "-translate-y-[200%]",
      )}
    >
      <nav className="relative flex w-full max-w-5xl items-center justify-between gap-3 overflow-hidden rounded-full border border-white/50 bg-white/70 py-2 pr-2 pl-3 shadow-lg shadow-black/10 backdrop-blur-md">
        {/* Distance covered, drawn along the foot of the pill. */}
        <span
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-sky-500 to-emerald-500 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />

        <Link
          to="/"
          className="group font-editorial flex shrink-0 items-center gap-2 pl-1 text-2xl tracking-tight text-stone-900"
        >
          <AtlasMark />
          Atlas
        </Link>

        {/* The route itself — only meaningful where those sections exist. */}
        <div className={cn("hidden items-center md:flex", !isLanding && "md:hidden")}>
          {STOPS.map((stop, i) => (
            <Fragment key={stop.id}>
              {i > 0 && <span className="w-4 border-t border-dashed border-stone-400/70 lg:w-6" aria-hidden />}
              <a
                href={`#${stop.id}`}
                aria-label={stop.label}
                title={stop.label}
                aria-current={active === stop.id ? "true" : undefined}
                className={cn(
                  "group flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm transition-colors",
                  active === stop.id ? "text-stone-900" : "text-stone-600 hover:text-stone-900",
                )}
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full border transition-all",
                    active === stop.id
                      ? "border-emerald-600 bg-emerald-600 ring-4 ring-emerald-600/20"
                      : "border-stone-400 bg-white group-hover:border-stone-600",
                  )}
                />
                <span className="hidden whitespace-nowrap lg:inline">{stop.label}</span>
              </a>
            </Fragment>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isLanding && (
            <Link
              to="/"
              className="mr-1 hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-stone-600 transition-colors hover:text-stone-900 sm:flex"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
          )}

          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full px-2 text-sm text-stone-600 xl:flex",
              !isLanding && "xl:hidden",
            )}
            title="Travellers who have passed through"
          >
            <Users className="size-3.5" />
            <span className="font-medium text-stone-800 tabular-nums">{compact.format(visitors)}</span>
            visited
          </span>

          <AuthMenu />

          {isLanding && (
            <Button size="sm" className="rounded-full" asChild>
              <Link to="/create">Start a story</Link>
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
}
