/**
 * The Dodo Payments client and the plan/product mapping.
 *
 * Dodo is a merchant of record: it sells to the customer on our behalf,
 * handles the tax, and settles to us. That is the whole reason it is here —
 * a direct Stripe account registered in India cannot charge, and this can.
 *
 * The shape mirrors `stripe.ts` deliberately. Both providers answer the same
 * two questions — which product does this plan buy, and which plan does this
 * product grant — so `routes/billing.ts` can dispatch between them without
 * knowing anything else about either.
 *
 * Dodo has no price ids. A product carries its own price, so the mapping is
 * plan → product, and the `price_id` column holds a product id when the row
 * came from Dodo.
 */

import DodoPayments from "dodopayments";

import { dodo as config } from "@api/env";
import { unconfigured } from "@api/http";
import type { PaidPlan } from "@/types";

let client: DodoPayments | null = null;

/** Created lazily so a server with no Dodo keys still boots and serves. */
export function dodo(): DodoPayments {
  if (!config.apiKey) throw unconfigured("Billing is", "DODO_API_KEY");

  client ??= new DodoPayments({
    bearerToken: config.apiKey,
    // Verification reads this, so the client is constructed with it even
    // though checkout never needs it.
    webhookKey: config.webhookKey ?? null,
    // Test and live are different hosts entirely, not a key prefix as with
    // Stripe — pointing at the wrong one fails as "product not found" rather
    // than as anything that mentions the mode.
    environment: config.mode,
  });
  return client;
}

/** Product id for each paid plan, as configured on this server. */
export function productFor(plan: PaidPlan): string {
  const product = config.products[plan];
  if (!product) throw unconfigured("That plan is", `DODO_PRODUCT_${plan.toUpperCase()}`);
  return product;
}

/**
 * The plan a product id belongs to, or null if it belongs to none of them.
 *
 * The webhook uses this to name the plan on a subscription. A product that is
 * not one of ours — another product on the same Dodo account, or one retired
 * from the env — returns null and the event is skipped rather than guessed at.
 */
export function planForProduct(productId: string | null | undefined): PaidPlan | null {
  if (!productId) return null;
  const entries = Object.entries(config.products) as [PaidPlan, string | undefined][];
  return entries.find(([, product]) => product === productId)?.[0] ?? null;
}
