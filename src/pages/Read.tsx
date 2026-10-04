import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { KeyRound, Library, Loader2, LogIn, PenLine } from "lucide-react";

import { IssueView } from "@/components/magazine/issue-view";
import { JoinDialog } from "@/components/share-people";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { DEFAULT_THEME } from "@/lib/magazine/themes";
import type { Issue, Page } from "@/lib/magazine/types";
import { openIssue, openPage, type Manifest } from "@/lib/saved";

const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

/** How many pages are opened at once while the rest of the issue arrives. */
const PARALLEL = 4;

type Opened = { manifest: Manifest; expiresAt: string | null };

/**
 * Where this tab holds a magazine's key across the sign-in redirect. Signing
 * in is a trip through Google and back, and the part of the address after the
 * `#` — where the key lives — is not something that trip can be trusted to
 * keep. Session storage is this tab's alone and goes when it closes.
 */
const keySlot = (id: string) => `atlas:read-key:${id}`;

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
  const { user, configured, signInWithGoogle } = useAuth();
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState<"read" | "edit" | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Page pictures as they open, by page index. */
  const [pictures, setPictures] = useState<Record<number, string>>({});

  useEffect(() => {
    let keyText = location.hash.slice(1);
    // Back from signing in to join: the key this tab held while it was away, put back in the address.
    if (!keyText && id) {
      try {
        keyText = sessionStorage.getItem(keySlot(id)) ?? "";
        sessionStorage.removeItem(keySlot(id));
      } catch {
        keyText = "";
      }
      if (keyText) history.replaceState(history.state, "", `${location.pathname}${location.search}#${keyText}`);
    }
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

  // Back from signing in to join: the code dialog again, and the address tidied.
  useEffect(() => {
    if (params.get("join") !== "1" || !user || !opened) return;
    setJoining(true);
    // Past the router, so the key after the `#` stays in the address to be copied.
    const next = new URLSearchParams(location.search);
    next.delete("join");
    history.replaceState(history.state, "", `${location.pathname}?${next.toString()}${location.hash}`);
  }, [params, user, opened]);

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

  /** Joining this magazine with its code: straight away when signed in, or after signing in, back on this page. */
  const startJoin = async () => {
    if (user) {
      setJoining(true);
      return;
    }
    try {
      sessionStorage.setItem(keySlot(id), location.hash.slice(1));
    } catch {
      // Without it the reader comes back to an incomplete link, and can open it again from the one they have.
    }
    await signInWithGoogle(`/read?i=${encodeURIComponent(id)}&join=1`);
  };

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

      {configured && (
        <section className="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-2xl bg-white/85 p-4 text-center text-stone-700 shadow-lg backdrop-blur-md">
          {joined ? (
            <>
              <p className="text-sm">
                It is in your My magazines{joined === "edit" ? ", where you can also edit it" : ""}.
              </p>
              <Button asChild size="sm" className="rounded-full">
                <Link to="/magazines">
                  <Library className="size-4" />
                  My magazines
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm">Invited to this magazine with a code? Join it to keep it in your own My magazines, or to edit it if you were asked to.</p>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void startJoin()}>
                {user ? <KeyRound className="size-4" /> : <LogIn className="size-4" />}
                {user ? "Join this magazine" : "Sign in to join this magazine"}
              </Button>
            </>
          )}
          <JoinDialog issueId={id} title={manifest.title} open={joining} onOpenChange={setJoining} onJoined={setJoined} />
        </section>
      )}

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
