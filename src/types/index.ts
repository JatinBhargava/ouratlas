/** Shared types used across the app. */

export type ApiError = {
  status: number;
  message: string;
};

/** An image chosen for an album. `url` is an object URL local to the tab. */
export type Photo = {
  id: string;
  file: File;
  url: string;
};

// --- Accounts and billing ------------------------------------------------
//
// Shared by the Express API in `api/` and the React app, so the two cannot
// drift on what a plan is called.

/** Plans you can pay for. The names match the pricing table and Stripe. */
export type PaidPlan = "traveller" | "cartographer";

/** Every account is on one of these; "free" is the absence of a subscription. */
export type Plan = "free" | PaidPlan;

/**
 * Plans that include the copy desk.
 *
 * The one entitlement both halves of the app have to agree on, so it lives
 * here rather than being spelt out twice. The server enforces it in
 * `api/routes/polish.ts`; the browser uses it only to decide what to show,
 * because a check made in the browser is a check the browser could skip.
 */
export const COPY_DESK_PLANS: readonly Plan[] = ["traveller", "cartographer"];

export function hasCopyDesk(plan: Plan): boolean {
  return COPY_DESK_PLANS.includes(plan);
}

/** What the signed-in person is entitled to, as the server sees it. */
export type Billing = {
  plan: Plan;
  /** Stripe's subscription status, or null on a free account. */
  status: string | null;
  /** ISO date the current period ends, or null on a free account. */
  currentPeriodEnd: string | null;
  /** True when the plan is set to lapse rather than renew. */
  cancelAtPeriodEnd: boolean;
};

/** The signed-in person, flattened out of the Supabase user record. */
export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

/** `GET /api/me` */
export type MeResponse = {
  user: SessionUser;
  billing: Billing;
};

/** `POST /api/billing/checkout` and `/api/billing/portal` both answer with a URL to visit. */
export type RedirectResponse = { url: string };

/** `POST /api/waitlist` */
export type WaitlistResponse = { ok: true; alreadySubscribed: boolean };

/** `GET /api/visits` — Vercel Web Analytics totals for the whole project. */
export type VisitsResponse = {
  visitors: number;
  pageviews: number;
};
