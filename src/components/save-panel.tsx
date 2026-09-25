import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router";
import { Dialog } from "radix-ui";
import { BookOpen, Check, Copy, Library, Link2, Loader2, Lock, Share2, X } from "lucide-react";

import { PrintSheet } from "@/components/magazine/print-sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import type { Issue } from "@/lib/magazine/types";
import { saveIssue, type SaveProgress } from "@/lib/saved";
import { cn } from "@/lib/utils";
import { KEEPS, type Keep } from "@/types";

const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

const KEEP_LABELS: Record<Keep, string> = { "1d": "1 day", "7d": "7 days", "30d": "30 days", forever: "Forever" };

/**
 * Saving an issue to share by link, and to keep in My magazines.
 *
 * The pages are drawn and sealed here, then sent straight to storage; the
 * link that comes back carries the key after its `#`. Two choices, both
 * stated plainly because both are about who can open it: how long it lasts,
 * and whether the key is kept on the account so My magazines can open it —
 * or held only in the link.
 */
export function SavePanel({
  issue,
  tilt,
  sketches,
  photographs,
  dek,
  open,
  onOpenChange,
  onPress,
}: {
  issue: Issue;
  tilt?: number;
  sketches?: Record<string, string>;
  photographs: number;
  dek: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The same question an export asks before anything is drawn. False stops here. */
  onPress: () => Promise<boolean>;
}) {
  const { billing } = useAuth();
  const paid = billing.plan !== "free";
  const [keep, setKeep] = useState<Keep>(paid ? "forever" : "30d");
  const [inLibrary, setInLibrary] = useState(true);
  const [progress, setProgress] = useState<SaveProgress | null>(null);
  const [saved, setSaved] = useState<{ link: string; expiresAt: string | null } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const run = useRef(0);

  // A saved link is for the issue it was made from; a recomposed issue is a new one.
  useEffect(() => {
    run.current++;
    setSaved(null);
    setProgress(null);
  }, [issue]);

  // The plan can arrive after the panel first draws.
  useEffect(() => {
    if (paid) setKeep(current => (current === "30d" ? "forever" : current));
    else setKeep(current => (current === "forever" ? "30d" : current));
  }, [paid]);

  const close = (next: boolean) => {
    if (!next && progress) return; // Not while pages are going up.
    if (!next) setFailed(null);
    onOpenChange(next);
  };

  const save = async () => {
    setFailed(null);
    const mine = ++run.current;
    if (!(await onPress()) || mine !== run.current) return;

    flushSync(() => setProgress({ stage: "drawing", done: 0, total: issue.pages.length }));
    try {
      const leaves = [...(sheet.current?.children ?? [])] as HTMLElement[];
      const result = await saveIssue(
        leaves,
        {
          title: issue.title,
          dateline: issue.dateline,
          folios: issue.pages.map(page => page.folio),
          words: issue.words,
          photographs,
          dek,
        },
        { keep, keepInLibrary: inLibrary },
        next => mine === run.current && setProgress(next),
      );
      if (mine === run.current) setSaved(result);
    } catch (cause) {
      if (mine === run.current) setFailed(cause instanceof Error ? cause.message : "The magazine could not be saved.");
    } finally {
      if (mine === run.current) setProgress(null);
    }
  };

  const copy = async () => {
    if (!saved) return;
    await navigator.clipboard.writeText(saved.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (!saved) return;
    try {
      await navigator.share({ title: issue.title, url: saved.link });
    } catch {
      // Closing the sheet is a choice, not a failure.
    }
  };

  return (
    <>
      <Dialog.Root open={open} onOpenChange={close}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[min(calc(100vw-2rem),520px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl bg-white p-5 text-stone-800 shadow-2xl sm:p-6"
            onOpenAutoFocus={event => event.preventDefault()}
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium tracking-[0.28em] text-stone-500 uppercase">The archive</span>
                <Dialog.Title className="font-editorial text-2xl tracking-tight">
                  {saved ? "Saved. Here is its link." : "Save & share"}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-stone-600">
                  {saved
                    ? "Anyone with this link can read the magazine, page by page. Nobody needs an account."
                    : "Your pages are sealed in this browser before they are sent, and the key goes in the link — so the link is what opens it."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full" aria-label="Close" disabled={!!progress}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </header>

            {saved ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2 pl-3">
                  <Link2 className="size-4 shrink-0 text-stone-500" />
                  <input
                    readOnly
                    value={saved.link}
                    onFocus={event => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent text-sm text-stone-700 outline-none"
                    aria-label="The magazine's link"
                  />
                  <Button size="sm" className="rounded-full" onClick={() => void copy()}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {typeof navigator.share === "function" && (
                    <Button variant="secondary" className="rounded-full" onClick={() => void share()}>
                      <Share2 className="size-4" />
                      Share link
                    </Button>
                  )}
                  <Button asChild variant="secondary" className="rounded-full">
                    <a href={saved.link} target="_blank" rel="noreferrer">
                      <BookOpen className="size-4" />
                      Open it
                    </a>
                  </Button>
                  {inLibrary && (
                    <Button asChild variant="ghost" className="rounded-full">
                      <Link to="/magazines">
                        <Library className="size-4" />
                        My magazines
                      </Link>
                    </Button>
                  )}
                </div>
                <p className="text-xs text-stone-500">
                  {saved.expiresAt ? `Available until ${date.format(new Date(saved.expiresAt))}.` : "Kept until you take it down."}{" "}
                  {inLibrary
                    ? "It is in My magazines, where you can copy the link again or take it down."
                    : "Not kept in My magazines: this link is the only way in, so keep it somewhere safe."}
                </p>
              </div>
            ) : progress ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="size-5 animate-spin text-stone-500" />
                <p className="text-sm text-stone-600 tabular-nums">
                  {progress.stage === "drawing"
                    ? `Drawing page ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                    : `Sealing and sending ${progress.done} of ${progress.total}`}
                </p>
                <Progress
                  value={((progress.stage === "drawing" ? 0 : progress.total) + progress.done) / (progress.total * 2) * 100}
                  className="w-48"
                />
              </div>
            ) : (
              <>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium text-stone-900">Keep it for</legend>
                  <div className="grid grid-cols-4 gap-2">
                    {KEEPS.map(choice => {
                      const locked = choice === "forever" && !paid;
                      return (
                        <button
                          key={choice}
                          type="button"
                          disabled={locked}
                          aria-pressed={keep === choice}
                          onClick={() => setKeep(choice)}
                          className={cn(
                            "flex items-center justify-center gap-1 rounded-full border px-2 py-2 text-sm transition",
                            keep === choice ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 hover:border-stone-400",
                            locked && "cursor-not-allowed opacity-50 hover:border-stone-200",
                          )}
                        >
                          {locked && <Lock className="size-3" />}
                          {KEEP_LABELS[choice]}
                        </button>
                      );
                    })}
                  </div>
                  {!paid && (
                    <p className="text-xs text-stone-500">
                      Forever comes with{" "}
                      <Link to="/pricing" className="underline underline-offset-2">
                        Traveller and Cartographer
                      </Link>
                      .
                    </p>
                  )}
                </fieldset>

                <button
                  type="button"
                  role="switch"
                  aria-checked={inLibrary}
                  onClick={() => setInLibrary(on => !on)}
                  className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 text-left transition hover:border-stone-300"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition",
                      inLibrary ? "bg-stone-900" : "bg-stone-300",
                    )}
                  >
                    <span className={cn("size-4 rounded-full bg-white shadow transition", inLibrary && "translate-x-4")} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-stone-900">Keep in My magazines</span>
                    <span className="text-xs text-stone-500">
                      {inLibrary
                        ? "Its key is kept on your account, so My magazines opens it on any device."
                        : "The key stays only in the link. Nobody else can open it — not even us — and neither can you without the link."}
                    </span>
                  </span>
                </button>

                <div className="flex justify-end">
                  <Button className="rounded-full" onClick={() => void save()}>
                    <Link2 className="size-4" />
                    Save &amp; get link
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

      {/* Every page at full size, off the edge of the screen, only while it is being drawn. */}
      {progress && <PrintSheet ref={sheet} issue={issue} tilt={tilt} sketches={sketches} offscreen />}
    </>
  );
}
