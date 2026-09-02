import { ArrowRight, CreditCard, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";
import { openBillingPortal, PLAN_LABELS } from "@/lib/billing";

const date = new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" });

/**
 * How long to keep asking the server for a plan after checkout.
 *
 * Stripe redirects the browser back the moment payment clears, which is often
 * before its webhook has reached us. Rather than show "free" to someone who
 * has just paid, the page re-asks on a widening interval and gives up after
 * roughly half a minute — by which point something has genuinely gone wrong.
 */
const POLL_DELAYS_MS = [800, 1_200, 2_000, 3_000, 5_000, 8_000, 10_000];

export function Account() {
  const { ready, configured, user, billing, loadingBilling, signInError, signInWithGoogle, signOut, refreshBilling } =
    useAuth();
  const [params, setParams] = useSearchParams();
  const [portalError, setPortalError] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const justPaid = params.get("checkout") === "success";
  const [settling, setSettling] = useState(justPaid);

  // Guards against a second run in React's strict-mode double effect, which
  // would otherwise start two polling chains.
  const polling = useRef(false);

  useEffect(() => {
    if (!justPaid || !user || polling.current) return;
    polling.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // The provider owns the plan, so this asks it to re-read rather than
    // holding a second copy of the answer here.
    const attempt = (step: number) => {
      void refreshBilling().finally(() => {
        if (cancelled) return;
        const delay = POLL_DELAYS_MS[step];
        if (delay === undefined) {
          setSettling(false);
          return;
        }
        timer = setTimeout(() => attempt(step + 1), delay);
      });
    };

    attempt(0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [justPaid, user, refreshBilling]);

  // Once the plan lands, stop waiting and drop the marker from the URL so a
  // reload or a shared link is not still celebrating.
  useEffect(() => {
    if (settling && billing.plan !== "free") {
      setSettling(false);
      params.delete("checkout");
      setParams(params, { replace: true });
    }
  }, [settling, billing.plan, params, setParams]);

  if (!configured) {
    return (
      <Card className="rounded-2xl border-white/60 bg-white/85 p-8 backdrop-blur-md">
        <h1 className="font-editorial text-2xl text-stone-900">Accounts are switched off</h1>
        <p className="mt-2 text-sm text-stone-600">
          This build has no Supabase keys, so there is nobody to sign in as. Everything else — composing an issue and
          sending it to press — works without one.
        </p>
        <Button asChild variant="outline" className="mt-6 w-fit rounded-full">
          <Link to="/create">
            Start a story <ArrowRight className="size-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  if (!ready) {
    return (
      <p className="flex items-center gap-2 text-sm text-white/80">
        <Loader2 className="size-4 animate-spin" /> Looking you up…
      </p>
    );
  }

  if (!user) {
    return (
      <Card className="flex flex-col items-start gap-4 rounded-2xl border-white/60 bg-white/85 p-8 backdrop-blur-md">
        <h1 className="font-editorial text-2xl text-stone-900">Sign in</h1>
        <p className="text-sm text-stone-600">
          An account is only for billing and the newsletter. Your photographs and your writing never reach our servers
          either way.
        </p>
        <Button className="rounded-full" onClick={() => void signInWithGoogle("/account")}>
          Continue with Google
        </Button>

        {/* A failed return from Google leaves the code in the address bar and
            no session. Saying so beats an unexplained signed-out page. */}
        {signInError && (
          <p className="text-sm text-red-600" role="alert">
            {signInError}
          </p>
        )}
      </Card>
    );
  }

  const plan = PLAN_LABELS[billing.plan];
  const renews = billing.currentPeriodEnd ? date.format(new Date(billing.currentPeriodEnd)) : null;

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading kicker="Your account" title={user.name ?? user.email ?? "Reader"} />

      <Card className="flex flex-col gap-0 rounded-2xl border-white/60 bg-white/85 p-7 backdrop-blur-md">
        <header className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-12 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-stone-900">{user.name ?? "Reader"}</span>
            <span className="truncate text-sm text-stone-500">{user.email}</span>
          </div>
        </header>

        <Separator className="my-6 bg-stone-200" />

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium tracking-[0.18em] text-stone-500 uppercase">Plan</span>
            <span className="font-editorial text-3xl text-stone-900">{plan}</span>
          </div>

          {(settling || loadingBilling) && (
            <span className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="size-4 animate-spin" />
              {settling ? "Confirming your payment…" : "Checking…"}
            </span>
          )}
        </div>

        {billing.plan === "free" ? (
          <p className="mt-4 text-sm text-stone-600">
            {settling
              ? "Stripe has taken the payment; we are waiting for it to reach us. This page will update itself."
              : "One story at a time, up to 5,000 words, exported from the browser."}
          </p>
        ) : (
          <p className="mt-4 text-sm text-stone-600">
            {billing.cancelAtPeriodEnd
              ? `Ends ${renews ?? "at the end of this period"}. You keep everything already sent to press.`
              : renews
                ? `Renews ${renews}.`
                : "Active."}
            {billing.status === "past_due" && " Your last payment did not go through — update your card to keep it."}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-2">
          {billing.plan === "free" ? (
            <Button asChild className="rounded-full">
              <Link to="/#pricing">
                See the plans <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button
              className="rounded-full"
              disabled={openingPortal}
              onClick={() => {
                setOpeningPortal(true);
                setPortalError(null);
                openBillingPortal().catch(error => {
                  setPortalError(error instanceof Error ? error.message : "Could not open the billing portal.");
                  setOpeningPortal(false);
                });
              }}
            >
              {openingPortal ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Manage billing
            </Button>
          )}

          <Button variant="ghost" className="rounded-full text-stone-600" onClick={() => void signOut()}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>

        {portalError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {portalError}
          </p>
        )}
      </Card>

      <p className="flex items-start gap-2 text-sm text-white/75 drop-shadow-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        We store your email, your plan and nothing else. Photographs and story text stay in your browser.
      </p>
    </div>
  );
}
