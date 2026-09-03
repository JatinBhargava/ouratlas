/**
 * Starting a subscription, and managing one that already exists.
 *
 * Neither route takes a price or an amount from the browser — only a plan
 * name, which is looked up against this server's configured price ids. A
 * client that could name its own price could name its own price of zero.
 */

import { Router } from "express";

import { APP_URL, billingProvider } from "@api/env";
import { dodo, productFor } from "@api/dodo";
import { asyncRoute, HttpError } from "@api/http";
import { isPaidPlan, priceFor, stripe } from "@api/stripe";
import { admin, authenticate, CUSTOMER_COLUMN, getActiveSubscription, getProfile } from "@api/supabase";
import type { PaidPlan, RedirectResponse } from "@/types";

export const billingRoutes = Router();

/**
 * Remembers a processor's customer id against an account.
 *
 * Without this, someone who subscribes twice appears at the processor as two
 * people and their billing history splits in half. The write is best-effort:
 * the customer exists at the processor either way, and failing here would
 * strand it — so the request carries on and the webhook writes the id when it
 * fires.
 */
async function remember(provider: "stripe" | "dodo", userId: string, customerId: string): Promise<void> {
  const { error } = await admin()
    .from("profiles")
    .update({ [CUSTOMER_COLUMN[provider]]: customerId })
    .eq("id", userId);

  if (error) console.error(`[billing] could not store ${provider} customer ${customerId} for ${userId}: ${error.message}`);
}

/**
 * The Stripe customer for an account, created on first use.
 *
 * The Supabase user id goes into customer metadata as well, so a customer
 * found in the dashboard can always be traced back to an account.
 */
async function stripeCustomerFor(userId: string, email: string | null): Promise<string> {
  const profile = await getProfile(userId);
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await remember("stripe", userId, customer.id);
  return customer.id;
}

/** Where the processor sends people when they are finished. */
const RETURN = {
  success: `${APP_URL}/account?checkout=success`,
  cancel: `${APP_URL}/pricing`,
  portal: `${APP_URL}/account`,
} as const;

/**
 * Dodo's checkout, which differs from Stripe's in two ways that matter.
 *
 * There is no customer object to create up front: the session takes either an
 * existing `customer_id` or an email, and Dodo makes the customer itself. And
 * there are no price ids — the product carries its own price — so the cart
 * names a product.
 *
 * The returned URL is single-use and expires within 24 hours, so it is never
 * cached or reused.
 */
async function dodoCheckout(userId: string, email: string | null, plan: PaidPlan): Promise<string> {
  const profile = await getProfile(userId);

  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: productFor(plan), quantity: 1 }],
    customer: profile?.dodo_customer_id
      ? { customer_id: profile.dodo_customer_id }
      : { email: email ?? "", name: profile?.full_name ?? "" },
    return_url: RETURN.success,
    // Read back by the webhook, which is the only thing that grants a plan.
    // Session metadata is the only place to stamp this: Dodo's
    // `subscription_data` carries trial and on-demand settings and nothing
    // else. The webhook does not rely on it arriving — it falls back to
    // finding the account by customer id.
    metadata: { supabase_user_id: userId },
  });

  if (!session.checkout_url) throw new HttpError(502, "Dodo did not return a checkout page. Try again.");
  return session.checkout_url;
}

/** Dodo's self-service portal: cards, invoices and cancellation. */
async function dodoPortal(customerId: string): Promise<string> {
  const session = await dodo().customers.customerPortal.create(customerId, { return_url: RETURN.portal });

  if (!session.link) throw new HttpError(502, "Dodo did not return a portal link. Try again.");
  return session.link;
}

/**
 * Opens a Checkout session for a plan, at whichever processor is live.
 */
billingRoutes.post(
  "/checkout",
  authenticate,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const plan = (req.body as { plan?: unknown } | undefined)?.plan;

    if (!isPaidPlan(plan)) throw new HttpError(400, "Pick either the Traveller or the Cartographer plan.");

    const provider = billingProvider();
    if (!provider) throw new HttpError(503, "Subscriptions are switched off: this server has no payment provider set up.");

    const existing = await getActiveSubscription(user.id);

    // Someone who already subscribes is sent to the portal instead: a second
    // checkout would bill them twice rather than move them between plans, and
    // switching plans is what they almost certainly meant. The portal has to
    // be the one belonging to the subscription they actually hold, not to
    // whichever provider happens to be current.
    if (existing) {
      const profile = await getProfile(user.id);
      const customerId = profile?.[CUSTOMER_COLUMN[existing.provider]];

      if (!customerId) throw new HttpError(409, "Your subscription is not linked to a billing account. Get in touch and we will sort it out.");

      const url =
        existing.provider === "dodo"
          ? await dodoPortal(customerId)
          : (await stripe().billingPortal.sessions.create({ customer: customerId, return_url: RETURN.portal })).url;

      res.json({ url } satisfies RedirectResponse);
      return;
    }

    if (provider === "dodo") {
      res.json({ url: await dodoCheckout(user.id, user.email ?? null, plan) } satisfies RedirectResponse);
      return;
    }

    const customer = await stripeCustomerFor(user.id, user.email ?? null);
    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: priceFor(plan), quantity: 1 }],
      success_url: RETURN.success,
      cancel_url: RETURN.cancel,
      allow_promotion_codes: true,
      // Both are belt and braces for the webhook: whichever event arrives
      // first can map the payment back to an account without a lookup.
      client_reference_id: user.id,
      subscription_data: { metadata: { supabase_user_id: user.id } },
    });

    if (!session.url) throw new HttpError(502, "Stripe did not return a checkout page. Try again.");

    res.json({ url: session.url } satisfies RedirectResponse);
  }),
);

/**
 * Opens the processor's own billing portal — card changes, invoices,
 * cancellation and plan switches all live there rather than being rebuilt
 * here.
 *
 * The portal follows the subscription, not the server's current preference: a
 * subscriber from before a provider switch must still be able to cancel, and
 * their card is held by the old processor. Only when there is no subscription
 * at all does this fall back to whichever provider is live.
 */
billingRoutes.post(
  "/portal",
  authenticate,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const profile = await getProfile(user.id);
    const existing = await getActiveSubscription(user.id);

    const provider = existing?.provider ?? billingProvider();
    const customerId = provider ? profile?.[CUSTOMER_COLUMN[provider]] : null;

    if (!provider || !customerId) {
      throw new HttpError(404, "There is nothing to manage yet — you are on the free plan.");
    }

    const url =
      provider === "dodo"
        ? await dodoPortal(customerId)
        : (await stripe().billingPortal.sessions.create({ customer: customerId, return_url: RETURN.portal })).url;

    res.json({ url } satisfies RedirectResponse);
  }),
);
