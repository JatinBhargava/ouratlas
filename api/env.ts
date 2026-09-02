/**
 * Server configuration, read once at startup.
 *
 * Every integration here is optional. The magazine composes, paginates and
 * exports without any of them, so a missing key switches one feature off
 * rather than stopping the server — the same bargain `polish.ts` already
 * makes. Each `*Configured` flag is what the routes check before doing work,
 * and what `describe()` prints on boot so a half-set-up server says so.
 */

import { versionOf } from "../scripts/versions";

/**
 * The version this process is running.
 *
 * In an image it comes from APP_VERSION, stamped in at build time by the
 * Dockerfile, so a container reports what it was actually built from rather
 * than whatever the working tree says now. Outside one it falls back to
 * versions.json, which is the same number for a freshly built image and the
 * right answer during development.
 */
// `||`, not `??`: APP_VERSION set to an empty string is a misconfiguration,
// not a deliberate empty version, and should fall back rather than report "".
export const APP_VERSION = process.env.APP_VERSION || versionOf("api");

/**
 * Port the Express API listens on.
 *
 * In development the Bun dev server owns port 3000 (it bundles the frontend
 * and keeps hot reload) and forwards `/api` here. In production this same
 * process also serves the built frontend, so it takes 3000 itself.
 */
export const PORT = Number(process.env.PORT ?? (process.env.NODE_ENV === "production" ? 3000 : 3001));

/**
 * Where the browser reaches the site — the origin Stripe sends people back to
 * after checkout, not necessarily the port this process listens on.
 */
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Whether this process also serves the built frontend from `dist/`.
 *
 * True for `bun start`, which is one process doing both. False in the split
 * container deployment, where nginx serves the assets and this image does not
 * even contain them — left on, the SPA fallback would answer every unknown
 * path with a 500 from a missing index.html.
 */
export const serveStatic = (process.env.SERVE_STATIC ?? String(process.env.NODE_ENV === "production")) === "true";

/**
 * How often the keep-alive job pings this service. Ten minutes sits inside the
 * fifteen-minute idle window hosts like Render use, with room for one ping to
 * fail without the service being allowed to sleep.
 */
export const KEEPALIVE_INTERVAL_MS = Number(process.env.KEEPALIVE_INTERVAL_MINUTES ?? 10) * 60_000;

/**
 * The public address this service answers on, or null when there is nothing to
 * keep awake.
 *
 * Render injects RENDER_EXTERNAL_URL, so on Render this needs no configuration
 * at all. KEEPALIVE_URL overrides it for anywhere else. Development is excluded
 * on purpose: pinging localhost every ten minutes achieves nothing but noise in
 * the log.
 */
export function keepAliveUrl(): string | null {
  if (process.env.NODE_ENV !== "production") return null;
  if (process.env.KEEPALIVE === "false") return null;

  return process.env.KEEPALIVE_URL ?? process.env.RENDER_EXTERNAL_URL ?? null;
}

export const supabase = {
  url: process.env.SUPABASE_URL,
  /**
   * Bypasses row-level security, so it stays on the server and is used only
   * where a request has already been tied to a user — or by the Stripe
   * webhook, which is trusted because its signature checks out.
   */
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  /** Safe to hand to the browser; RLS is what protects the data. */
  anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.BUN_PUBLIC_SUPABASE_ANON_KEY,
} as const;

/**
 * Vercel Web Analytics, read server-side for the visitor counter in the nav.
 *
 * The token is a full-access Vercel credential, so it never goes near the
 * browser — the API queries Vercel and hands the frontend only a number.
 */
export const vercel = {
  token: process.env.VERCEL_API_TOKEN,
  projectId: process.env.VERCEL_PROJECT_ID,
  /** Omitted for projects owned by a personal account rather than a team. */
  teamId: process.env.VERCEL_TEAM_ID,
} as const;

export const analyticsConfigured = Boolean(vercel.token && vercel.projectId);

export const stripe = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  prices: {
    traveller: process.env.STRIPE_PRICE_TRAVELLER,
    cartographer: process.env.STRIPE_PRICE_CARTOGRAPHER,
  },
} as const;

/** Accounts, sign-in and the waitlist all need Supabase. */
export const supabaseConfigured = Boolean(supabase.url && supabase.serviceRoleKey);

/**
 * Billing needs Stripe *and* Supabase: a subscription is worth nothing if
 * there is no account to attach it to.
 */
export const billingConfigured = Boolean(
  supabaseConfigured && stripe.secretKey && stripe.prices.traveller && stripe.prices.cartographer,
);

/** The webhook can be verified independently of checkout being usable. */
export const webhookConfigured = Boolean(stripe.secretKey && stripe.webhookSecret && supabaseConfigured);

/** One line per integration at boot, so a missing key is obvious. */
export function describe(): string {
  const state = (on: boolean, missing: string) => (on ? "on" : `off (set ${missing})`);

  return [
    `   accounts  ${state(supabaseConfigured, "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")}`,
    `   billing   ${state(billingConfigured, "STRIPE_SECRET_KEY, STRIPE_PRICE_*")}`,
    `   webhook   ${state(webhookConfigured, "STRIPE_WEBHOOK_SECRET")}`,
    `   copy desk ${state(Boolean(process.env.ANTHROPIC_API_KEY), "ANTHROPIC_API_KEY")}`,
    `   analytics ${state(analyticsConfigured, "VERCEL_API_TOKEN, VERCEL_PROJECT_ID")}`,
  ].join("\n");
}
