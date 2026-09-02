/**
 * Starting a subscription, and managing one that already exists.
 *
 * Neither route takes a price or an amount from the browser — only a plan
 * name, which is looked up against this server's configured price ids. A
 * client that could name its own price could name its own price of zero.
 */

import { Router } from "express";

import { APP_URL } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { isPaidPlan, priceFor, stripe } from "@api/stripe";
import { admin, authenticate, getActiveSubscription, getProfile } from "@api/supabase";
import type { RedirectResponse } from "@/types";

export const billingRoutes = Router();

/**
 * The Stripe customer for an account, created on first use.
 *
 * The id is written back to the profile so a second visit reuses the same
 * customer; without that, someone who subscribes twice appears in Stripe as
 * two people and their billing history splits in half. The Supabase user id
 * goes into customer metadata as well, so a customer found in the dashboard
 * can always be traced back to an account.
 */
async function customerFor(userId: string, email: string | null): Promise<string> {
  const profile = await getProfile(userId);
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe().customers.create({
    email: email ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error } = await admin().from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);

  // The customer exists in Stripe either way. Failing here would strand it,
  // so the request carries on and the webhook writes the id when it fires.
  if (error) console.error(`[billing] could not store customer ${customer.id} for ${userId}: ${error.message}`);

  return customer.id;
}

/** Where Stripe sends people when they are finished. */
const RETURN = {
  success: `${APP_URL}/account?checkout=success`,
  cancel: `${APP_URL}/#pricing`,
  portal: `${APP_URL}/account`,
} as const;

/**
 * Opens a Checkout session for a plan.
 *
 * Someone who already subscribes is sent to the billing portal instead:
 * a second Checkout would bill them twice rather than move them between
 * plans, and switching plans is what they almost certainly meant.
 */
billingRoutes.post(
  "/checkout",
  authenticate,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const plan = (req.body as { plan?: unknown } | undefined)?.plan;

    if (!isPaidPlan(plan)) throw new HttpError(400, "Pick either the Traveller or the Cartographer plan.");

    const customer = await customerFor(user.id, user.email ?? null);
    const existing = await getActiveSubscription(user.id);

    if (existing) {
      const portal = await stripe().billingPortal.sessions.create({ customer, return_url: RETURN.portal });
      res.json({ url: portal.url } satisfies RedirectResponse);
      return;
    }

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
 * Opens Stripe's own billing portal — card changes, invoices, cancellation
 * and plan switches all live there rather than being rebuilt here.
 */
billingRoutes.post(
  "/portal",
  authenticate,
  asyncRoute(async (req, res) => {
    const user = req.user!;
    const profile = await getProfile(user.id);

    if (!profile?.stripe_customer_id) {
      throw new HttpError(404, "There is nothing to manage yet — you are on the free plan.");
    }

    const portal = await stripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: RETURN.portal,
    });

    res.json({ url: portal.url } satisfies RedirectResponse);
  }),
);
