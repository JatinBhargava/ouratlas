import { afterAll, describe, expect, mock, test } from "bun:test";
import Stripe from "stripe";

process.env.STRIPE_SECRET_KEY = "sk_test_x";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_PRICE_TRAVELLER = "price_traveller";
process.env.STRIPE_PRICE_CARTOGRAPHER = "price_cartographer";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

const subscriptions = new Map<string, Record<string, unknown>>();

const fake = {
  from: (table: string) => ({
    update: () => ({ eq: async () => ({ error: null }) }),
    select: () => ({ eq: (_key: string, id: string) => ({ maybeSingle: async () => ({ data: subscriptions.get(id) ?? null, error: null }) }) }),
    upsert: async (row: Record<string, unknown>) => {
      if (table === "subscriptions") subscriptions.set(String(row.id), row);
      return { error: null };
    },
  }),
};
mock.module("@api/supabase", () => ({ admin: () => fake }));

const express = (await import("express")).default;
const { webhookRoutes } = await import("@api/routes/webhook");

const app = express();
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api", webhookRoutes);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;

afterAll(() => { server.close(); });

async function deliver(type: string, status: string, created: number, id: string) {
  const payload = JSON.stringify({
    id,
    object: "event",
    type,
    created,
    data: {
      object: {
        id: "sub_1",
        object: "subscription",
        status,
        customer: "cus_1",
        cancel_at_period_end: false,
        metadata: { supabase_user_id: "user_1" },
        items: { data: [{ price: { id: "price_traveller" }, current_period_end: created + 86_400 }] },
      },
    },
  });
  const header = await new Stripe("sk_test_x").webhooks.generateTestHeaderStringAsync({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET!,
  });
  const response = await fetch(`http://localhost:${port}/api/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
  return response.status;
}

describe("Stripe subscription events that arrive out of order", () => {
  test("a late retry of an older update does not undo a newer cancellation", async () => {
    const now = Math.floor(Date.now() / 1000);
    expect(await deliver("customer.subscription.deleted", "canceled", now, "evt_cancel")).toBe(200);
    expect(subscriptions.get("sub_1")?.status).toBe("canceled");

    // Stripe does not guarantee order, and it retries a failed delivery for days.
    expect(await deliver("customer.subscription.updated", "active", now - 300, "evt_older")).toBe(200);

    expect(subscriptions.get("sub_1")?.status).toBe("canceled");
  });
});

 test("a newer Stripe event still applies", async () => {
  subscriptions.clear();
  const now = Math.floor(Date.now() / 1000);
  expect(await deliver("customer.subscription.deleted", "canceled", now, "evt_cancel_new")).toBe(200);
  expect(await deliver("customer.subscription.updated", "active", now + 1, "evt_newer")).toBe(200);
  expect(subscriptions.get("sub_1")?.status).toBe("active");
  expect(subscriptions.get("sub_1")?.updated_at).toBe(new Date((now + 1) * 1000).toISOString());
 });
