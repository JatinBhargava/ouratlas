import { afterAll, expect, mock, test } from "bun:test";
import express from "express";
let inserts = 0;
mock.module("@api/supabase", () => ({
  admin: () => ({ from: () => ({ insert: async () => { inserts++; return { error: null }; } }) }),
  getActiveSubscription: async () => null,
}));
const { waitlistRoutes } = await import("./routes/waitlist");
const { errorHandler } = await import("./http");
const app = express();
app.use(express.json());
app.use("/api", waitlistRoutes);
app.use(errorHandler);
const server = app.listen(0, "127.0.0.1");
afterAll(() => { server.close(); });
const address = server.address() as { port: number };

test("waitlist limits an anonymous burst before writing more rows", async () => {
  for (let i = 0; i < 10; i++) {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/waitlist`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `reader${i}@example.com` }),
    });
    expect(response.status).toBe(200);
  }
  const response = await fetch(`http://127.0.0.1:${address.port}/api/waitlist`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "extra@example.com" }),
  });
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(inserts).toBe(10);
});
