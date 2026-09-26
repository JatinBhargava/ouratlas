import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Heart, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { LayoutPreview } from "@/components/layouts/layout-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { listLayouts, myLayouts, toggleLike, withdrawLayout } from "@/lib/layouts";
import { cn } from "@/lib/utils";
import { isPosterDesign, type LayoutCard, type LayoutKind, type LayoutSort, type LayoutStatus, type OwnLayout } from "@/types";

const KIND_LABEL: Record<LayoutKind, string> = { poster: "Poster pages", magazine: "Magazine layouts" };

const STATUS: Record<LayoutStatus, { label: string; tone: string }> = {
  pending: { label: "Waiting for review", tone: "bg-amber-100 text-amber-900" },
  accepted: { label: "In the directory", tone: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "Not accepted", tone: "bg-stone-200 text-stone-700" },
};

/** Where "use this layout" goes: a one-page poster opens in the poster, several pages in Editor in Chief, a magazine layout on the desk. */
function startHref(layout: LayoutCard): string {
  if (layout.kind === "magazine") return `/create?layout=${layout.id}`;
  const pages = isPosterDesign(layout.design) ? layout.design.pages.length : 1;
  return `${pages > 1 ? "/editor-in-chief" : "/poster"}?layout=${layout.id}`;
}

function Sample({ layout }: { layout: LayoutCard }) {
  return layout.sampleUrl ? (
    <img src={layout.sampleUrl} alt={`Sample of the layout “${layout.title}”`} loading="lazy" className="aspect-3/4 w-full rounded-lg bg-stone-100 object-cover" />
  ) : (
    <div className="flex aspect-3/4 w-full items-center justify-center rounded-lg bg-stone-100">
      <LayoutPreview design={layout.design} width={200} />
    </div>
  );
}

function LayoutTile({ layout, onLike }: { layout: LayoutCard; onLike: (layout: LayoutCard) => void }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white/90 p-3 ring-1 ring-stone-200">
      <Sample layout={layout} />
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate font-medium text-stone-900">{layout.title}</h3>
          {layout.author && <p className="text-xs text-stone-500">by {layout.author}</p>}
        </div>
        <button
          type="button"
          onClick={() => onLike(layout)}
          aria-pressed={layout.liked}
          aria-label={`${layout.liked ? "Unlike" : "Like"} “${layout.title}”, ${layout.likes} likes`}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm tabular-nums ring-1 transition-colors",
            layout.liked ? "bg-rose-50 text-rose-700 ring-rose-200" : "text-stone-600 ring-stone-200 hover:text-rose-700",
          )}
        >
          <Heart className={cn("size-4", layout.liked && "fill-current")} />
          {layout.likes}
        </button>
      </div>
      {layout.description && <p className="px-1 text-sm leading-relaxed text-stone-600">{layout.description}</p>}
      <Button asChild size="sm" className="mt-auto rounded-full">
        <Link to={startHref(layout)}>Use this layout</Link>
      </Button>
    </li>
  );
}

function Mine({ layouts, onWithdraw }: { layouts: OwnLayout[]; onWithdraw: (layout: OwnLayout) => void }) {
  if (layouts.length === 0) {
    return <p className="text-sm text-stone-600">Nothing submitted yet. Design a page in the poster, Editor in Chief or the desk, then press Submit layout.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-stone-200">
      {layouts.map(layout => (
        <li key={layout.id} className="flex items-start gap-4 py-4">
          <div className="w-16 shrink-0">
            <Sample layout={layout} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-stone-900">{layout.title}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[layout.status].tone)}>{STATUS[layout.status].label}</span>
              <span className="text-xs text-stone-500">{layout.kind === "poster" ? "Poster" : "Magazine"}</span>
            </div>
            {layout.note && (
              <p className="text-sm text-stone-600">
                <span className="text-stone-500">From the editors:</span> {layout.note}
              </p>
            )}
            <p className="text-xs text-stone-500">
              Sent {new Date(layout.createdAt).toLocaleDateString()}
              {layout.status === "accepted" && ` · ${layout.likes} ${layout.likes === 1 ? "like" : "likes"}`}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label={`Withdraw “${layout.title}”`} title="Withdraw" className="text-stone-500 hover:text-red-600" onClick={() => onWithdraw(layout)}>
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The layout directory: pages other readers designed and the editors accepted,
 * to start from and to like, and — for the signed-in — their own submissions
 * and where each stands.
 */
export function Layouts() {
  const { ready, user, admin, signInWithGoogle } = useAuth();
  const [params, setParams] = useSearchParams();
  const { pathname, search, hash } = useLocation();
  const kind: LayoutKind = params.get("kind") === "magazine" ? "magazine" : "poster";
  const sort: LayoutSort = params.get("sort") === "new" ? "new" : "top";

  const [layouts, setLayouts] = useState<LayoutCard[] | null>(null);
  const [mine, setMine] = useState<OwnLayout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Waits for the session so a signed-in reader's likes come back marked.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setLayouts(null);
    listLayouts(kind, sort)
      .then(list => !cancelled && setLayouts(list.layouts))
      .catch(problem => !cancelled && (setError((problem as Error).message), setLayouts([])));
    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, kind, sort]);

  const loadMine = useCallback(() => {
    if (!user) {
      setMine(null);
      return;
    }
    myLayouts()
      .then(list => setMine(list.layouts))
      .catch(() => setMine([]));
  }, [user]);
  useEffect(loadMine, [loadMine]);

  // Arriving at #mine (from the submit panel), scroll once the list is there.
  useEffect(() => {
    if (hash === "#mine" && mine) document.getElementById("mine")?.scrollIntoView({ behavior: "smooth" });
  }, [hash, mine]);

  const like = async (layout: LayoutCard) => {
    if (!user) {
      void signInWithGoogle(`${pathname}${search}`);
      return;
    }
    // Shown at once, and put right if the server says otherwise.
    const flip = (liked: boolean, likes: number) =>
      setLayouts(current => current?.map(entry => (entry.id === layout.id ? { ...entry, liked, likes } : entry)) ?? current);
    flip(!layout.liked, layout.likes + (layout.liked ? -1 : 1));
    try {
      const result = await toggleLike(layout.id);
      flip(result.liked, result.likes);
    } catch (problem) {
      flip(layout.liked, layout.likes);
      setError((problem as Error).message);
    }
  };

  const withdraw = async (layout: OwnLayout) => {
    if (!window.confirm(`Withdraw “${layout.title}”? It leaves the directory and its sample is deleted.`)) return;
    try {
      await withdrawLayout(layout.id);
      setMine(current => current?.filter(entry => entry.id !== layout.id) ?? current);
      setLayouts(current => current?.filter(entry => entry.id !== layout.id) ?? current);
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const choose = (next: Partial<{ kind: LayoutKind; sort: LayoutSort }>) => setParams({ kind: next.kind ?? kind, sort: next.sort ?? sort });

  const pill = (on: boolean) =>
    cn("rounded-full px-4 py-1.5 text-sm transition-colors", on ? "bg-stone-900 text-white" : "bg-white/80 text-stone-700 ring-1 ring-stone-200 hover:text-stone-900");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          The directory
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">Layouts</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          Pages other Atlas readers designed and the editors accepted. Start from any of them — every box stays yours to change — and like the ones you
          would use again.
        </p>
        {admin && (
          <div className="flex gap-4">
            <Link to="/admin/layouts" className="flex w-fit items-center gap-1.5 text-sm text-white underline underline-offset-2 drop-shadow-sm">
              <ShieldCheck className="size-4" /> Review queue
            </Link>
            <Link to="/admin/dashboard" className="w-fit text-sm text-white underline underline-offset-2 drop-shadow-sm">
              Dashboard
            </Link>
          </div>
        )}
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-6 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Kind of layout" className="flex gap-2">
              {(["poster", "magazine"] as const).map(option => (
                <button key={option} type="button" role="tab" aria-selected={option === kind} className={pill(option === kind)} onClick={() => choose({ kind: option })}>
                  {KIND_LABEL[option]}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Order" className="flex gap-2">
              <button type="button" aria-pressed={sort === "top"} className={pill(sort === "top")} onClick={() => choose({ sort: "top" })}>
                Most liked
              </button>
              <button type="button" aria-pressed={sort === "new"} className={pill(sort === "new")} onClick={() => choose({ sort: "new" })}>
                Newest
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {layouts === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-stone-400" />
            </div>
          ) : layouts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-stone-700">No {kind === "poster" ? "poster pages" : "magazine layouts"} in the directory yet.</p>
              <p className="max-w-md text-sm text-stone-500">
                Be the first: design one in the {kind === "poster" ? "poster studio" : "desk's “Your own” layouts"}, press Submit layout, and the editors will take a look.
              </p>
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {layouts.map(layout => (
                <LayoutTile key={layout.id} layout={layout} onLike={like} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-4 py-2">
          <h2 className="font-editorial text-3xl text-stone-900">Submit your own</h2>
          <p className="max-w-prose text-sm text-stone-600">
            Design a page, press <strong>Submit layout</strong>, and attach a sample of how it looks finished. The editors review every one; you get an email
            when yours is decided, and accepted layouts appear here for everyone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/poster">One-page poster</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/editor-in-chief">Editor in Chief</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/create">Magazine desk (“Your own” style)</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {user && (
        <Card id="mine" className="scroll-mt-28 border-white/50 bg-white/90 backdrop-blur-md">
          <CardContent className="flex flex-col gap-2 py-2">
            <h2 className="font-editorial text-3xl text-stone-900">Your submissions</h2>
            {mine === null ? <Loader2 className="size-5 animate-spin text-stone-400" /> : <Mine layouts={mine} onWithdraw={layout => void withdraw(layout)} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
