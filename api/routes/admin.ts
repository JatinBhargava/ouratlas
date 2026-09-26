/**
 * The editors' dashboard: how Atlas is doing, in counts and sums.
 *
 * Only aggregates leave here. No email, name, title, photograph or word of
 * anyone's is read for this route, let alone returned — "how many" is the only
 * question it asks of any table. That keeps the dashboard inside the promise
 * the rest of the site makes, even for the people it is built for.
 *
 * Every figure is read on its own and fails on its own: a table that has not
 * been created yet (the layouts, before their SQL is run) or a query that
 * errors turns one tile to "—" rather than the whole page into an error.
 */

import { Router } from "express";

import { describe } from "@api/env";
import { asyncRoute } from "@api/http";
import { admin, authenticate, LIVE, requireAdmin } from "@api/supabase";
import type { AdminStats } from "@/types";

export const adminRoutes = Router();

const DAY = 86_400_000;

/** A figure that failed to read is null, and logged for whoever reads the server's logs. */
async function safely<T>(name: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error(`[admin] ${name}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** Rows in `table`, optionally since a moment by `column`. Counted by the database; no rows are fetched. */
async function count(table: string, since?: { column: string; at: Date }, where?: Record<string, unknown>): Promise<number> {
  let query = admin().from(table).select("*", { count: "exact", head: true });
  if (since) query = query.gte(since.column, since.at.toISOString());
  for (const [column, value] of Object.entries(where ?? {})) query = value === null ? query.is(column, null) : query.eq(column, value as string);
  const { count: total, error } = await query;
  if (error) throw new Error(error.message);
  return total ?? 0;
}

/** Sign-ups per UTC day for the last thirty days, oldest first, empty days included. */
async function dailySignups(now: Date): Promise<{ day: string; count: number }[]> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * DAY);
  const { data, error } = await admin().from("profiles").select("created_at").gte("created_at", start.toISOString()).limit(20_000);
  if (error) throw new Error(error.message);
  const days = new Map<string, number>();
  for (let n = 0; n < 30; n++) days.set(new Date(start.getTime() + n * DAY).toISOString().slice(0, 10), 0);
  for (const row of data ?? []) {
    const day = String(row.created_at).slice(0, 10);
    if (days.has(day)) days.set(day, days.get(day)! + 1);
  }
  return [...days].map(([day, total]) => ({ day, count: total }));
}

adminRoutes.get(
  "/admin/stats",
  authenticate,
  requireAdmin,
  asyncRoute(async (_req, res) => {
    res.setHeader("cache-control", "no-store");
    res.json(await collectStats());
  }),
);

/** Everything the dashboard shows, read fresh. Exported so it can be checked without going through sign-in. */
export async function collectStats(): Promise<AdminStats> {
  const now = new Date();
  const week = new Date(now.getTime() - 7 * DAY);
  const month = new Date(now.getTime() - 30 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthKey = monthStart.toISOString().slice(0, 10);

  const [readers, readers7, readers30, daily, subscriptions, payments, saved, saved30, forever, exports, ai, layouts, waitlist, waitlist30] =
    await Promise.all([
      safely("readers", () => count("profiles")),
      safely("readers 7d", () => count("profiles", { column: "created_at", at: week })),
      safely("readers 30d", () => count("profiles", { column: "created_at", at: month })),
      safely("daily sign-ups", () => dailySignups(now)),
      safely("subscriptions", async () => {
        const { data, error } = await admin().from("subscriptions").select("plan, status, cancel_at_period_end").limit(20_000);
        if (error) throw new Error(error.message);
        const live = (data ?? []).filter((row) => LIVE.has(String(row.status)));
        return {
          active: live.length,
          traveller: live.filter((row) => row.plan === "traveller").length,
          cartographer: live.filter((row) => row.plan === "cartographer").length,
          cancelling: live.filter((row) => row.cancel_at_period_end === true).length,
        };
      }),
      safely("payments", async () => {
        const { data, error } = await admin()
          .from("payments")
          .select("amount_paid, currency, paid_at, created_at, provider, status")
          .gt("amount_paid", 0)
          .order("created_at", { ascending: false })
          .limit(20_000);
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
      safely("saved issues", () => count("issues", undefined, { ready: true })),
      safely("saved issues 30d", () => count("issues", { column: "created_at", at: month }, { ready: true })),
      safely("kept forever", () => count("issues", undefined, { ready: true, expires_at: null })),
      safely("exports", async () => {
        const { data, error } = await admin().from("exports").select("times").eq("period_start", monthKey).limit(20_000);
        if (error) throw new Error(error.message);
        return (data ?? []).reduce((sum, row) => sum + Number(row.times ?? 0), 0);
      }),
      safely("ai usage", async () => {
        const { data, error } = await admin().from("ai_usage").select("kind, used").eq("period_start", monthKey).limit(20_000);
        if (error) throw new Error(error.message);
        const used = (kind: string) => (data ?? []).filter((row) => row.kind === kind).reduce((sum, row) => sum + Number(row.used ?? 0), 0);
        return { editor: used("editor"), polish: used("polish") };
      }),
      safely("layouts", async () => {
        const { data, error } = await admin().from("layouts").select("status, likes").limit(20_000);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        const of = (status: string) => rows.filter((row) => row.status === status).length;
        return {
          pending: of("pending"),
          accepted: of("accepted"),
          rejected: of("rejected"),
          likes: rows.reduce((sum, row) => sum + Number(row.likes ?? 0), 0),
        };
      }),
      safely("waitlist", () => count("waitlist")),
      safely("waitlist 30d", () => count("waitlist", { column: "created_at", at: month })),
    ]);

  // Money is summed per currency and never converted: a rupee total and a
  // dollar total side by side is honest, one number made from both is not.
  let revenue: AdminStats["revenue"] = null;
  let recentPayments: AdminStats["recentPayments"] = null;
  if (payments) {
    const byCurrency = new Map<string, { currency: string; thisMonth: number; last30: number; allTime: number }>();
    for (const payment of payments) {
      const currency = String(payment.currency ?? "").toUpperCase() || "?";
      const at = new Date(String(payment.paid_at ?? payment.created_at));
      const amount = Number(payment.amount_paid ?? 0);
      const row = byCurrency.get(currency) ?? { currency, thisMonth: 0, last30: 0, allTime: 0 };
      row.allTime += amount;
      if (at >= month) row.last30 += amount;
      if (at >= monthStart) row.thisMonth += amount;
      byCurrency.set(currency, row);
    }
    revenue = [...byCurrency.values()].sort((a, b) => b.allTime - a.allTime);
    recentPayments = payments.slice(0, 8).map((payment) => ({
      amount: Number(payment.amount_paid ?? 0),
      currency: String(payment.currency ?? "").toUpperCase(),
      at: String(payment.paid_at ?? payment.created_at),
      provider: String(payment.provider ?? ""),
      status: String(payment.status ?? ""),
    }));
  }

  const stats: AdminStats = {
    generatedAt: now.toISOString(),
    readers: { total: readers, last7: readers7, last30: readers30, daily: daily ?? [] },
    subscriptions,
    revenue,
    recentPayments,
    magazines: { saved, last30: saved30, keptForever: forever },
    exportsThisMonth: exports,
    ai,
    layouts,
    waitlist: { total: waitlist, last30: waitlist30 },
    system: describe()
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
  return stats;
}
