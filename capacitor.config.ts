/**
 * The Android (and later iPhone) app: the same site, packaged by Capacitor.
 *
 * The app ships the `dist/` that `bun run app:build` makes, and loads it from
 * the phone rather than from ouratlas.co.in, so the magazine engine measures
 * and draws in the phone's own browser engine exactly as the mobile site does.
 * That build names the API and the public site (`BUN_PUBLIC_API_URL`,
 * `BUN_PUBLIC_SITE_URL`), because on the phone there is nothing forwarding
 * `/api` and `localhost` links would open nowhere.
 */

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent once the first build is uploaded to Google Play (and to the App
  // Store later): it is the app's identity there, and changing it means
  // publishing a different app. The site's domain, reversed.
  appId: "in.co.ouratlas",
  appName: "Atlas",
  webDir: "dist",

  server: {
    // Served as https://localhost, the origin `api/cors.ts` allows by default.
    // A secure origin is also what WebCrypto needs to seal saved issues.
    // Capacitor's default already; stated so a future default cannot move the
    // origin out from under the API's CORS list.
    androidScheme: "https",
  },
};

export default config;
