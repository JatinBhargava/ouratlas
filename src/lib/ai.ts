/**
 * Client side of the AI allowances.
 *
 * Like `exports.ts`, the browser decides nothing: the server counts, and this
 * only asks what is left so the desk can say so before the reader presses a
 * button that would be refused.
 */

import { api } from "@/lib/api";
import type { AiAllowance } from "@/types";

/** This month's designs and copy-desk passes, without spending any. */
export function readAiAllowance(): Promise<AiAllowance> {
  return api.get<AiAllowance>("/api/ai/allowance");
}
