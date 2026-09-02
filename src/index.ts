/**
 * Development server for the frontend.
 *
 * Bun bundles `index.html` and its imports here, which is what gives hot
 * reload. The API is a separate Express process (`api/index.ts`), so anything
 * under `/api` is forwarded to it — that way the browser sees one origin and
 * cookies, redirects and Stripe return URLs all behave as they will in
 * production, where Express serves the built site itself.
 */

import { serve } from "bun";
import index from "./index.html";

const WEB_PORT = Number(process.env.WEB_PORT ?? 3000);
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

/**
 * Hands a request to the Express server untouched and streams the answer
 * back. The body is forwarded as a stream so the copy desk still arrives a
 * piece at a time rather than in one lump at the end.
 */
async function proxy(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(incoming.pathname + incoming.search, API_ORIGIN);

  try {
    return await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      // Required whenever a request body is a stream.
      duplex: "half",
      redirect: "manual",
    } as RequestInit);
  } catch (error) {
    // Almost always the API process not being up yet — worth saying outright,
    // because the symptom in the browser is an unexplained failed fetch.
    console.error(`[dev] cannot reach the API at ${API_ORIGIN}:`, error instanceof Error ? error.message : error);
    return Response.json({ error: `The API is not running at ${API_ORIGIN}. Start it with \`bun dev\`.` }, { status: 502 });
  }
}

const server = serve({
  port: WEB_PORT,

  routes: {
    "/api/*": proxy,

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`\n  Atlas frontend\n  ${server.url}\n  proxying /api to ${API_ORIGIN}\n`);
