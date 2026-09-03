/**
 * Dodo's side of the conversation.
 *
 * The same contract as the Stripe webhook and for the same reason: checkout
 * finishing in the browser proves nothing — the person can close the tab, or
 * forge the return URL — so entitlement is granted here, on a signed event, or
 * not at all. This and `webhook.ts` are the only writers of `subscriptions`
 * and `payments`.
 *
 * Dodo follows the Standard Webhooks spec: three headers (`webhook-id`,
 * `webhook-signature`, `webhook-timestamp`) over the raw body. As with Stripe,
 * the route is mounted with a raw body parser, because the signature covers
 * the exact bytes Dodo sent and a re-serialised JSON object is not those bytes.
 *
 * Dodo retries a non-2xx up to eight times over about eighteen hours, so a
 * transient failure here is recoverable — but it expects an answer within
 * fifteen seconds.
 */

import { Router } from "express";

import { dodo, planForProduct } from "@api/dodo";
import { dodoWebhookConfigured } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { admin } from "@api/supabase";

export const dodoWebhookRoutes = Router();

/**
 * The account a Dodo customer belongs to.
 *
 * The link is written on the first event that carries both, so this lookup
 * costs one query from then on. A customer created outside our checkout — by
 * hand in the dashboard, say — will not be found, and the event is skipped
 * rather than attached to a guess.
 */
async function userIdForCustomer(customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;

  const { data } = await admin().from("profiles").select("id").eq("dodo_customer_id", customerId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * The account an event belongs to, and the customer id to remember for it.
 *
 * Metadata is the fast path — `routes/billing.ts` stamps the Supabase user id
 * onto the checkout session. The customer lookup is the fallback for anything
 * that arrives without it.
 */
async function resolve(
  metadata: Record<string, unknown> | null | undefined,
  customerId: string | null | undefined,
): Promise<string | null> {
  const stamped = metadata?.supabase_user_id;
  const userId = typeof stamped === "string" && stamped.length > 0 ? stamped : await userIdForCustomer(customerId);
  if (!userId) return null;

  // Remember the customer so the next event does not need the metadata. Dodo
  // creates the customer during checkout, so this is the first chance we get.
  if (customerId) {
    const { error } = await admin().from("profiles").update({ dodo_customer_id: customerId }).eq("id", userId);
    if (error) console.error(`[dodo] could not link customer ${customerId} to ${userId}: ${error.message}`);
  }

  return userId;
}

/** ISO already, unlike Stripe's epoch seconds — but not always present. */
const at = (value: string | null | undefined): string | null => value ?? null;

/**
 * Mirrors one subscription into Supabase.
 *
 * Keyed on Dodo's subscription id, so events arriving twice or out of order
 * settle on the same row rather than accumulating duplicates.
 */
async function mirror(subscription: {
  subscription_id: string;
  status: string;
  product_id: string;
  next_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean | null;
  customer?: { customer_id?: string } | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const userId = await resolve(subscription.metadata, subscription.customer?.customer_id);
  if (!userId) {
    console.error(`[dodo] no account for subscription ${subscription.subscription_id}; skipped`);
    return;
  }

  const plan = planForProduct(subscription.product_id);
  if (!plan) {
    // A product this server does not sell — another product on the same Dodo
    // account, or one retired from the env. Guessing a plan here would hand
    // out an entitlement nobody paid for.
    console.warn(`[dodo] subscription ${subscription.subscription_id} uses unknown product ${subscription.product_id}; skipped`);
    return;
  }

  const { error } = await admin().from("subscriptions").upsert(
    {
      id: subscription.subscription_id,
      user_id: userId,
      provider: "dodo",
      status: subscription.status,
      plan,
      // Dodo has no price object; the product is what carries the price.
      price_id: subscription.product_id,
      current_period_end: at(subscription.next_billing_date),
      cancel_at_period_end: subscription.cancel_at_next_billing_date ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new HttpError(500, `Could not record subscription ${subscription.subscription_id}: ${error.message}`);
}

/**
 * Records one payment in the ledger.
 *
 * Amounts are in the currency's minor unit, as Dodo sends them and as the
 * table expects. Dodo reports a payment as a single settled figure rather than
 * Stripe's due/paid pair, so a failure records what was owed and nothing paid.
 */
async function recordPayment(
  payment: {
    payment_id: string;
    subscription_id?: string | null;
    total_amount?: number | null;
    currency?: string | null;
    created_at?: string | null;
    customer?: { customer_id?: string } | null;
    metadata?: Record<string, unknown> | null;
  },
  failed: boolean,
): Promise<void> {
  const userId = await resolve(payment.metadata, payment.customer?.customer_id);
  if (!userId) {
    console.error(`[dodo] no account for payment ${payment.payment_id}; skipped`);
    return;
  }

  const amount = payment.total_amount ?? 0;

  const { error } = await admin().from("payments").upsert(
    {
      id: payment.payment_id,
      user_id: userId,
      provider: "dodo",
      subscription_id: payment.subscription_id ?? null,
      status: failed ? "open" : "paid",
      last_attempt_failed: failed,
      amount_due: amount,
      amount_paid: failed ? 0 : amount,
      currency: (payment.currency ?? "usd").toLowerCase(),
      // Dodo issues invoices on its own schedule and serves them from the
      // customer portal rather than handing back a URL on the event.
      invoice_number: null,
      hosted_invoice_url: null,
      invoice_pdf: null,
      period_start: null,
      period_end: null,
      paid_at: failed ? null : at(payment.created_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new HttpError(500, `Could not record payment ${payment.payment_id}: ${error.message}`);
}

dodoWebhookRoutes.post(
  "/dodo/webhook",
  asyncRoute(async (req, res) => {
    if (!dodoWebhookConfigured) {
      throw new HttpError(503, "Dodo webhooks are switched off: this server has no DODO_WEBHOOK_KEY set.");
    }

    // `express.raw` leaves the body as a Buffer — the bytes the signature covers.
    const payload = (req.body as Buffer).toString("utf8");

    const headers: Record<string, string> = {};
    for (const name of ["webhook-id", "webhook-signature", "webhook-timestamp"]) {
      const value = req.headers[name];
      if (typeof value !== "string") throw new HttpError(400, `Missing ${name} header.`);
      headers[name] = value;
    }

    let event: ReturnType<ReturnType<typeof dodo>["webhooks"]["unwrap"]>;
    try {
      event = dodo().webhooks.unwrap(payload, { headers });
    } catch (error) {
      // A bad signature means this did not come from Dodo. Say so plainly and
      // do not log the body.
      console.error("[dodo] signature rejected:", error instanceof Error ? error.message : error);
      throw new HttpError(400, "Signature verification failed.");
    }

    switch (event.type) {
      // Every state a subscription can reach. They all mirror, because the
      // row is current state — `getActiveSubscription` decides which statuses
      // actually entitle, and it is the only place that decision is made.
      case "subscription.active":
      case "subscription.renewed":
      case "subscription.on_hold":
      case "subscription.plan_changed":
      case "subscription.cancelled":
      case "subscription.expired":
      case "subscription.failed":
        await mirror(event.data as Parameters<typeof mirror>[0]);
        break;

      // The ledger. These say what was charged; they never grant a plan —
      // that stays with the subscription events above.
      case "payment.succeeded":
        await recordPayment(event.data as Parameters<typeof recordPayment>[0], false);
        break;

      case "payment.failed":
        await recordPayment(event.data as Parameters<typeof recordPayment>[0], true);
        break;

      // Dodo sends far more than this endpoint subscribes to — refunds,
      // disputes, licence keys. Anything else is acknowledged so it is not
      // retried for eighteen hours, and otherwise ignored.
      default:
        res.json({ received: true, handled: false });
        return;
    }

    res.json({ received: true, handled: true });
  }),
);
