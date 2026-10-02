import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

import { PageFrame, useNear, useSize } from "@/components/studio/page-frame";
import { Button } from "@/components/ui/button";
import { fitsSheet } from "@/lib/poster/from-studio";
import { loadStudio, STUDIO_GROUPS, type StudioGroup, type StudioPage, type StudioSection } from "@/lib/studio";
import { cn } from "@/lib/utils";

function Choice({ page, busy, disabled, onPick }: { page: StudioPage; busy: boolean; disabled: boolean; onPick: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  const { width } = useSize(button);
  const near = useNear(button);
  return (
    <li className="flex flex-col gap-1.5">
      <button
        ref={button}
        type="button"
        disabled={disabled}
        onClick={onPick}
        aria-label={`Use “${page.title}”`}
        className="relative block w-full rounded-sm ring-1 ring-stone-200 transition-shadow hover:ring-2 hover:ring-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait"
      >
        <PageFrame page={page} width={width} live={near} />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-5 animate-spin text-stone-700" />
          </span>
        )}
      </button>
      <span className="text-xs leading-snug text-stone-600">{page.title}</span>
    </li>
  );
}

type Props = {
  /** What choosing does, for the heading: set this page, or add one. */
  title: string;
  /** A section to list first: the theme the page beside it came from. */
  prefer?: string;
  /** The page being taken apart into boxes, while the reader waits. */
  busy: string | null;
  onPick: (section: StudioSection, page: StudioPage) => void;
  onClose: () => void;
};

/**
 * Every Atlas Studio layout the page can take, on the studio's own shelves.
 *
 * Only pages of the sheet's shape are offered: a two-page spread would have to
 * be squeezed into one. Each thumbnail is a frame of its own, made only as it
 * scrolls near, as on the studio's page.
 */
export function StudioPicker({ title, prefer, busy, onPick, onClose }: Props) {
  const [sections, setSections] = useState<StudioSection[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shelf, setShelf] = useState<StudioGroup | "all">("all");
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadStudio()
      .then(list => !cancelled && setSections(list))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus in, the page behind held still, and Escape closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", keys);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keys);
      opener?.focus();
    };
  }, [onClose]);

  const shown = useMemo(() => {
    const list = (sections ?? [])
      .filter(section => shelf === "all" || section.group === shelf)
      .map(section => ({ ...section, pages: section.pages.filter(fitsSheet) }))
      .filter(section => section.pages.length > 0);
    return [...list.filter(section => section.id === prefer), ...list.filter(section => section.id !== prefer)];
  }, [sections, shelf, prefer]);

  const pill = (on: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-1 text-xs transition-colors",
      on ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:text-stone-900",
    );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="studio-picker-title" className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/60 p-3 sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-stone-50 shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] tracking-[0.24em] text-stone-500 uppercase">Atlas Studio</span>
              <h2 id="studio-picker-title" className="font-editorial text-2xl text-stone-900">
                {title}
              </h2>
              <p className="text-xs text-stone-500">Every word, photo and shape comes in as a box you can move, restyle or delete. Page numbers follow the page.</p>
            </div>
            <Button ref={close} variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              <X className="size-5" />
            </Button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button type="button" className={pill(shelf === "all")} aria-pressed={shelf === "all"} onClick={() => setShelf("all")}>
              Everything
            </button>
            {STUDIO_GROUPS.map(group => (
              <button key={group.id} type="button" className={pill(shelf === group.id)} aria-pressed={shelf === group.id} onClick={() => setShelf(group.id)}>
                {group.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {failed && <p className="text-sm text-red-600">The layouts could not be loaded. Check your connection and try again.</p>}
          {!sections && !failed && (
            <p className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="size-4 animate-spin" /> Opening the drawing board…
            </p>
          )}
          <div className="flex flex-col gap-8">
            {shown.map(section => (
              <section key={section.id} className="flex flex-col gap-3">
                <div className="flex flex-col">
                  <h3 className="text-sm font-medium text-stone-900">
                    {section.name}
                    {section.id === prefer && <span className="ml-2 text-xs font-normal text-emerald-700">This page's theme</span>}
                  </h3>
                  <p className="text-xs text-stone-500">{section.blurb}</p>
                </div>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                  {section.pages.map(page => (
                    <Choice key={page.id} page={page} busy={busy === page.id} disabled={busy !== null} onPick={() => onPick(section, page)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
