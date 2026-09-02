/**
 * Server configuration, read once at startup.
 *
 * Every integration here is optional. The magazine composes, paginates and
 * exports without any of them, so a missing key switches one feature off
 * rather than stopping the server — the same bargain `polish.ts` already
 * makes. Each `*Configured` flag is what the routes check before doing work,
 * and what `describe()` prints on boot so a half-set-up server says so.
 */

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
  ].join("\n");
}
