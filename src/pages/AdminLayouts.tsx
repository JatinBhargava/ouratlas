import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Loader2, X } from "lucide-react";

import { LayoutPreview } from "@/components/layouts/layout-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { reviewLayout, reviewQueue } from "@/lib/layouts";
import { cn } from "@/lib/utils";
import { LAYOUT_LIMITS, type LayoutStatus, type ReviewLayout } from "@/types";

const TABS: { status: LayoutStatus; label: string }[] = [
  { status: "pending", label: "Waiting" },
  { status: "accepted", label: "Accepted" },
  { status: "rejected", label: "Rejected" },
];

/** One submission with everything a decision needs, and the two buttons. */
function Item({ layout, onDecided }: { layout: ReviewLayout; onDecided: (id: string, message: string) => void }) {
  const [note, setNote] = useState(layout.note ?? "");
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "accept" | "reject") => {
    setBusy(decision);
    setError(null);
    try {
      const result = await reviewLayout(layout.id, { decision, note });
      onDecided(
        layout.id,
        `“${layout.title}” ${decision === "accept" ? "accepted" : "rejected"}${result.emailed ? " — the submitter has been emailed." : " — no email went out (mail is off, or the address is missing)."}`,
      );
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li className="grid gap-5 border-b border-stone-200 py-6 last:border-b-0 md:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        {layout.sampleUrl ? (
          <a href={layout.sampleUrl} target="_blank" rel="noreferrer" title="Open the sample full size">
            <img src={layout.sampleUrl} alt={`Sample of “${layout.title}”`} className="w-full rounded-lg bg-stone-100 object-contain ring-1 ring-stone-200" />
          </a>
        ) : (
          <p className="text-xs text-stone-500">The sample has been cleared.</p>
        )}
        <LayoutPreview design={layout.design} width={layout.kind === "poster" ? 150 : 240} />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-lg font-medium text-stone-900">{layout.title}</h3>
          <span className="text-xs tracking-wide text-stone-500 uppercase">{layout.kind}</span>
        </div>
        <p className="text-sm text-stone-600">
          {layout.authorEmail ?? "unknown"} · sent {new Date(layout.createdAt).toLocaleString()}
          {layout.reviewedAt && ` · decided ${new Date(layout.reviewedAt).toLocaleString()}${layout.notified ? " · emailed" : ""}`}
          {layout.status === "accepted" && ` · ${layout.likes} likes`}
        </p>
        {layout.description && <p className="text-sm text-stone-800">{layout.description}</p>}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-stone-700">Note to the submitter (goes in the email and on their page)</span>
          <textarea
            value={note}
            maxLength={LAYOUT_LIMITS.note}
            onChange={event => setNote(event.target.value)}
            rows={2}
            className="resize-y rounded-md bg-white px-3 py-2 text-sm ring-1 ring-stone-300 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {layout.status !== "accepted" && (
            <Button size="sm" className="rounded-full" disabled={busy !== null} onClick={() => void decide("accept")}>
              {busy === "accept" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Accept
            </Button>
          )}
          {layout.status !== "rejected" && (
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy !== null} onClick={() => void decide("reject")}>
              {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
              {layout.status === "accepted" ? "Take out of the directory" : "Reject"}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The editors' queue. The API decides who may use it (`ADMIN_EMAILS`); this
 * page only asks, and says so plainly when the answer is no.
 */
export function AdminLayouts() {
  const { ready, user, signInWithGoogle } = useAuth();
  const [status, setStatus] = useState<LayoutStatus>("pending");
  const [layouts, setLayouts] = useState<ReviewLayout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    setLayouts(null);
    setError(null);
    reviewQueue(status)
      .then(list => !cancelled && setLayouts(list.layouts))
      .catch(problem => !cancelled && (setError((problem as Error).message), setLayouts([])));
    return () => {
      cancelled = true;
    };
  }, [ready, user, status]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          The editors
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">Review queue</h1>
        <Link to="/layouts" className="w-fit text-sm text-white underline underline-offset-2 drop-shadow-sm">
          Back to the directory
        </Link>
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-5 py-2">
          {!ready ? (
            <Loader2 className="size-5 animate-spin text-stone-400" />
          ) : !user ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-stone-700">Sign in with an editor's account to review layouts.</p>
              <Button className="rounded-full" onClick={() => void signInWithGoogle("/admin/layouts")}>
                Sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {TABS.map(tab => (
                  <button
                    key={tab.status}
                    type="button"
                    aria-pressed={tab.status === status}
                    onClick={() => setStatus(tab.status)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm",
                      tab.status === status ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {done && <p className="text-sm text-emerald-800">{done}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              {layouts === null ? (
                <Loader2 className="size-5 animate-spin text-stone-400" />
              ) : layouts.length === 0 && !error ? (
                <p className="text-stone-600">Nothing here.</p>
              ) : (
                <ul className="flex flex-col">
                  {layouts.map(layout => (
                    <Item
                      key={layout.id}
                      layout={layout}
                      onDecided={(id, message) => {
                        setDone(message);
                        setLayouts(current => current?.filter(entry => entry.id !== id) ?? current);
                      }}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
