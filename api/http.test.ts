import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Server } from "node:http";
import { createApp } from "./app";

let server: Server;
let url: string;
beforeAll(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No listening port");
  url = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

for (const [name, body, headers, status] of [
  ["malformed JSON", '{"secret":"do-not-echo",', { "Content-Type": "application/json" }, 400],
  ["oversized JSON", JSON.stringify({ value: "x".repeat(1024 * 1024) }), { "Content-Type": "application/json" }, 413],
  ["unsupported charset", '{}', { "Content-Type": "application/json; charset=bogus" }, 415],
  ["unsupported encoding", '{}', { "Content-Type": "application/json", "Content-Encoding": "bogus" }, 415],
] as const) {
  test(`body parser returns ${status} for ${name}`, async () => {
    const response = await fetch(`${url}/api/nope`, { method: "POST", headers, body });
    expect(response.status).toBe(status);
    const payload = await response.json();
    expect(typeof payload.error).toBe("string");
    expect(payload.error).not.toContain("do-not-echo");
  });
}

test("health and unmatched requests still work", async () => {
  expect((await fetch(`${url}/api/health`)).status).toBe(200);
  expect((await fetch(`${url}/api/nope`)).status).toBe(404);
});
