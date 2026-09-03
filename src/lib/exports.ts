/**
 * Client side of the export allowance.
 *
 * The browser never decides anything here — it asks, and it is told. Both
 * calls answer with the same shape, so the tally on screen is always the
 * server's own count rather than one kept alongside it and drifting.
 */

import { api } from "@/lib/api";
import type { ExportAllowance } from "@/types";

/** What is left, without spending any of it. */
export function readAllowance(): Promise<ExportAllowance> {
  return api.get<ExportAllowance>("/api/exports");
}

/** Spends one. Throws with the server's own words when there is none left. */
export function claimExport(): Promise<ExportAllowance> {
  return api.post<ExportAllowance>("/api/exports");
}
