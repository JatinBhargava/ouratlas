/**
 * The Express application.
 *
 * Assembly order matters here more than usual, and each step says why.
 * Kept separate from `index.ts` so the app can be built without a port being
 * bound — which is what a test would want.
 */

import express, { type Express } from "express";
import path from "node:path";

import { APP_VERSION, serveStatic } from "@api/env";
import { errorHandler, notFound } from "@api/http";
import { authRoutes } from "@api/routes/auth";
import { billingRoutes } from "@api/routes/billing";
import { polishRoutes } from "@api/routes/polish";
import { waitlistRoutes } from "@api/routes/waitlist";
import { webhookRoutes } from "@api/routes/webhook";

/** Where `bun run build` puts the frontend. */
const DIST = path.join(process.cwd(), "dist");

export function createApp(): Express {
  const app = express();

  // Behind a proxy or tunnel (Stripe CLI, Fly, Vercel), trust the forwarded
  // headers so request logging and rate limiting see the real client.
  app.set("trust proxy", true);

  // Express advertises itself by default; there is nothing to gain from
  // telling the internet which framework this is.
  app.disable("x-powered-by");

  // The webhook must see the bytes Stripe signed, so its raw parser is
  // mounted before the JSON one. body-parser marks a request as read, so the
  // JSON parser below leaves this path alone.
  app.use("/api/stripe/webhook", express.raw({ type: "application/json", limit: "1mb" }));

  // Generous enough for a 10,000-word story going to the copy desk.
  app.use(express.json({ limit: "1mb" }));

  // Carries the version so a deploy can be confirmed from outside — comparing
  // this against versions.json is how you tell whether the rollout landed.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "api", version: APP_VERSION });
  });

  app.use("/api", authRoutes);
  app.use("/api", waitlistRoutes);
  app.use("/api", polishRoutes);
  app.use("/api", webhookRoutes);
  app.use("/api/billing", billingRoutes);

  // A mistyped endpoint should say so in JSON rather than fall through to the
  // SPA shell, which would hand the client HTML where it expected an answer.
  app.use("/api", notFound);

  if (serveStatic) {
    app.use(express.static(DIST));

    // Client-side routing: anything not matched above is a page, so hand back
    // the shell and let React Router work out what it is. Mounted as
    // middleware rather than a wildcard route to stay clear of Express 5's
    // stricter path syntax.
    app.use((_req, res) => {
      res.sendFile(path.join(DIST, "index.html"));
    });
  }

  // Last, so it catches everything above it.
  app.use(errorHandler);

  return app;
}
