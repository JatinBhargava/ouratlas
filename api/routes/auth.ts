/**
 * Who is signed in, and what they are entitled to.
 *
 * Sign-in itself happens in the browser against Supabase (Google OAuth), so
 * there is no login endpoint here. This route exists so the client can ask the
 * server — the only party that can be trusted about it — what plan the session
 * is on.
 */

import { Router } from "express";

import { asyncRoute } from "@api/http";
import { authenticate, getActiveSubscription } from "@api/supabase";
import type { Billing, MeResponse, SessionUser } from "@/types";

export const authRoutes = Router();

/** Google gives back name and picture under varying keys; take the first that answers. */
function toSessionUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): SessionUser {
  const meta = user.user_metadata ?? {};
  const pick = (...keys: string[]) => keys.map(key => meta[key]).find(value => typeof value === "string") as
    | string
    | undefined;

  return {
    id: user.id,
    email: user.email ?? null,
    name: pick("full_name", "name") ?? null,
    avatarUrl: pick("avatar_url", "picture") ?? null,
  };
}

/** No subscription is not an error — it is the free plan. */
const FREE: Billing = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };

authRoutes.get(
  "/me",
  authenticate,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const subscription = await getActiveSubscription(user.id);

    const billing: Billing = subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        }
      : FREE;

    res.json({ user: toSessionUser(user), billing } satisfies MeResponse);
  }),
);
