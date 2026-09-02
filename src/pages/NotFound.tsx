import { ArrowLeft, PenLine } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

/**
 * The page for an address that isn't one.
 *
 * A single-page app answers every path with the same shell, so without this a
 * mistyped URL would silently render an empty layout and look broken. Written
 * in the magazine's own voice — a page pulled before press — and offering the
 * two places anyone arriving here actually wants.
 */
export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
        <span aria-hidden className="h-px w-6 bg-white/40" />
        Error 404
        <span aria-hidden className="h-px w-6 bg-white/40" />
      </span>

      <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md sm:text-6xl">
        This page was pulled
        <br />
        before it went to press.
      </h1>

      <p className="max-w-prose text-white/90 drop-shadow-sm">
        Nothing is set at this address. Your own issues are unaffected — they live in your browser, not here.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button asChild className="rounded-full">
          <Link to="/create">
            <PenLine className="size-4" />
            Start a story
          </Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back to the cover
          </Link>
        </Button>
      </div>
    </div>
  );
}
