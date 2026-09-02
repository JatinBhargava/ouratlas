/**
 * The project's visitor total, from Vercel Web Analytics via our API.
 *
 * Returns null until it is known, and stays null if it cannot be read — the
 * count is decoration, and a site that invents one is worse than a site that
 * shows none. The server caches the upstream call, so this is a cheap request.
 */

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { VisitsResponse } from "@/types";

export function useVisitorCount(): number | null {
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<VisitsResponse>("/api/visits")
      .then(data => {
        if (!cancelled) setVisitors(data.visitors);
      })
      .catch(() => {
        // Unconfigured (503) or upstream trouble. Neither is worth reporting to
        // someone reading a travel magazine; the counter simply stays hidden.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return visitors;
}
