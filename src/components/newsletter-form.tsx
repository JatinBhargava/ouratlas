import { Check, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlist, looksLikeEmail, type WaitlistSource } from "@/lib/waitlist";
import { cn } from "@/lib/utils";

type Status = { kind: "idle" | "sending" | "done" } | { kind: "error"; message: string };

type NewsletterFormProps = {
  source?: WaitlistSource;
  className?: string;
};

/**
 * The waitlist sign-up.
 *
 * Signing up twice is reported as success rather than as an error, because it
 * is: the address is on the list either way, and telling someone their own
 * email is already taken invites them to wonder whose it is.
 */
export function NewsletterForm({ source = "footer", className }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const sending = status.kind === "sending";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;

    if (!looksLikeEmail(email)) {
      setStatus({ kind: "error", message: "That does not look like an email address." });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      await joinWaitlist(email, source);
      setStatus({ kind: "done" });
      setEmail("");
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not add you to the list.",
      });
    }
  }

  if (status.kind === "done") {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-stone-700", className)} role="status">
        <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
        You're on the list. We'll write when there's something worth reading.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-2", className)} noValidate>
      <div className="flex items-center gap-2">
        <Input
          type="email"
          name="email"
          value={email}
          onChange={event => {
            setEmail(event.target.value);
            // Clear a stale complaint as soon as they start fixing it.
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Email address"
          aria-invalid={status.kind === "error"}
          disabled={sending}
          className="h-9 rounded-full border-stone-300 bg-white/80"
        />
        <Button type="submit" size="sm" className="shrink-0 rounded-full" disabled={sending}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="hidden sm:inline">{sending ? "Sending" : "Join"}</span>
        </Button>
      </div>

      {status.kind === "error" ? (
        <p className="text-xs text-red-600" role="alert">
          {status.message}
        </p>
      ) : (
        <p className="text-xs text-stone-500">Occasional letters about new layouts. No more than that.</p>
      )}
    </form>
  );
}
