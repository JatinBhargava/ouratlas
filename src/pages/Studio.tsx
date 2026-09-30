import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { FillIn } from "@/components/studio/fill-in";
import { PageFrame, useSize } from "@/components/studio/page-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHydrated } from "@/hooks/use-hydrated";
import { loadStudio, STUDIO_GROUPS, type StudioGroup, type StudioPage, type StudioSection } from "@/lib/studio";
import { cn } from "@/lib/utils";

/** How far off screen, in px, a page's frame is made ahead of being scrolled to. */
const MARGIN = 600;

/**
 * Whether an element is on screen or close to it.
 *
 * Every page is a document of its own, and two hundred of them live at once
 * held a few hundred megabytes on a phone. A page's frame is made as it
 * scrolls near and dropped again once it is well past, so only a screenful or
 * two ever exist.
 */
function useNear(ref: RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Measured once at once, for the same reason as `useSize`: the pages on
    // screen when the studio opens should not wait a frame for the observer.
    const { top, bottom } = element.getBoundingClientRect();
    setNear(bottom > -MARGIN && top < window.innerHeight + MARGIN);
    const observer = new IntersectionObserver(([entry]) => setNear(entry!.isIntersecting), { rootMargin: `${MARGIN}px 0px` });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return near;
}

function PageCard({ page, onOpen }: { page: StudioPage; onOpen: () => void }) {
  const box = useRef<HTMLButtonElement>(null);
  const { width } = useSize(box);
  const near = useNear(box);
  const spread = page.width > page.height;
  return (
    <li className={cn("flex flex-col gap-2", spread && "col-span-2")}>
      <button
        ref={box}
        type="button"
        onClick={onOpen}
        aria-label={`Open “${page.title}”`}
        className="block w-full rounded-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 motion-reduce:transition-none"
      >
        <PageFrame page={page} width={width} live={near} />
      </button>
      <span className="text-sm text-stone-700">{page.title}</span>
    </li>
  );
}

type Place = { section: StudioSection; page: StudioPage };

/**
 * One page as large as the window allows, with the pages either side of it a
 * key press away.
 */
function Viewer({
  places,
  index,
  onMove,
  onClose,
  onUse,
}: {
  places: Place[];
  index: number;
  onMove: (index: number) => void;
  onClose: () => void;
  /** Opens the fill-in editor on a page id, or on a whole section by its id. */
  onUse: (target: string) => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const size = useSize(stage);
  const place = places[index]!;
  const { page, section } = place;

  // Focus into the viewer, and back to the page that opened it on the way out.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && index > 0) onMove(index - 1);
      else if (event.key === "ArrowRight" && index < places.length - 1) onMove(index + 1);
      else return;
      event.preventDefault();
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [index, places.length, onMove, onClose]);

  const width = Math.max(0, Math.min(size.width, (size.height * page.width) / page.height));
  const step = "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${page.title}, ${section.name}`} className="fixed inset-0 z-60 flex flex-col bg-stone-950/92 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4 px-4 pt-4 pb-3 text-white sm:px-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[11px] tracking-[0.24em] text-white/60 uppercase">{section.name}</span>
          <h2 className="font-editorial truncate text-2xl sm:text-3xl">{page.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full bg-white text-stone-900 hover:bg-white/90" onClick={() => onUse(page.id)}>
              Use this layout
            </Button>
            {section.group === "issues" && (
              <Button size="sm" variant="outline" className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => onUse(section.id)}>
                Use the whole issue ({section.pages.length} pages)
              </Button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-white/60 tabular-nums">
            {index + 1} / {places.length}
          </span>
          <button
            ref={close}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 px-4 pb-4 sm:px-20 sm:pb-8">
        <button type="button" className={cn(step, "left-2 sm:left-5")} disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Previous page">
          <ChevronLeft className="size-5" />
        </button>
        <div ref={stage} className="flex min-h-0 flex-1 items-center justify-center">
          <PageFrame key={page.id} page={page} width={width} live label={`${page.title} — ${section.name}`} />
        </div>
        <button
          type="button"
          className={cn(step, "right-2 sm:right-5")}
          disabled={index === places.length - 1}
          onClick={() => onMove(index + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Atlas Studio: every layout from the editors' drawing board, on four shelves —
 * one-page magazines, the pages an issue is made of, new ideas, and complete
 * issues page by page.
 *
 * Any page, or any complete issue, opens in the fill-in editor (`FillIn`) to
 * be made the reader's own: their photographs in its frames, their words on
 * its lines, downloaded as a PDF or PNG.
 *
 * The shelf, the open page and the layout in use live in the address
 * (`?shelf=`, `?page=`, `?use=`), so any of them can be sent as a link and the
 * back button closes them.
 */
export function Studio() {
  const [params, setParams] = useSearchParams();
  // The shelf in the address is honoured only once the page is in the
  // browser: `build.ts` draws /studio with no query (see `useHydrated`). The
  // shelves are empty until the pages arrive, so nothing but the pill's colour
  // waits.
  const hydrated = useHydrated();
  const shelf = (hydrated && STUDIO_GROUPS.find(group => group.id === params.get("shelf"))?.id) || "all";
  const open = params.get("page");

  const [sections, setSections] = useState<StudioSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStudio()
      .then(list => !cancelled && setSections(list))
      .catch(() => !cancelled && setError("The studio could not be loaded. Check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => (sections ?? []).filter(section => shelf === "all" || section.group === shelf), [sections, shelf]);
  const places = useMemo(() => shown.flatMap(section => section.pages.map(page => ({ section, page }))), [shown]);
  const openIndex = places.findIndex(place => place.page.id === open);

  const counts = useMemo(() => {
    const tally = new Map<StudioGroup | "all", number>();
    for (const section of sections ?? []) {
      tally.set(section.group, (tally.get(section.group) ?? 0) + section.pages.length);
      tally.set("all", (tally.get("all") ?? 0) + section.pages.length);
    }
    return tally;
  }, [sections]);

  const choose = (next: StudioGroup | "all") => setParams(next === "all" ? {} : { shelf: next }, { replace: true });

  // Opening pushes a history entry so the back button closes the page; moving
  // between pages replaces it, so back does not walk through every one seen.
  // Closing a page opened here steps back over that entry. One that arrived in
  // the address has nothing of ours behind it, so it is replaced instead.
  const opened = useRef(false);
  const navigate = useNavigate();
  const shut = () => {
    if (opened.current) {
      opened.current = false;
      navigate(-1);
    } else show(null, true);
  };
  const show = (id: string | null, replace: boolean) =>
    setParams(
      current => {
        const next = new URLSearchParams(current);
        if (id) next.set("page", id);
        else next.delete("page");
        return next;
      },
      { replace },
    );

  // The fill-in editor, over everything else. `?use=` holds a page id for one
  // page, or a section id for a whole issue, and follows the same history rule
  // as the viewer: opened here, closing steps back; arrived at, it is replaced.
  const use = params.get("use");
  const using = useMemo(() => {
    if (!use || !sections) return null;
    for (const section of sections) {
      if (section.id === use) return { title: section.name, pages: section.pages };
      const page = section.pages.find(entry => entry.id === use);
      if (page) return { title: `${section.name} · ${page.title}`, pages: [page] };
    }
    return null;
  }, [use, sections]);
  const usedHere = useRef(false);
  const startUsing = (target: string) => {
    usedHere.current = true;
    setParams(current => {
      const next = new URLSearchParams(current);
      next.set("use", target);
      return next;
    });
  };
  const stopUsing = () => {
    if (usedHere.current) {
      usedHere.current = false;
      navigate(-1);
      return;
    }
    setParams(
      current => {
        const next = new URLSearchParams(current);
        next.delete("use");
        return next;
      },
      { replace: true },
    );
  };

  const pill = (on: boolean) =>
    cn(
      "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors",
      on ? "bg-stone-900 text-white" : "bg-white/80 text-stone-700 ring-1 ring-stone-200 hover:text-stone-900",
    );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          The drawing board
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">Atlas Studio</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          Every layout the editors have drawn: one-page magazines in a dozen moods, the pages an issue is built from, ideas still on the table, and complete
          issues from cover to colophon. Open any page, then press Use this layout to put your own photos and words in it.
        </p>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          For a trip, a wedding, a birthday or an ordinary Sunday. Your photographs stay in your browser: download a PDF with no account, or a PNG of a
          single page, or press Save &amp; share for a link, which seals the pages before they leave.
        </p>
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-8 py-2">
          <div role="group" aria-label="Shelf" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {([{ id: "all", label: "Everything" }, ...STUDIO_GROUPS] as const).map(group => (
              <button key={group.id} type="button" aria-pressed={shelf === group.id} className={pill(shelf === group.id)} onClick={() => choose(group.id)}>
                {group.label}
                {sections && <span className="text-xs tabular-nums opacity-60">{counts.get(group.id) ?? 0}</span>}
              </button>
            ))}
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : sections === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-stone-400" />
            </div>
          ) : (
            shown.map(section => (
              <section key={section.id} aria-labelledby={`studio-${section.id}`} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 border-b border-stone-200 pb-3">
                  <h2 id={`studio-${section.id}`} className="font-editorial text-3xl text-stone-900">
                    {section.name}
                  </h2>
                  {section.blurb && <p className="text-sm text-stone-600">{section.blurb}</p>}
                  {section.group === "issues" && (
                    <Button size="sm" variant="outline" className="mt-2 w-fit rounded-full" onClick={() => startUsing(section.id)}>
                      Use the whole issue
                    </Button>
                  )}
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                  {section.pages.map(page => (
                    <PageCard
                      key={page.id}
                      page={page}
                      onOpen={() => {
                        opened.current = true;
                        show(page.id, false);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {/* What each shelf holds, from `STUDIO_GROUPS` rather than the pages,
              so it is in the HTML the build draws. Everything else here is a
              picture in a frame, and without these lines a crawler that runs
              no script learns only the page's name. Plain text, not links: a
              link per shelf would hand crawlers four copies of this page to
              sort out. Inside the card, because over the scene the words
              crossed the pale path and could not be read. */}
          <section aria-labelledby="studio-shelves" className="flex flex-col gap-4 border-t border-stone-200 pt-6">
            <h2 id="studio-shelves" className="font-editorial text-2xl text-stone-900">
              On the shelves
            </h2>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {STUDIO_GROUPS.map(group => (
                <div key={group.id} className="flex flex-col gap-1">
                  <dt className="text-sm font-medium text-stone-900">{group.label}</dt>
                  <dd className="text-sm text-stone-600">{group.blurb}</dd>
                </div>
              ))}
            </dl>
          </section>
        </CardContent>
      </Card>

      {openIndex >= 0 && (
        <Viewer places={places} index={openIndex} onMove={index => show(places[index]!.page.id, true)} onClose={shut} onUse={startUsing} />
      )}
      {using && <FillIn key={use} id={use!} title={using.title} pages={using.pages} onClose={stopUsing} />}
    </div>
  );
}
