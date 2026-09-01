import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MagazinePage } from "@/components/magazine/pages";
import { Button } from "@/components/ui/button";
import { PAGE } from "@/lib/magazine/geometry";
import type { Issue, Page } from "@/lib/magazine/types";
import { cn } from "@/lib/utils";

/** Gap between the two leaves of an open spread. */
const BINDING = 2;

/** The cover stands alone; everything after it reads as verso and recto. */
function toSpreads(pages: Page[]): Page[][] {
  if (pages.length === 0) return [];
  const spreads: Page[][] = [[pages[0]!]];
  for (let i = 1; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));
  return spreads;
}

export function IssueView({ issue, className }: { issue: Issue; className?: string }) {
  const spreads = useMemo(() => toSpreads(issue.pages), [issue.pages]);
  const [index, setIndex] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const spread = spreads[index] ?? [];
  const width = spread.length === 2 ? PAGE.width * 2 + BINDING : PAGE.width;

  // Pages are drawn at print size and scaled down to whatever room there is,
  // so text wraps identically at every viewport.
  useLayoutEffect(() => {
    const host = stage.current;
    if (!host) return;
    const fit = () => setScale(Math.min(1, host.clientWidth / width));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [width]);

  const go = (step: number) => setIndex(current => Math.min(spreads.length - 1, Math.max(0, current + step)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spreads.length]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div ref={stage} className="flex justify-center">
        <div
          style={{ width: width * scale, height: PAGE.height * scale }}
          className="relative"
        >
          <div
            style={{ width, height: PAGE.height, scale: `${scale}`, transformOrigin: "top left" }}
            className={cn("flex shadow-2xl shadow-black/25", spread.length === 1 && "mx-auto")}
          >
            {spread.map(page => (
              <MagazinePage
                key={page.id}
                page={page}
                title={issue.title}
                dateline={issue.dateline}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous spread"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm text-white/90 tabular-nums drop-shadow-sm">
          {index === 0 ? "Cover" : `Pages ${spread[0]?.folio}–${spread[1]?.folio ?? spread[0]?.folio}`}
          <span className="text-white/60"> · {issue.pages.length} pages</span>
        </p>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => go(1)}
          disabled={index === spreads.length - 1}
          aria-label="Next spread"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
