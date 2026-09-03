import { Check, Compass, Loader2, Map, Stamp, Tent } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { startCheckout } from "@/lib/billing";
import { cn } from "@/lib/utils";
import type { PaidPlan, Plan as PlanId } from "@/types";

type Plan = {
  /** Matches the plan names the API and Stripe use. */
  id: PlanId;
  name: string;
  icon: typeof Compass;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Wanderer",
    icon: Tent,
    price: "Free",
    cadence: "one story at a time",
    description: "A keepsake from a single trip.",
    features: ["10 photos per story", "Up to 5,000 words", "Web export", "Two layout themes"],
    cta: "Start your first story",
  },
  {
    id: "traveller",
    name: "Traveller",
    icon: Compass,
    price: "₹499",
    cadence: "per month",
    description: "For more than one story a year.",
    features: [
      "Unlimited stories",
      "Up to 10,000 words",
      "Print-quality PDF export",
      "All layout themes",
      "Voice transcription",
    ],
    cta: "Choose Traveller",
    featured: true,
  },
  {
    id: "cartographer",
    name: "Cartographer",
    icon: Map,
    price: "₹1,199",
    cadence: "per month",
    description: "Full control of how it looks.",
    features: [
      "Everything in Traveller",
      "Custom fonts and palettes",
      "Editable page layouts",
      "Bulk export",
      "Priority support",
    ],
    cta: "Choose Cartographer",
  },
];

/**
 * Whether checkout is open, decided when the bundle is built.
 *
 * Read through a catch rather than a `typeof process` guard, for the reason
 * set out at length in `lib/supabase.ts`: an unset BUN_PUBLIC_ variable is
 * never substituted, so the expression survives into the browser and reading
 * `process` there throws — and a guard would be evaluated at runtime and
 * throw the inlined value away.
 */
function checkoutOpen(): boolean {
  try {
    return process.env.BUN_PUBLIC_CHECKOUT === "on";
  } catch {
    return false;
  }
}

/**
 * Whether the plans are still at proof: the notice shows and the paid buttons
 * are dead.
 *
 * On unless told otherwise, which is the honest state. Dodo has not enabled
 * payment processing on the account, so checkout fails at the processor with
 * "Payment mode not enabled for this merchant" before the card is ever tried.
 * Offering a button that always fails is worse than offering none.
 *
 * `BUN_PUBLIC_CHECKOUT=on` opens it, which is how checkout is exercised
 * against Dodo's test mode locally without shipping a live paywall. It is a
 * property of the build, not a setting a visitor can reach.
 *
 * Delete this, the notice and the `locked` branch below on the day the
 * account is approved.
 */
const SUBSCRIPTIONS_AT_PROOF = !checkoutOpen();

export function PricingSection() {
  const { user, billing, configured, signInWithGoogle } = useAuth();
  const [pending, setPending] = useState<PaidPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Signing in and paying are one gesture from the reader's side.
   *
   * Someone not signed in goes to Google first and comes back to this section;
   * they then press the plan again, which is a click more than a session-aware
   * redirect would cost, but it means no one is sent to a payment page by a
   * redirect they did not expect.
   */
  async function choose(plan: PaidPlan) {
    setError(null);

    if (!configured) {
      setError("Subscriptions are switched off on this server.");
      return;
    }

    if (!user) {
      try {
        await signInWithGoogle("/pricing");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not open Google sign-in.");
      }
      return;
    }

    setPending(plan);
    try {
      await startCheckout(plan);
      // On success the browser is already navigating to Stripe; leaving
      // `pending` set keeps the button busy rather than flickering back.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open checkout.");
      setPending(null);
    }
  }

  return (
    <section id="pricing" className="flex flex-col gap-8">
      <SectionHeading
        kicker="Subscriptions"
        title="Keep the whole journey"
        description="Your photos and words never touch our database — every plan sends the finished magazine straight to you."
      />

      {SUBSCRIPTIONS_AT_PROOF && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/85 px-5 py-4 backdrop-blur-md"
        >
          <Stamp className="mt-0.5 size-4 shrink-0 text-stone-400" />
          <p className="text-sm text-stone-700">
            <span className="font-medium text-stone-900">Subscriptions are at proof.</span> The plans below are settled,
            but our payments partner is still checking our masthead, so the paid plans are closed for the moment.
            Wanderer is free and works in full today — start a story, and we will have the presses running shortly.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(plan => {
          const current = billing.plan === plan.id && plan.id !== "free";
          const busy = pending === plan.id;
          // Managing an existing plan stays open: someone already subscribed
          // must still be able to reach the portal and cancel.
          const locked = SUBSCRIPTIONS_AT_PROOF && plan.id !== "free" && !current;

          return (
            <Card
              key={plan.name}
              className={cn(
                "flex h-full flex-col gap-0 rounded-2xl p-7 shadow-sm transition-colors duration-200",
                plan.featured
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-white/60 bg-white/85 backdrop-blur-md hover:border-stone-300",
                current && !plan.featured && "border-emerald-600",
              )}
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span
                    className={cn(
                      "flex items-center gap-2 text-[11px] font-medium tracking-[0.18em] uppercase",
                      plan.featured ? "text-white/55" : "text-stone-500",
                    )}
                  >
                    {plan.name}
                    {current && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] tracking-normal",
                          plan.featured ? "bg-white/15 text-white/80" : "bg-emerald-100 text-emerald-800",
                        )}
                      >
                        Your plan
                      </span>
                    )}
                  </span>
                  <span className={cn("text-sm", plan.featured ? "text-white/70" : "text-stone-500")}>
                    {plan.description}
                  </span>
                </div>
                <plan.icon
                  className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-white/30" : "text-stone-300")}
                />
              </header>

              <p className="mt-7 flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-5xl font-medium tracking-tight",
                    plan.featured ? "text-white" : "text-stone-900",
                  )}
                >
                  {plan.price}
                </span>
                <span className={cn("text-sm", plan.featured ? "text-white/50" : "text-stone-400")}>
                  {plan.cadence}
                </span>
              </p>

              <hr className={cn("mt-7", plan.featured ? "border-white/15" : "border-stone-200")} />

              <ul className="mt-6 flex grow flex-col gap-3 text-sm">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <Check
                      className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-white/45" : "text-stone-400")}
                      strokeWidth={2.5}
                    />
                    <span className={plan.featured ? "text-white/85" : "text-stone-700"}>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild={plan.id === "free" || current}
                variant={plan.featured ? "secondary" : "outline"}
                disabled={busy || locked}
                onClick={plan.id === "free" || current ? undefined : () => void choose(plan.id as PaidPlan)}
                className={cn(
                  "mt-8 w-full rounded-full",
                  plan.featured
                    ? "bg-white text-stone-900 hover:bg-white/90"
                    : "border-stone-300 bg-transparent text-stone-800 hover:bg-stone-900 hover:text-white",
                )}
              >
                {plan.id === "free" ? (
                  <Link to="/create">{plan.cta}</Link>
                ) : current ? (
                  <Link to="/account">Manage plan</Link>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {busy && <Loader2 className="size-4 animate-spin" />}
                    {busy ? "Opening checkout…" : plan.cta}
                  </span>
                )}
              </Button>
            </Card>
          );
        })}
      </div>

      {error && (
        <p className="text-center text-sm text-red-100 drop-shadow-sm" role="alert">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-white/75 drop-shadow-sm">
        Monthly, cancel whenever. Anything you have sent to press stays yours.
      </p>
    </section>
  );
}
