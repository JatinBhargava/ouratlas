/**
 * Outgoing email, through Resend's HTTP API.
 *
 * A fetch rather than the SDK: one endpoint, one JSON body, and nothing to
 * build lazily. Like every integration it is optional — `mailConfigured` in
 * `env.ts` — and a caller that finds it off simply does not send.
 *
 * Nothing is logged but the failure itself: the address and the words of a
 * message are the recipient's business.
 */

import { mail, mailConfigured } from "@api/env";

export type Message = { to: string; subject: string; text: string; html: string };

/** Sends one message. Resolves false rather than throwing: an email is never worth failing a request over. */
export async function sendMail(message: Message): Promise<boolean> {
  if (!mailConfigured) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${mail.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mail.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      console.error(`[mail] resend answered ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] could not reach resend:", error instanceof Error ? error.message : error);
    return false;
  }
}

/** For putting a reader's own words (a title, a reviewer's note) into HTML. */
export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
