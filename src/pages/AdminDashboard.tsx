import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, Loader2, Minus, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { AdminStats, VisitsResponse } from "@/types";

/**
 * The editors' dashboard. Counts and sums only: the API reads nothing about
 * anyone's work or identity for it, and this page draws what it is given.
 * Visible to the editors alone — the API refuses everyone else, and this page
 * says so rather than showing an empty frame.
 */

const whole = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const figure = (value: number | null | undefined) => (value === null || value === undefined ? "—" : value >= 10_000 ? compact.format(value) : whole.format(value));

/** Minor units (paise, cents) as money in their own currency. */
function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
  } catch {
    return `${whole.format(minor / 100)} ${currency}`;
  }
}

/* ---------------------------------------------------------------- tiles */

function Tile({ label, value, children, action }: { label: string; value: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-stone-600">{label}</span>
        {action}
      </div>
      <span className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums">{value}</span>
      {children && <div className="text-xs leading-relaxed text-stone-500">{children}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- chart */

/**
 * Sign-ups per day, as columns: one series, so one hue and no legend — the
 * heading names it. Thin columns with rounded tops on one baseline, every
 * column a hover target the full height of the plot, and the same numbers as
 * a table for anyone not reading the picture.
 */
function SignupChart({ daily }: { daily: AdminStats["readers"]["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(1, ...daily.map(entry => entry.count));
  const height = 140;
  const total = daily.reduce((sum, entry) => sum + entry.count, 0);

  if (daily.length === 0) return <p className="text-sm text-stone-500">No sign-up data.</p>;

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-stone-800">Sign-ups per day, last 30 days</span>
        <span className="text-xs text-stone-500 tabular-nums">{whole.format(total)} in all</span>
      </figcaption>

      <div className="relative">
        <div className="flex items-end gap-[2px] border-b border-stone-300" style={{ height }} onPointerLeave={() => setHover(null)}>
          {daily.map((entry, index) => (
            <div
              key={entry.day}
              className="flex h-full flex-1 cursor-default items-end justify-center"
              onPointerEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={0}
              aria-label={`${dayLabel.format(new Date(entry.day))}: ${entry.count} sign-ups`}
            >
              <div
                className={cn("w-full max-w-6 rounded-t-[4px] transition-opacity", hover !== null && hover !== index ? "bg-emerald-600/45" : "bg-emerald-600")}
                style={{ height: entry.count === 0 ? 0 : Math.max(3, (entry.count / top) * (height - 8)) }}
              />
            </div>
          ))}
        </div>
        <span className="pointer-events-none absolute -top-1 left-0 text-[10px] text-stone-400 tabular-nums">{whole.format(top)}</span>

        {hover !== null && daily[hover] && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-md bg-stone-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
            style={{ left: `${((hover + 0.5) / daily.length) * 100}%`, transform: "translateX(-50%)" }}
          >
            {dayLabel.format(new Date(daily[hover].day))} · <span className="font-semibold tabular-nums">{daily[hover].count}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[11px] text-stone-500">
        <span>{dayLabel.format(new Date(daily[0]!.day))}</span>
        <span>{dayLabel.format(new Date(daily[daily.length - 1]!.day))}</span>
      </div>

      <details className="text-xs text-stone-600">
        <summary className="cursor-pointer text-stone-500 hover:text-stone-800">Show as a table</summary>
        <table className="mt-2 w-full max-w-xs tabular-nums">
          <thead>
            <tr className="text-left text-stone-500">
              <th className="py-1 font-normal">Day</th>
              <th className="py-1 text-right font-normal">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {daily.map(entry => (
              <tr key={entry.day} className="border-t border-stone-100">
                <td className="py-0.5">{dayLabel.format(new Date(entry.day))}</td>
                <td className="py-0.5 text-right">{entry.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/* ----------------------------------------------------------------- page */

export function AdminDashboard() {
  const { ready, user, signInWithGoogle } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [visits, setVisits] = useState<VisitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, seen] = await Promise.all([api.get<AdminStats>("/api/admin/stats"), api.get<VisitsResponse>("/api/visits").catch(() => null)]);
      setStats(next);
      setVisits(seen);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && user) void load();
  }, [ready, user, load]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
            <span aria-hidden className="h-px w-6 bg-white/40" />
            The editors
          </span>
          <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">Dashboard</h1>
          {stats && <p className="text-sm text-white/80 drop-shadow-sm">As of {when.format(new Date(stats.generatedAt))}</p>}
        </div>
        {user && (
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm" className="rounded-full">
              <Link to="/admin/layouts">
                <ShieldCheck className="size-4" /> Review queue
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="rounded-full" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
            </Button>
          </div>
        )}
      </header>

      {!ready ? (
        <Loader2 className="size-6 animate-spin text-white" />
      ) : !user ? (
        <Card className="border-white/50 bg-white/90 backdrop-blur-md">
          <CardContent className="flex flex-col items-start gap-3 py-2">
            <p className="text-stone-700">Sign in with an editor's account to see the dashboard.</p>
            <Button className="rounded-full" onClick={() => void signInWithGoogle("/admin/dashboard")}>
              Sign in
            </Button>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-white/50 bg-white/90 backdrop-blur-md">
          <CardContent className="py-2 text-stone-700">{error}</CardContent>
        </Card>
      ) : !stats ? (
        <Loader2 className="size-6 animate-spin text-white" />
      ) : (
        <>
          <Card className="border-white/50 bg-white/90 backdrop-blur-md">
            <CardContent className="grid gap-8 py-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-stone-600">Readers with an account</span>
                <span className="text-6xl font-semibold tracking-tight text-stone-900 tabular-nums">{figure(stats.readers.total)}</span>
                <span className="text-sm text-stone-600 tabular-nums">
                  +{figure(stats.readers.last7)} this week · +{figure(stats.readers.last30)} in 30 days
                </span>
              </div>
              <SignupChart daily={stats.readers.daily} />
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Paying subscribers" value={figure(stats.subscriptions?.active)}>
              {stats.subscriptions
                ? `Traveller ${stats.subscriptions.traveller} · Cartographer ${stats.subscriptions.cartographer}${stats.subscriptions.cancelling ? ` · ${stats.subscriptions.cancelling} cancelling` : ""}`
                : "Could not read subscriptions."}
            </Tile>
            <Tile
              label="Revenue this month"
              value={stats.revenue?.length ? money(stats.revenue[0]!.thisMonth, stats.revenue[0]!.currency) : stats.revenue ? money(0, "INR") : "—"}
            >
              {stats.revenue?.length
                ? stats.revenue.map(row => (
                    <span key={row.currency} className="block tabular-nums">
                      {row.currency}: {money(row.last30, row.currency)} in 30 days · {money(row.allTime, row.currency)} all time
                    </span>
                  ))
                : stats.revenue
                  ? "No payments yet."
                  : "Could not read payments."}
            </Tile>
            <Tile label="Magazines saved" value={figure(stats.magazines.saved)}>
              +{figure(stats.magazines.last30)} in 30 days · {figure(stats.magazines.keptForever)} kept forever
            </Tile>
            <Tile label="Exports this month" value={figure(stats.exportsThisMonth)}>
              Counted on free accounts; paid exports are not counted.
            </Tile>
            <Tile label="AI this month" value={stats.ai ? figure(stats.ai.editor + stats.ai.polish) : "—"}>
              {stats.ai ? `${stats.ai.editor} editor designs · ${stats.ai.polish} copy-desk passes` : "Could not read AI use."}
            </Tile>
            <Tile
              label="Layouts waiting"
              value={figure(stats.layouts?.pending)}
              action={
                stats.layouts?.pending ? (
                  <Link to="/admin/layouts" className="text-xs font-medium text-emerald-700 underline underline-offset-2">
                    Review
                  </Link>
                ) : undefined
              }
            >
              {stats.layouts
                ? `${stats.layouts.accepted} in the directory · ${stats.layouts.rejected} rejected · ${stats.layouts.likes} likes`
                : "Run the layouts SQL in Supabase to start counting."}
            </Tile>
            <Tile label="Newsletter waitlist" value={figure(stats.waitlist.total)}>
              +{figure(stats.waitlist.last30)} in 30 days
            </Tile>
            <Tile label="Visitors, last 30 days" value={figure(visits?.visitors)}>
              {visits ? `${whole.format(visits.pageviews)} page views (Vercel Analytics)` : "Analytics are off on this server."}
            </Tile>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-white/50 bg-white/90 backdrop-blur-md">
              <CardContent className="flex flex-col gap-3 py-2">
                <h2 className="text-sm font-medium text-stone-800">Recent payments</h2>
                {stats.recentPayments?.length ? (
                  <table className="w-full text-sm tabular-nums">
                    <thead>
                      <tr className="text-left text-xs text-stone-500">
                        <th className="py-1 font-normal">When</th>
                        <th className="py-1 font-normal">Via</th>
                        <th className="py-1 font-normal">Status</th>
                        <th className="py-1 text-right font-normal">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentPayments.map((payment, index) => (
                        <tr key={index} className="border-t border-stone-100">
                          <td className="py-1.5">{when.format(new Date(payment.at))}</td>
                          <td className="py-1.5 capitalize">{payment.provider}</td>
                          <td className="py-1.5 text-stone-600">{payment.status}</td>
                          <td className="py-1.5 text-right font-medium">{money(payment.amount, payment.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-stone-500">{stats.recentPayments ? "No payments yet." : "Could not read payments."}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-white/50 bg-white/90 backdrop-blur-md">
              <CardContent className="flex flex-col gap-3 py-2">
                <h2 className="text-sm font-medium text-stone-800">What this server has switched on</h2>
                <ul className="flex flex-col divide-y divide-stone-100 text-sm">
                  {stats.system.map(line => {
                    // "copy desk on (openai, …)": the name runs up to the word that says on or off.
                    const parts = /^(.+?)\s+((?:on|off)\b.*)$/.exec(line);
                    const name = parts?.[1] ?? line;
                    const detail = parts?.[2] ?? "";
                    const on = /^on\b/.test(detail);
                    return (
                      <li key={line} className="flex items-start gap-3 py-1.5">
                        <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full", on ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500")}>
                          {on ? <Check className="size-3" /> : <Minus className="size-3" />}
                        </span>
                        <span className="w-20 shrink-0 font-medium text-stone-800">{name}</span>
                        <span className={cn("min-w-0 text-xs leading-5 break-words", on ? "text-stone-700" : "text-stone-500")}>{detail}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
