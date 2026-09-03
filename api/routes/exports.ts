/**
 * How many issues an account has exported, and whether it may export another.
 *
 * The count lives here rather than in the browser for the obvious reason: the
 * browser is the party the limit is applied to. `window.print()` cannot be
 * taken away from anyone, so what this actually guards is the print sheet —
 * the client asks before rendering it, and a refusal means the sheet is never
 * put into the document at all.
 *
 * Nothing about a magazine is recorded. A row is an account and a timestamp.
 */

import { Router } from "express";

import { exportLimit } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { admin, authenticate, getActiveSubscription } from "@api/supabase";
import type { ExportAllowance } from "@/types";

export const exportRoutes = Router();

/** Midnight UTC on the first of the current month. */
function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
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
  const subscription = await getActiveSubscription(userId);
  const limit = subscription ? null : exportLimit.free;

  if (limit === null) return { used: 0, limit: null, remaining: null };

  const { count, error } = await admin()
    .from("exports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", monthStart());

  if (error) throw new HttpError(500, `Could not read your exports: ${error.message}`);

  const used = count ?? 0;
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
    const allowance = await allowanceFor(userId);

    if (allowance.remaining !== null && allowance.remaining <= 0) {
      throw new HttpError(
        402,
        `Wanderer exports ${allowance.limit} issues a month, and this month's are spent. Traveller and Cartographer export as many as you like.`,
      );
    }

    // Unlimited accounts are not written down. There is nothing to count, and
    // a table of rows nobody will ever read is a table somebody has to keep.
    if (allowance.limit !== null) {
      const { error } = await admin().from("exports").insert({ user_id: userId });
      if (error) throw new HttpError(500, `Could not record your export: ${error.message}`);
    }

    res.json(await allowanceFor(userId));
  }),
);
