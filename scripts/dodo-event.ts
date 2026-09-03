/**
 * Sends a correctly signed Dodo webhook to a local server.
 *
 * Dodo cannot reach localhost, and there is no `stripe listen` equivalent — so
 * either you run a tunnel, or you sign the events yourself. We hold the
 * signing secret, so this produces webhooks that are genuinely valid rather
 * than a bypass: `routes/dodo-webhook.ts` verifies these exactly as it would
 * verify Dodo's own, and rejects them if the secret is wrong.
 *
 * What it does not test is Dodo's hosted checkout, or that Dodo's real payload
 * matches the shape assumed here. Use it to exercise verification, the
 * database writes and entitlement; use a tunnel to check the real thing.
 *
 * Usage:
 *   bun scripts/dodo-event.ts subscription.active <supabase-user-id> [plan]
 *   bun scripts/dodo-event.ts subscription.cancelled <supabase-user-id>
 *   bun scripts/dodo-event.ts payment.succeeded <supabase-user-id>
 *
 * Reads DODO_WEBHOOK_KEY and DODO_PRODUCT_* from the environment, so run it
 * with the same .env the server uses:
 *   bun --env-file=.env scripts/dodo-event.ts …
 */

import { Webhook } from "standardwebhooks";

const TARGET = process.env.DODO_EVENT_TARGET ?? "http://localhost:3001/api/dodo/webhook";

const [type, userId, plan = "traveller"] = Bun.argv.slice(2);

if (!type || !userId) {
  console.error("usage: bun scripts/dodo-event.ts <event.type> <supabase-user-id> [traveller|cartographer]");
  process.exit(1);
}

const secret = process.env.DODO_WEBHOOK_KEY;
if (!secret) {
  console.error("DODO_WEBHOOK_KEY is not set. Run with `bun --env-file=.env scripts/dodo-event.ts …`");
  process.exit(1);
}

const product = plan === "cartographer" ? process.env.DODO_PRODUCT_CARTOGRAPHER : process.env.DODO_PRODUCT_TRAVELLER;
if (!product) {
  console.error(`DODO_PRODUCT_${plan.toUpperCase()} is not set — the webhook would skip the event as an unknown product.`);
  process.exit(1);
}

/** A stand-in customer, stable per user so repeated runs reuse the same one. */
const customerId = `cus_local_${userId.slice(0, 8)}`;

const subscription = {
  subscription_id: `sub_local_${userId.slice(0, 8)}`,
  status: type === "subscription.cancelled" ? "cancelled" : type === "subscription.on_hold" ? "on_hold" : "active",
  product_id: product,
  quantity: 1,
  next_billing_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  cancel_at_next_billing_date: false,
  customer: { customer_id: customerId, email: "local@example.test", name: "Local Tester" },
  // The same stamp `routes/billing.ts` puts on a real checkout session.
  metadata: { supabase_user_id: userId },
};

const payment = {
  payment_id: `pay_local_${Date.now()}`,
  subscription_id: subscription.subscription_id,
  total_amount: 900,
  currency: "USD",
  created_at: new Date().toISOString(),
  customer: subscription.customer,
  metadata: { supabase_user_id: userId },
};

const body = JSON.stringify({
  business_id: "biz_local",
  type,
  timestamp: new Date().toISOString(),
  data: type.startsWith("payment.")
    ? { payload_type: "Payment", ...payment }
    : { payload_type: "Subscription", ...subscription },
});

const id = `msg_local_${Date.now()}`;
const now = new Date();
const signature = new Webhook(secret).sign(id, now, body);

const response = await fetch(TARGET, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "webhook-id": id,
    "webhook-timestamp": Math.floor(now.getTime() / 1000).toString(),
    "webhook-signature": signature,
  },
  body,
});

console.log(`  ${type} -> ${TARGET}`);
console.log(`  ${response.status} ${await response.text()}`);
