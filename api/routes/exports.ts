/**
 * How many issues an account has exported, and whether it may export another.
 *
 * The count lives here rather than in the browser for the obvious reason: the
 * browser is the party the limit is applied to. `window.print()` cannot be
 * taken away from anyone, so what this actually guards is the print sheet —
 * the client asks before rendering it, and a refusal means the sheet is never
 * put into the document at all.
 *
 * Nothing about a magazine is recorded. A row is an account, a number and
 * the month that number belongs to.
 */

import { Router } from "express";

import { exportLimit } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { admin, authenticate, getActiveSubscription } from "@api/supabase";
import type { ExportAllowance } from "@/types";

export const exportRoutes = Router();

/** The first of the current month, UTC, as the `date` column stores it. */
function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/** The allowance for someone nothing is counted against. */
const UNCOUNTED = { used: 0, limit: null, remaining: null } as const;

/**
 * How many this account may export a month, or null when it is not counted —
 * a paid plan, or the limit switched off on this server.
 */
async function limitFor(userId: string): Promise<number | null> {
  const subscription = await getActiveSubscription(userId);
  return subscription ? null : exportLimit.free;
}

/**
 * What this account is allowed, having spent what it has spent.
 *
 * A paid plan is never counted, and neither is anyone when the limit is off,
 * so both answer with a null limit rather than a very large number — the
 * difference matters to the client, which shows a tally only when there is
 * one to show.
 */
async function allowanceFor(userId: string): Promise<ExportAllowance> {
  const limit = await limitFor(userId);
  if (limit === null) return { ...UNCOUNTED };

  const { data, error } = await admin()
    .from("exports")
    .select("times, period_start")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, `Could not read your exports: ${error.message}`);

  // A count left over from a spent month is not this month's, so it reads as
  // nothing. The next export overwrites it rather than the table being swept.
  const used = data?.period_start === monthStart() ? data.times : 0;
  return { used, limit, remaining: Math.max(0, limit - used) };
}

/** Read the allowance without spending any of it. */
exportRoutes.get(
  "/exports",
  authenticate,
  asyncRoute(async (req, res) => {
    res.json(await allowanceFor(req.user!.id));
  }),
);

/**
 * Spends one export, or refuses.
 *
 * Claimed before the print sheet is rendered rather than after the dialog
 * closes, because a print dialog gives no reliable signal that anything was
 * actually saved — waiting for one would mean either never counting or
 * counting things that never happened. Erring towards counting is the honest
 * side: it is the reader's own allowance, and a claimed-but-cancelled export
 * is a cost they can see, whereas an uncounted one is a limit that quietly
 * does not work.
 */
exportRoutes.post(
  "/exports",
  authenticate,
  asyncRoute(async (req, res) => {
    const userId = req.user!.id;
    const limit = await limitFor(userId);

    // Nothing to count, so nothing is written. A paid plan leaves no row at
    // all, which is also what makes an unsubscribe start the month clean.
    if (limit === null) {
      res.json({ ...UNCOUNTED } satisfies ExportAllowance);
      return;
    }

    // One statement decides and increments. Splitting the two here would put a
    // gap between them, and a double-click lands in exactly that gap.
    const { data, error } = await admin().rpc("claim_export", { p_user: userId, p_limit: limit });
    if (error) throw new HttpError(500, `Could not record your export: ${error.message}`);

    // Postgres returns a set even for one row.
    const claim = (Array.isArray(data) ? data[0] : data) as { used: number; granted: boolean } | undefined;
    if (!claim) throw new HttpError(500, "Could not record your export.");

    if (!claim.granted) {
      throw new HttpError(
        402,
        `Wanderer exports ${limit} issues a month, and this month's are spent. Traveller and Cartographer export as many as you like.`,
      );
    }

    res.json({
      used: claim.used,
      limit,
      remaining: Math.max(0, limit - claim.used),
    } satisfies ExportAllowance);
  }),
);
