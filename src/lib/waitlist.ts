/**
 * Client side of the newsletter waitlist.
 *
 * No account required, so this is the one write anyone can make. The server
 * validates the address again; the check here only spares a round trip on an
 * obvious typo.
 */

import { api } from "@/lib/api";
import type { WaitlistResponse } from "@/types";

/** Which form the address was typed into, so a mailing can match the promise made. */
export type WaitlistSource = "footer" | "pricing" | "create";

/** Matches the server's rule in `api/routes/waitlist.ts`. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function joinWaitlist(email: string, source: WaitlistSource = "footer"): Promise<WaitlistResponse> {
  return api.post<WaitlistResponse>("/api/waitlist", { email: email.trim(), source });
}
