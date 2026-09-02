/**
 * Client side of billing.
 *
 * Both calls end in a redirect to Stripe. Nothing about a card, a price or an
 * amount is handled here — the browser names a plan and the server decides
 * what that costs.
 */

import { api } from "@/lib/api";
import type { PaidPlan, RedirectResponse } from "@/types";

/**
 * Sends the person to Stripe Checkout for a plan.
 *
 * Someone who already subscribes is redirected to the billing portal instead;
 * the server makes that call, because only it knows whether a subscription
 * exists.
 */
export async function startCheckout(plan: PaidPlan): Promise<void> {
  const { url } = await api.post<RedirectResponse>("/api/billing/checkout", { plan });
  window.location.assign(url);
}

/** Opens Stripe's billing portal — cards, invoices, plan changes, cancellation. */
export async function openBillingPortal(): Promise<void> {
  const { url } = await api.post<RedirectResponse>("/api/billing/portal");
  window.location.assign(url);
}

/** Plan names as they appear in the pricing table. */
export const PLAN_LABELS = {
  free: "Wanderer",
  traveller: "Traveller",
  cartographer: "Cartographer",
} as const;
