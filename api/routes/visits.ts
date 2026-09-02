/**
 * The visitor count shown in the navigation.
 *
 * Vercel's Web Analytics API needs an access token with full account reach, so
 * the browser cannot call it — this route does, and returns nothing but the two
 * numbers. That is also why the response is deliberately thin: no dimensions,
 * no paths, no referrers, just a total.
 */

import { Router } from "express";

import { analyticsConfigured, vercel } from "@api/env";
import { asyncRoute, HttpError, unconfigured } from "@api/http";
import type { VisitsResponse } from "@/types";

export const visitsRoutes = Router();

const ENDPOINT = "https://api.vercel.com/v1/query/web-analytics/visits/count";

/**
 * How long a count is reused.
 *
 * The number moves slowly and is decoration, so a fresh call per page load
 * would spend Vercel's rate limit on a figure nobody watches change. Ten
 * minutes keeps it honest without the traffic.
 */
const TTL_MS = 10 * 60 * 1000;

let cached: { value: VisitsResponse; at: number } | null = null;

/**
 * How far back the readership figure reaches.
 *
 * Thirty days, for two reasons. Left to itself the count endpoint reports
 * *today only*, so circulation would reset every midnight — a figure that falls
 * to nothing overnight is worse than none. And the hobby plan refuses any range
 * older than 31 days, so a lifetime total is not on offer regardless. A rolling
 * month is also what a periodical would quote.
 */
const WINDOW_DAYS = 30;

/** Vercel wants plain calendar dates here, not timestamps. */
function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function fetchCounts(): Promise<VisitsResponse> {
  const params = new URLSearchParams({
    projectId: vercel.projectId!,
    since: isoDate(-WINDOW_DAYS),
    until: isoDate(1),
  });
  // Only teams take this; sending it for a personal project is an error.
  if (vercel.teamId) params.set("teamId", vercel.teamId);

  const response = await fetch(`${ENDPOINT}?${params}`, {
    headers: { Authorization: `Bearer ${vercel.token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    // Vercel's message describes the request, never the token, so it is safe
    // to log — but the caller gets something plainer.
    const detail = await response.text().catch(() => "");
    console.error(`[visits] Vercel API ${response.status}: ${detail.slice(0, 200)}`);
    throw new HttpError(502, "Could not read the visitor count.");
  }

  const body = (await response.json()) as { data?: { pageviews?: number; visitors?: number } };

  return {
    visitors: body.data?.visitors ?? 0,
    pageviews: body.data?.pageviews ?? 0,
  };
}

visitsRoutes.get(
  "/visits",
  asyncRoute(async (_req, res) => {
    if (!analyticsConfigured) throw unconfigured("The visitor count is", "VERCEL_API_TOKEN and VERCEL_PROJECT_ID");

    if (cached && Date.now() - cached.at < TTL_MS) {
      res.json(cached.value);
      return;
    }

    try {
      const value = await fetchCounts();
      cached = { value, at: Date.now() };
      res.json(value satisfies VisitsResponse);
    } catch (error) {
      // A stale number beats no number: the counter is decoration, and a brief
      // Vercel outage should not blank it out.
      if (cached) {
        console.warn("[visits] serving a stale count after a failed refresh");
        res.json(cached.value);
        return;
      }
      throw error;
    }
  }),
);
