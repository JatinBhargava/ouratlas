import { createHmac } from "node:crypto";
import { afterAll, describe, expect, mock, test } from "bun:test";

process.env.DODO_API_KEY = "test-key";
process.env.DODO_WEBHOOK_KEY = `whsec_${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}`;
process.env.DODO_PRODUCT_TRAVELLER = "pdt_traveller";
process.env.SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

/** One row per subscription id, written the way the route writes it. */
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
const { dodoWebhookRoutes } = await import("@api/routes/dodo-webhook");

const app = express();
app.use("/api/dodo/webhook", express.raw({ type: "application/json" }));
app.use("/api", dodoWebhookRoutes);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;

afterAll(() => { server.close(); });

let sequence = 0;
async function deliver(type: string, status: string, occurredAt: string | undefined, id = `msg_${++sequence}`) {
  const payload = JSON.stringify({
    business_id: "bus_1",
    type,
    timestamp: occurredAt,
    data: {
      payload_type: "Subscription",
      subscription_id: "sub_1",
      status,
      product_id: "pdt_traveller",
      next_billing_date: "2026-11-01T00:00:00Z",
      cancel_at_next_billing_date: false,
      metadata: { supabase_user_id: "user_1" },
    },
  });
  const stamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(process.env.DODO_WEBHOOK_KEY!.replace("whsec_", ""), "base64");
  const signature = createHmac("sha256", key).update(`${id}.${stamp}.${payload}`).digest("base64");
  const response = await fetch(`http://localhost:${port}/api/dodo/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": stamp,
      "webhook-signature": `v1,${signature}`,
    },
    body: payload,
  });
  return response.status;
}

describe("Dodo subscription events that arrive out of order", () => {
  test("a late retry of an older event does not undo a newer cancellation", async () => {
    // The cancellation happened at 10:05 and was delivered straight away.
    expect(await deliver("subscription.cancelled", "cancelled", "2026-10-01T10:05:00Z")).toBe(200);
    expect(subscriptions.get("sub_1")?.status).toBe("cancelled");

    // `subscription.active` from 10:00 failed once and Dodo retries it later.
    expect(await deliver("subscription.active", "active", "2026-10-01T10:00:00Z")).toBe(200);

    expect(subscriptions.get("sub_1")?.status).toBe("cancelled");
  });
});

 test("a newer Dodo event still applies", async () => {
  subscriptions.clear();
  expect(await deliver("subscription.cancelled", "cancelled", "2026-10-01T10:05:00Z")).toBe(200);
  expect(await deliver("subscription.active", "active", "2026-10-01T10:06:00Z")).toBe(200);
  expect(subscriptions.get("sub_1")?.status).toBe("active");
  expect(subscriptions.get("sub_1")?.updated_at).toBe("2026-10-01T10:06:00.000Z");
 });

for (const timestamp of [undefined, "not-a-date"]) {
  test(`non-orderable Dodo event is acknowledged without changing state (${timestamp})`, async () => {
    subscriptions.clear();
    expect(await deliver("subscription.cancelled", "cancelled", "2026-10-01T10:05:00Z")).toBe(200);
    expect(await deliver("subscription.active", "active", timestamp)).toBe(200);
    expect(subscriptions.get("sub_1")?.status).toBe("cancelled");
  });
}
