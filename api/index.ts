/**
 * Server entry point.
 *
 * In production this process is the whole server: it serves the built
 * frontend out of `dist/` and answers the API on the same origin. In
 * development it answers only the API, and Bun's dev server (`src/index.ts`)
 * takes the browser's requests so hot reload keeps working.
 */

import { createApp } from "@api/app";
import { startCron } from "@api/cron";
import { describe, PORT, serveStatic } from "@api/env";

const app = createApp();

app.listen(PORT, () => {
  const role = serveStatic ? "site and API" : "API only — run `bun dev` for the frontend";
  console.log(`\n  Atlas ${role}\n  http://localhost:${PORT}\n`);
  console.log(describe());

  // Started after the server is listening, so the first keep-alive ping cannot
  // arrive before there is anything to answer it.
  const jobs = startCron();
  console.log(`   cron      ${jobs.length > 0 ? jobs.join(", ") : "no jobs (set KEEPALIVE_URL or deploy to Render)"}`);
  console.log("");
});
