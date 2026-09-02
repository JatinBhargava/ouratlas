/**
 * The Stripe client and the plan/price mapping.
 *
 * Prices live in environment variables rather than in code: the same source
 * tree runs against test and live mode, and those are different price ids.
 */

import Stripe from "stripe";

import { stripe as config, billingConfigured } from "@api/env";
import { unconfigured } from "@api/http";
import type { PaidPlan } from "@/types";

let client: Stripe | null = null;

/** Created lazily so a server with no Stripe keys still boots and serves. */
export function stripe(): Stripe {
  if (!billingConfigured) {
    throw unconfigured("Billing is", "STRIPE_SECRET_KEY, STRIPE_PRICE_TRAVELLER and STRIPE_PRICE_CARTOGRAPHER");
  }

  client ??= new Stripe(config.secretKey!, {
    apiVersion: "2026-08-26.dahlia",
    // Bun resolves `stripe` to its worker build, which talks over fetch.
    // Naming the app makes this server identifiable in Stripe's request logs.
    appInfo: { name: "Atlas", url: "https://ouratlas.app" },
  });
  return client;
}

/** Price id for each paid plan, as configured on this server. */
export function priceFor(plan: PaidPlan): string {
  const price = config.prices[plan];
  if (!price) throw unconfigured("That plan is", `STRIPE_PRICE_${plan.toUpperCase()}`);
  return price;
}

/**
 * The plan a price id belongs to, or null if it belongs to none of them.
 *
 * The webhook uses this to name the plan on a subscription. A price that is
 * not one of ours — an old one, or another product on the same account —
 * returns null and the event is skipped rather than guessed at.
 */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  const entries = Object.entries(config.prices) as [PaidPlan, string | undefined][];
  return entries.find(([, price]) => price === priceId)?.[0] ?? null;
}

/** True when `plan` names a plan that can be bought. */
export function isPaidPlan(plan: unknown): plan is PaidPlan {
  return plan === "traveller" || plan === "cartographer";
}
