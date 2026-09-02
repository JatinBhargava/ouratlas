/**
 * Session and entitlement, for the whole app.
 *
 * Two sources are in play and they are not equal. Supabase tells the browser
 * *who* is signed in, which is safe because the token is signed. What that
 * person is *entitled to* comes from `/api/me`, because a plan read out of the
 * browser's own storage is a plan the browser could edit.
 */

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { api } from "@/lib/api";
import { authConfigured, supabase } from "@/lib/supabase";
import type { Billing, MeResponse, SessionUser } from "@/types";

/** No subscription is not an error — it is the free plan. */
export const FREE: Billing = { plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };

type AuthValue = {
  /** False until the stored session has been read; guards a sign-in flash on load. */
  ready: boolean;
  /** Whether this build has Supabase keys at all. */
  configured: boolean;
  user: SessionUser | null;
  billing: Billing;
  /** True while `/api/me` is in flight. */
  loadingBilling: boolean;
  /**
   * Why the last sign-in attempt failed, or null.
   *
   * Returning from Google can fail after the redirect has already succeeded —
   * the code arrives but cannot be exchanged. Without this the app would sit
   * on `/?code=…` looking signed out with nothing said about why.
   */
  signInError: string | null;
  signInWithGoogle: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the plan — used after returning from Stripe. */
  refreshBilling: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Google returns name and picture under varying keys; take the first that answers. */
function toSessionUser(session: Session): SessionUser {
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => keys.map(key => meta[key]).find(value => typeof value === "string") as
    | string
    | undefined;

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: pick("full_name", "name") ?? null,
    avatarUrl: pick("avatar_url", "picture") ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!authConfigured);
  const [billing, setBilling] = useState<Billing>(FREE);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Lets a slow `/api/me` that resolves after sign-out be discarded rather
  // than write a stale plan over the signed-out state.
  const requestId = useRef(0);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    /** Takes `code`/`state` off the URL once they are spent, leaving a clean address. */
    const tidyUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    };

    const start = async () => {
      const params = new URLSearchParams(window.location.search);

      // Google and Supabase report refusals as query parameters rather than by
      // failing the redirect, so this is the only place they exist.
      const refused = params.get("error_description") ?? params.get("error");
      if (refused) {
        console.error("[auth] provider refused:", refused);
        setSignInError(refused);
        tidyUrl();
      }

      const code = params.get("code");
      if (code) {
        // Done here rather than by `detectSessionInUrl` so the error is a value
        // we can read. The common failure is a missing PKCE verifier: it is
        // written to this browser's storage when sign-in begins, so returning
        // to a different browser, profile or origin leaves nothing to pair the
        // code with.
        const { data, error } = await client.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("[auth] code exchange failed:", error.message);
          setSignInError(
            /flow.state|verifier/i.test(error.message)
              ? "Sign-in could not be completed in this browser. Clear site data and start again from this site."
              : error.message,
          );
        } else {
          setSession(data.session);
        }

        tidyUrl();
        setReady(true);
        return;
      }

      const { data, error } = await client.auth.getSession();
      if (error) {
        console.error("[auth] could not read the stored session:", error.message);
        setSignInError(error.message);
      }
      setSession(data.session);
      setReady(true);
    };

    void start();

    // Fires on sign-in, sign-out, token refresh, and on the redirect back
    // from Google once the code in the URL has been exchanged.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setSignInError(null);
      setSession(next);
      setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshBilling = useCallback(async () => {
    const id = ++requestId.current;

    if (!userId) {
      setBilling(FREE);
      setLoadingBilling(false);
      return;
    }

    setLoadingBilling(true);
    try {
      const me = await api.get<MeResponse>("/api/me");
      if (id === requestId.current) setBilling(me.billing);
    } catch {
      // The session is still good; only the plan is unknown. Treating that as
      // free is the safe way to be wrong — it withholds a paid feature rather
      // than granting one.
      if (id === requestId.current) setBilling(FREE);
    } finally {
      if (id === requestId.current) setLoadingBilling(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshBilling();
  }, [refreshBilling]);

  const signInWithGoogle = useCallback(async (returnTo = "/account") => {
    if (!supabase) throw new Error("Sign-in is switched off: this build has no Supabase keys.");

    setSignInError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(returnTo, window.location.origin).toString(),
        // Google signs someone straight in when it recognises exactly one
        // active session, which is wrong for a keepsake tied to a particular
        // account — plenty of people have a personal address and a work one,
        // and the trip belongs to one of them. `select_account` always asks.
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setBilling(FREE);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      ready,
      configured: authConfigured,
      user: session ? toSessionUser(session) : null,
      billing,
      loadingBilling,
      signInError,
      signInWithGoogle,
      signOut,
      refreshBilling,
    }),
    [ready, session, billing, loadingBilling, signInError, signInWithGoogle, signOut, refreshBilling],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
