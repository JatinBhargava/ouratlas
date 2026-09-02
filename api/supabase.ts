/**
 * Server-side Supabase access.
 *
 * Everything here uses the service-role key, which bypasses row-level
 * security. That is safe only because each call is made after the caller has
 * been resolved to a specific user id (see `authenticate`), or on behalf of
 * the Stripe webhook, whose signature has already been checked. Never widen a
 * query here to "all rows" on behalf of a browser request.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";

import { supabase as config, supabaseConfigured } from "@api/env";
import { HttpError, unconfigured } from "@api/http";

let client: SupabaseClient | null = null;

/** The privileged client, created lazily so an unconfigured server still boots. */
export function admin(): SupabaseClient {
  if (!supabaseConfigured) throw unconfigured("Accounts are", "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

  client ??= createClient(config.url!, config.serviceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** The bearer token on a request, if it carries one. */
function bearer(header: string | undefined): string | null {
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolves the caller to a Supabase user and hangs it on the request, or fails
 * with 401.
 *
 * The access token is verified by Supabase rather than decoded here — a JWT
 * this server merely parsed would prove nothing about who sent it.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = bearer(req.headers.authorization);
  if (!token) {
    next(new HttpError(401, "Sign in to continue."));
    return;
  }

  admin()
    .auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) throw new HttpError(401, "That session has expired. Sign in again.");
      req.user = data.user;
      next();
    })
    .catch(next);
};

/** The row mirroring an account, created by the trigger in `schema.sql`. */
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await admin()
    .from("profiles")
    .select("id, email, full_name, avatar_url, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, `Could not read your profile: ${error.message}`);
  return (data as Profile | null) ?? null;
}

/** The subscription row the webhook keeps in step with Stripe. */
export type Subscription = {
  id: string;
  user_id: string;
  status: string;
  plan: "traveller" | "cartographer";
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

/** Statuses that should unlock paid features. */
const LIVE = new Set(["active", "trialing", "past_due"]);

/**
 * The subscription that decides what someone can do, or null for a free
 * account.
 *
 * Cancelled and expired rows are kept for history, so this filters to the
 * statuses that still entitle, newest first — a plan change during a period
 * can briefly leave two live rows and the most recent is the one that counts.
 */
export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await admin()
    .from("subscriptions")
    .select("id, user_id, status, plan, price_id, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", [...LIVE])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new HttpError(500, `Could not read your subscription: ${error.message}`);
  return (data?.[0] as Subscription | undefined) ?? null;
}
