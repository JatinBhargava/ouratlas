import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Copy, Loader2, Lock, LogIn, PenLine, Share2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { deleteSaved, linkFor, listSaved, openManifest, openPage, type Manifest } from "@/lib/saved";
import { readKey } from "@/lib/vault";
import type { SavedIssue } from "@/types";

const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

/**
 * My magazines: every issue this account has saved, with its link.
 *
 * The list comes from the server, but a card's title and cover are sealed
 * there and opened here with the key kept on the account. An issue saved
 * without keeping its key shows as sealed: it exists, it can be taken down,
 * and only its link opens it.
 */
export function Magazines() {
  const { ready, configured, user, signInWithGoogle } = useAuth();
  const [issues, setIssues] = useState<SavedIssue[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(null);
    listSaved()
      .then(list => setIssues(list.issues))
      .catch(cause => setFailed(cause instanceof Error ? cause.message : "Your magazines could not be read."));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const heading = (
    <header className="flex flex-col gap-2">
      <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
        <span aria-hidden className="h-px w-6 bg-white/40" />
        The archive
      </span>
      <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md sm:text-5xl">My magazines</h1>
      <p className="max-w-prose text-sm text-white/85 drop-shadow-sm">
        Every issue you saved, and the link that opens it. Pages are sealed in your browser before they are sent; the
        key to each one is in its link.
      </p>
    </header>
  );

  if (!configured) {
    return (
      <div className="flex flex-col gap-8">
        {heading}
        <Card className="rounded-2xl border-white/60 bg-white/85 p-8 text-stone-700 backdrop-blur-md">
          Saving is switched off on this server.
        </Card>
      </div>
    );
  }

  if (!ready) return null;

  if (!user) {
    return (
      <div className="flex flex-col gap-8">
        {heading}
        <Card className="flex flex-col items-start gap-4 rounded-2xl border-white/60 bg-white/85 p-8 backdrop-blur-md">
          <p className="text-stone-700">Sign in to see the magazines you have saved.</p>
          <Button className="rounded-full" onClick={() => void signInWithGoogle("/magazines")}>
            <LogIn className="size-4" />
            Sign in with Google
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {heading}

      {failed && (
        <p className="text-sm text-red-100 drop-shadow-sm" role="alert">
          {failed}
        </p>
      )}

      {issues === null && !failed ? (
        <div className="flex justify-center py-16 text-white/80">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : issues?.length === 0 ? (
        <Card className="flex flex-col items-start gap-4 rounded-2xl border-white/60 bg-white/85 p-8 backdrop-blur-md">
          <p className="text-stone-700">
            Nothing saved yet. Press an issue at the desk, then choose <span className="font-medium">Save &amp; share</span>.
          </p>
          <Button asChild className="rounded-full">
            <Link to="/create">
              <PenLine className="size-4" />
              Start a story
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {issues?.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onDeleted={() => setIssues(current => current?.filter(other => other.id !== issue.id) ?? null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** One saved issue: its cover, title, how long it lasts, and what can be done with it. */
function IssueCard({ issue, onDeleted }: { issue: SavedIssue; onDeleted: () => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const link = issue.key ? linkFor(issue.id, issue.key) : null;

  useEffect(() => {
    if (!issue.key) return;
    let cancelled = false;
    let url: string | null = null;
    void (async () => {
      try {
        const opened = await openManifest(issue.manifest, issue.key!);
        if (cancelled) return;
        setManifest(opened);
        url = await openPage(issue.cover, await readKey(issue.key!));
        if (cancelled) URL.revokeObjectURL(url);
        else setCover(url);
      } catch {
        if (!cancelled) setFailed("Could not open this one.");
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [issue]);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: manifest?.title ?? "A magazine made with Atlas", url: link });
    } catch {
      // Closing the sheet is a choice, not a failure.
    }
  };

  const remove = async () => {
    if (!confirm("Take this magazine down? Its link stops working for everyone, and this cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteSaved(issue.id);
      onDeleted();
    } catch (cause) {
      setFailed(cause instanceof Error ? cause.message : "Could not take it down.");
      setDeleting(false);
    }
  };

  const lasts = issue.expiresAt ? `Until ${date.format(new Date(issue.expiresAt))}` : "Kept forever";
  const canShare = typeof navigator.share === "function";

  return (
    <div className="flex flex-col gap-2">
      {link ? (
        <Link
          to={`/read?i=${issue.id}#${issue.key}`}
          className="relative block aspect-[3/4] overflow-hidden rounded-sm bg-white/70 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          {cover ? (
            <img src={cover} alt={manifest?.title ?? ""} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-stone-400" />
            </span>
          )}
        </Link>
      ) : (
        <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-sm bg-white/60 p-4 text-center text-xs text-stone-600 shadow-lg">
          <Lock className="size-5" />
          Sealed. Only its link opens it.
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <p className="truncate font-editorial text-lg leading-tight text-white drop-shadow-sm">
          {manifest?.title ?? (link ? "…" : "A sealed issue")}
        </p>
        <p className="text-[11px] text-white/70 tabular-nums drop-shadow-sm">
          {issue.pages} pages · {lasts}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {link && (
          <>
            <Button size="sm" variant="secondary" className="h-7 rounded-full px-2.5 text-xs" onClick={() => void copy()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            {canShare && (
              <Button size="icon-sm" variant="secondary" className="size-7 rounded-full" onClick={() => void share()} aria-label="Share the link">
                <Share2 className="size-3.5" />
              </Button>
            )}
          </>
        )}
        <Button
          size="icon-sm"
          variant="secondary"
          className="size-7 rounded-full"
          disabled={deleting}
          onClick={() => void remove()}
          aria-label="Take it down"
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>

      {failed && <p className="text-[11px] text-red-100">{failed}</p>}
    </div>
  );
}
