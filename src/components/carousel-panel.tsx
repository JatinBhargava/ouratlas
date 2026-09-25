import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Dialog } from "radix-ui";
import { ArrowLeft, Check, Download, Loader2, Share2, X } from "lucide-react";

import { MagazinePage } from "@/components/magazine/pages";
import { PrintSheet } from "@/components/magazine/print-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { canShareSlides, defaultSlides, pressSlides, shareSlides, SLIDE, slidesMax } from "@/lib/magazine/carousel";
import { PAGE } from "@/lib/magazine/geometry";
import { saveBlob, slugOf } from "@/lib/magazine/press";
import type { Issue, Page } from "@/lib/magazine/types";
import { zipOf } from "@/lib/zip";
import { cn } from "@/lib/utils";

/** How wide a page is drawn in the picker. */
const THUMB = 92;

/**
 * The issue as a carousel: choose the pages, have each drawn as a picture,
 * then send them through the share sheet or take them as a zip.
 *
 * Two steps on purpose, not one button. A share sheet opens only straight
 * from a tap, and drawing twenty pages takes longer than a browser lets a tap
 * count as fresh — so the drawing happens first, and the tap that shares is
 * its own.
 */
export function CarouselPanel({
  issue,
  tilt,
  sketches,
  open,
  onOpenChange,
  onPress,
}: {
  issue: Issue;
  tilt?: number;
  sketches?: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Asked before any page is drawn, and the same question an export asks:
   * whether this account may send another issue out. False stops here.
   */
  onPress: () => Promise<boolean>;
}) {
  /** Asked once: the browser does not change under a mounted page. */
  const [max] = useState(slidesMax);
  const [chosen, setChosen] = useState(() => defaultSlides(issue.pages, max));
  const [pressing, setPressing] = useState(false);
  const [done, setDone] = useState(0);
  const [slides, setSlides] = useState<File[] | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  /**
   * Bumped whenever what is being drawn stops mattering — the panel closed or
   * the issue recomposed — so a run still finishing its last page lands nowhere.
   */
  const run = useRef(0);

  // A recomposed issue is a different magazine: its pages start chosen afresh
  // and slides drawn from the old one are dropped.
  useEffect(() => {
    run.current++;
    setChosen(defaultSlides(issue.pages, max));
    setSlides(null);
    setPressing(false);
  }, [issue]);

  // Previews made and revoked together, in an effect rather than a memo, so a
  // double-run effect cannot revoke URLs that are still on screen.
  useEffect(() => {
    if (!slides) return setPreviews([]);
    const urls = slides.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [slides]);

  const shareable = useMemo(() => (slides ? canShareSlides(slides) : false), [slides]);
  const picked = useMemo(() => issue.pages.filter(page => chosen.has(page.index)), [issue.pages, chosen]);

  const close = (next: boolean) => {
    if (!next) {
      run.current++;
      setSlides(null);
      setPressing(false);
      setFailed(null);
    }
    onOpenChange(next);
  };

  const toggle = (page: Page) =>
    setChosen(current => {
      const next = new Set(current);
      if (next.has(page.index)) next.delete(page.index);
      else if (next.size < max) next.add(page.index);
      return next;
    });

  const press = async () => {
    setFailed(null);
    const mine = ++run.current;
    if (!(await onPress()) || mine !== run.current) return;

    // Mounted synchronously so its leaves exist to be drawn on the next line.
    flushSync(() => {
      setDone(0);
      setPressing(true);
    });
    try {
      const leaves = [...(sheet.current?.children ?? [])] as HTMLElement[];
      const files = await pressSlides(leaves, issue.title, n => mine === run.current && setDone(n));
      if (mine === run.current) setSlides(files);
    } catch {
      if (mine === run.current) setFailed("The pages could not be drawn on this device. Try fewer pages, or a computer.");
    } finally {
      if (mine === run.current) setPressing(false);
    }
  };

  const share = async (files: File[]) => {
    setFailed(null);
    try {
      await shareSlides(files);
    } catch (cause) {
      // Refused while an earlier sheet is still open; saying so is the whole fix.
      setFailed(
        cause instanceof DOMException && cause.name === "InvalidStateError"
          ? "The share sheet is already open."
          : "The share sheet would not open. Try again, or download the slides instead.",
      );
    }
  };

  const download = async () => {
    if (!slides) return;
    saveBlob(await zipOf(slides), `${slugOf(issue.title)}-carousel.zip`);
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={close}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(calc(100vw-2rem),760px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 text-stone-800 shadow-2xl sm:p-6"
            // Nothing in here is worth focusing first; the page grid is long.
            onOpenAutoFocus={event => event.preventDefault()}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium tracking-[0.28em] text-stone-500 uppercase">Circulation</span>
                <Dialog.Title className="font-editorial text-2xl tracking-tight">Post it as a carousel</Dialog.Title>
                <Dialog.Description className="text-sm text-stone-600">
                  Each page becomes one picture, {SLIDE.width} × {SLIDE.height} — Instagram's portrait size, and the
                  page's own shape, so nothing is cropped. Drawn on this device; nothing is uploaded.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </header>

            {slides ? (
              <Ready
                previews={previews}
                slides={slides}
                shareable={shareable}
                onShare={share}
                onDownload={download}
                onBack={() => setSlides(null)}
              />
            ) : pressing ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="size-5 animate-spin text-stone-500" />
                <p className="text-sm text-stone-600 tabular-nums">
                  Setting slide {Math.min(done + 1, picked.length)} of {picked.length}
                </p>
                <Progress value={(done / Math.max(1, picked.length)) * 100} className="w-48" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-stone-600 tabular-nums">
                    <span className="font-medium text-stone-900">{chosen.size}</span> of {issue.pages.length} pages
                    chosen
                    {issue.pages.length > max && <> · one carousel takes {max} here</>}
                  </p>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => setChosen(defaultSlides(issue.pages, max))}
                    >
                      Pick for me
                    </button>
                    <button type="button" className="underline underline-offset-2" onClick={() => setChosen(new Set())}>
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                  {issue.pages.map(page => {
                    const on = chosen.has(page.index);
                    const full = !on && chosen.size >= max;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => toggle(page)}
                        disabled={full}
                        aria-pressed={on}
                        aria-label={page.folio === null ? "Cover" : `Page ${page.folio}`}
                        className={cn(
                          "group relative flex flex-col items-center gap-1 rounded-md transition",
                          full && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <span
                          className={cn(
                            "relative block overflow-hidden rounded-sm ring-2 transition",
                            on ? "ring-stone-900" : "opacity-60 ring-transparent group-hover:opacity-90",
                          )}
                          style={{ width: THUMB, height: (THUMB * PAGE.height) / PAGE.width }}
                        >
                          <span
                            inert
                            className="pointer-events-none absolute top-0 left-0 block"
                            style={{ width: PAGE.width, height: PAGE.height, scale: `${THUMB / PAGE.width}`, transformOrigin: "top left" }}
                          >
                            <MagazinePage
                              page={page}
                              title={issue.title}
                              dateline={issue.dateline}
                              polished={issue.polished}
                              theme={issue.theme}
                              tilt={tilt}
                              type={issue.type}
                              palette={issue.palette}
                              sketches={sketches}
                            />
                          </span>
                          {on && (
                            <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-stone-900 text-[10px] font-medium text-white tabular-nums">
                              {picked.findIndex(p => p.index === page.index) + 1}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-stone-500 tabular-nums">
                          {page.folio === null ? "Cover" : page.folio}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end border-t border-stone-200 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
                  <Button className="rounded-full" disabled={chosen.size === 0} onClick={() => void press()}>
                    <Check className="size-4" />
                    Make {chosen.size} {chosen.size === 1 ? "slide" : "slides"}
                  </Button>
                </div>
              </>
            )}

            {failed && (
              <p className="text-center text-xs text-red-600" role="alert">
                {failed}
              </p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* The chosen pages at full size, off the edge of the screen, only while
          they are being drawn — the same sheet a phone's PDF is drawn from. */}
      {pressing && <PrintSheet ref={sheet} issue={{ ...issue, pages: picked }} tilt={tilt} sketches={sketches} offscreen />}
    </>
  );
}

/** The drawn slides, and the ways out with them. */
function Ready({
  previews,
  slides,
  shareable,
  onShare,
  onDownload,
  onBack,
}: {
  previews: string[];
  slides: File[];
  shareable: boolean;
  onShare: (files: File[]) => void;
  onDownload: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-5 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {previews.map((url, n) => (
          <img
            key={url}
            src={url}
            alt={`Slide ${n + 1}`}
            className="h-44 shrink-0 snap-start rounded-sm shadow-md"
            style={{ aspectRatio: `${SLIDE.width} / ${SLIDE.height}` }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="rounded-full" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Choose other pages
        </Button>
        <div className="flex flex-wrap gap-2">
          {shareable && (
            <Button className="rounded-full" onClick={() => onShare(slides)}>
              <Share2 className="size-4" />
              Share
            </Button>
          )}
          <Button variant={shareable ? "secondary" : "default"} className="rounded-full" onClick={onDownload}>
            <Download className="size-4" />
            Download all
          </Button>
        </div>
      </div>

      <p className="text-xs text-stone-500">
        In the share sheet, pick Instagram, WhatsApp or Save to Photos. If an app takes one picture at a time, save
        them to your photos and select them in order when you post — they are numbered.
      </p>
    </div>
  );
}
