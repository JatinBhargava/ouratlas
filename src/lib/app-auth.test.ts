import { expect, mock, test } from "bun:test";

let onReturn: ((event: { url: string }) => void) | undefined;
mock.module("@capacitor/app", () => ({ App: {
  addListener: async (_name: string, listener: typeof onReturn) => { onReturn = listener; },
  getLaunchUrl: async () => undefined,
} }));
mock.module("@capacitor/browser", () => ({ Browser: { close: async () => {}, open: async () => {} } }));
const { listenForSignInReturn, resolveReturn } = await import("./app-auth");
const origin = "https://localhost";

for (const path of ["/\\evil.example/x", "/\t\\evil.example/x", "//evil.example"]) {
  test(`auth code stays on app origin for ${JSON.stringify(path)}`, async () => {
    let target = "";
    Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin, replace: (url: string) => { target = url; } } } });
    await listenForSignInReturn();
    const link = new URL("in.co.ouratlas://auth");
    link.searchParams.set("to", path);
    link.searchParams.set("code", "SECRET");
    onReturn!({ url: link.toString() });
    const actual = new URL(target);
    expect(actual.origin).toBe(origin);
    expect(actual.pathname).toBe("/account");
    expect(actual.searchParams.get("code")).toBe("SECRET");
  });
}

test("normal return keeps path and query", () => {
  expect(resolveReturn("/ok?a=1", origin).href).toBe(`${origin}/ok?a=1`);
});

test("pure resolver rejects unsafe URL spellings", () => {
  for (const path of ["/\\evil.example/x", "/\t\\evil.example/x", "//evil.example", "https://evil.example", null]) {
    expect(resolveReturn(path, origin).href).toBe(`${origin}/account`);
  }
});
