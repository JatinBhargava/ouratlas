/**
 * Stripe's side of the conversation.
 *
 * This is the only writer of the `subscriptions` and `payments` tables.
 * Checkout finishing in the browser proves nothing — the person can close the
 * tab, or forge the return URL — so entitlement is granted here, on a signed
 * event, or not at all.
 *
 * The two tables answer different questions and are kept independent.
 * `subscriptions` is current state, overwritten in place. `payments` is
 * history, appended to. Stripe does not order its events, so an invoice
 * routinely arrives before the subscription that caused it; neither write
 * waits on the other.
 *
 * The route is mounted with a raw body parser: the signature covers the exact
 * bytes Stripe sent, and a re-serialised JSON object is not those bytes.
 */

import { Router } from "express";
import type Stripe from "stripe";

import { stripe as config, stripeWebhookConfigured } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { planForPrice, stripe } from "@api/stripe";
import { admin } from "@api/supabase";

export const webhookRoutes = Router();

/** Stripe hands back either the id or the expanded object, depending on the call. */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * The account a subscription belongs to.
 *
 * Metadata is the fast path — it is stamped on at checkout. The customer
 * lookup is the fallback for subscriptions created elsewhere, such as by hand
 * in the Stripe dashboard.
 */
async function userIdForCustomer(customerId: string | null): Promise<string | null> {
  if (!customerId) return null;

  const { data } = await admin()
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (data?.id) return data.id as string;

  // Nothing links them yet — a customer created outside checkout. Its own
  // metadata is the last place the account id might be.
  const customer = await stripe().customers.retrieve(customerId);
  if (customer.deleted) return null;

  const userId = customer.metadata?.supabase_user_id;
  if (!userId) return null;

  // Found it the slow way; write the link so this lookup happens once.
  await admin().from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  return userId;
}

/**
 * The account a subscription belongs to.
 *
 * Metadata is the fast path — it is stamped on at checkout. The customer
 * lookup is the fallback for subscriptions created elsewhere, such as by hand
 * in the Stripe dashboard.
 */
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const stamped = subscription.metadata?.supabase_user_id;
  if (stamped) return stamped;

  return userIdForCustomer(idOf(subscription.customer));
}

/** Seconds since the epoch as an ISO string, or null. */
function at(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Records one invoice in the payments ledger.
 *
 * `failed` is passed in rather than read off the invoice because Stripe does
 * not have a "failed" invoice status: a card that is declined leaves the
 * invoice `open` and increments `attempt_count`. Only the event type says
 * what actually happened.
 */
async function recordPayment(invoice: Stripe.Invoice, failed: boolean): Promise<void> {
  const userId = await userIdForCustomer(idOf(invoice.customer));
  if (!userId) {
    console.error(`[webhook] no account for invoice ${invoice.id}; skipped`);
    return;
  }

  // As of API version 2025-03-31 an invoice names its subscription under
  // `parent`, not at the top level.
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription);

  const { error } = await admin().from("payments").upsert(
    {
      id: invoice.id,
      user_id: userId,
      provider: "stripe",
      subscription_id: subscriptionId,
      status: invoice.status ?? "open",
      last_attempt_failed: failed,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      invoice_number: invoice.number,
      hosted_invoice_url: invoice.hosted_invoice_url ?? null,
      invoice_pdf: invoice.invoice_pdf ?? null,
      period_start: at(invoice.period_start),
      period_end: at(invoice.period_end),
      paid_at: at(invoice.status_transitions?.paid_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new HttpError(500, `Could not record invoice ${invoice.id}: ${error.message}`);
}

/**
 * Mirrors one subscription into Supabase.
 *
 * Keyed on the Stripe subscription id, so events arriving twice or out of
 * order settle on the same row rather than accumulating duplicates.
 */
async function mirror(subscription: Stripe.Subscription): Promise<void> {
  const userId = await resolveUserId(subscription);
  if (!userId) {
    console.error(`[webhook] no account for subscription ${subscription.id}; skipped`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const plan = planForPrice(priceId);

  if (!plan) {
    // A price this server does not sell — another product on the same Stripe
    // account, or a price retired from the env. Guessing a plan here would
    // hand out an entitlement nobody paid for.
    console.warn(`[webhook] subscription ${subscription.id} uses unknown price ${priceId}; skipped`);
    return;
  }

  // As of API version 2025-03-31 the period lives on the item, not the
  // subscription; a subscription with several items has one period per item.
  const periodEnd = item?.current_period_end;

  const { error } = await admin().from("subscriptions").upsert(
    {
      id: subscription.id,
      user_id: userId,
      provider: "stripe",
      status: subscription.status,
      plan,
      price_id: priceId,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new HttpError(500, `Could not record subscription ${subscription.id}: ${error.message}`);
}

webhookRoutes.post(
  "/stripe/webhook",
  asyncRoute(async (req, res) => {
    if (!stripeWebhookConfigured) {
      throw new HttpError(503, "Billing webhooks are switched off: this server has no STRIPE_WEBHOOK_SECRET set.");
    }

    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") throw new HttpError(400, "Missing Stripe signature.");

    // `express.raw` leaves the body as a Buffer — the bytes the signature covers.
    const payload = req.body as Buffer;

    let event: Stripe.Event;
    try {
      // The async form is required here: Bun resolves `stripe` to its worker
      // build, which verifies through SubtleCrypto rather than node:crypto.
      event = await stripe().webhooks.constructEventAsync(payload, signature, config.webhookSecret!);
    } catch (error) {
      // A bad signature means this did not come from Stripe. Say so plainly
      // and do not log the body.
      console.error("[webhook] signature rejected:", error instanceof Error ? error.message : error);
      throw new HttpError(400, "Signature verification failed.");
    }

    // Switching on the type rather than testing a set is what narrows
    // `event.data.object` from "any Stripe object" to the one this case means.
    switch (event.type) {
      case "checkout.session.completed": {
        const subscriptionId = idOf(event.data.object.subscription);

        // The session carries no plan detail, so fetch the subscription it
        // created. A `customer.subscription.created` event covers the same
        // ground, but ordering between the two is not guaranteed and the row
        // should exist by the time the browser lands back on /account.
        if (subscriptionId) await mirror(await stripe().subscriptions.retrieve(subscriptionId));
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await mirror(event.data.object);
        break;

      // The ledger. These say what was charged; they never grant a plan —
      // that stays with the subscription events above.
      case "invoice.paid":
        await recordPayment(event.data.object, false);
        break;

      case "invoice.payment_failed":
        await recordPayment(event.data.object, true);
        break;

      // Stripe sends far more than this endpoint subscribes to. Anything else
      // is acknowledged so it is not retried, and otherwise ignored.
      default:
        res.json({ received: true, handled: false });
        return;
    }

    res.json({ received: true, handled: true });
  }),
);
