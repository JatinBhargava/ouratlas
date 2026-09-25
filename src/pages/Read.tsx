import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Loader2, PenLine } from "lucide-react";

import { IssueView } from "@/components/magazine/issue-view";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME } from "@/lib/magazine/themes";
import type { Issue, Page } from "@/lib/magazine/types";
import { openIssue, openPage, type Manifest } from "@/lib/saved";

const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

/** How many pages are opened at once while the rest of the issue arrives. */
const PARALLEL = 4;

type Opened = { manifest: Manifest; expiresAt: string | null };

/**
 * A saved issue, opened from its link: `/read?i=<id>#<key>`.
 *
 * Anyone with the link can read it, signed in or not. The key is after the
 * `#`, which the browser keeps to itself, so the server hands over sealed
 * pages and the pages are opened here. Read only, in the same page-turning
 * book the desk shows a fresh issue in.
 */
export function Read() {
  const [params] = useSearchParams();
  const id = params.get("i") ?? "";
  const [opened, setOpened] = useState<Opened | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Page pictures as they open, by page index. */
  const [pictures, setPictures] = useState<Record<number, string>>({});

  useEffect(() => {
    const keyText = location.hash.slice(1);
    if (!id || !keyText) {
      setFailed("This link is incomplete. Ask whoever sent it for the whole address.");
      return;
    }

    let cancelled = false;
    const made: string[] = [];

    void (async () => {
      try {
        const { files, manifest, key } = await openIssue(id, keyText);
        if (cancelled) return;
        setOpened({ manifest, expiresAt: files.expiresAt });
        document.title = `${manifest.title} — Atlas`;

        // Front to back, a few at a time, so the cover and the first spread
        // are there first and the rest fill in while they are being read.
        let next = 0;
        const worker = async () => {
          while (next < files.urls.length && !cancelled) {
            const n = next++;
            const url = await openPage(files.urls[n]!, key);
            made.push(url);
            if (cancelled) return;
            setPictures(current => ({ ...current, [n]: url }));
          }
        };
        await Promise.all(Array.from({ length: PARALLEL }, worker));
      } catch (cause) {
        if (!cancelled) setFailed(cause instanceof Error ? cause.message : "This magazine could not be opened.");
      }
    })();

    return () => {
      cancelled = true;
      made.forEach(url => URL.revokeObjectURL(url));
    };
  }, [id]);

  /**
   * The book wants an issue; a saved one is pages and a title. Each page
   * carries only what the book reads — its id, place and folio — and is drawn
   * from its picture rather than set.
   */
  const issue = useMemo<Issue | null>(() => {
    if (!opened) return null;
    const { manifest } = opened;
    const pages: Page[] = manifest.folios.map((folio, index) => ({
      id: `page-${index}`,
      index,
      template: index === 0 ? "cover" : "blank",
      plates: [],
      plate: { width: 0, height: 0 },
      slices: [],
      folio,
    }));
    return {
      title: manifest.title,
      dateline: manifest.dateline,
      pages,
      words: manifest.words,
      overflowWords: 0,
      polished: false,
      theme: DEFAULT_THEME,
    };
  }, [opened]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center sm:py-16">
        <span className="text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          Out of circulation
        </span>
        <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">
          This magazine can't be opened
        </h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">{failed}</p>
        <Button asChild className="rounded-full">
          <Link to="/create">
            <PenLine className="size-4" />
            Make one of your own
          </Link>
        </Button>
      </div>
    );
  }

  if (!issue || !opened) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-white/80">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm drop-shadow-sm">Opening the magazine</p>
      </div>
    );
  }

  const { manifest, expiresAt } = opened;
  return (
    <div className="flex flex-col gap-8">
      <header className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
        <span className="flex items-center gap-3 text-[10px] font-medium tracking-[0.3em] text-white/75 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          Vol. I · {manifest.dateline}
          <span aria-hidden className="h-px w-6 bg-white/40" />
        </span>
        <h1 className="font-editorial text-5xl leading-[1.05] tracking-tight text-balance text-white drop-shadow-md sm:text-6xl">
          {manifest.title}
        </h1>
        {manifest.dek && <p className="text-sm leading-relaxed text-white/85 italic drop-shadow-sm">{manifest.dek}</p>}
        <p className="text-[11px] tracking-wide text-white/65 tabular-nums drop-shadow-sm">
          {manifest.pages} pages · {manifest.photographs} {manifest.photographs === 1 ? "photograph" : "photographs"} ·{" "}
          {manifest.words.toLocaleString()} words
        </p>
      </header>

      <IssueView
        issue={issue}
        drawPage={page =>
          pictures[page.index] ? (
            <img
              src={pictures[page.index]}
              alt={page.folio === null ? `${manifest.title}, the cover` : `Page ${page.folio}`}
              className="block size-full select-none"
              draggable={false}
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-stone-100">
              <Loader2 className="size-6 animate-spin text-stone-400" />
            </div>
          )
        }
      />

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-white/80 drop-shadow-sm">
          Set with Atlas. Sealed in the browser it was made in; only this link opens it.
          {expiresAt && <> Available until {date.format(new Date(expiresAt))}.</>}
        </p>
        <Button asChild variant="secondary" className="rounded-full">
          <Link to="/create">
            <PenLine className="size-4" />
            Make a magazine of your own
          </Link>
        </Button>
      </div>
    </div>
  );
}
