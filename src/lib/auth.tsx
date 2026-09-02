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

    // Supabase redirects failures back as query parameters rather than
    // throwing, so an unreadable one would otherwise vanish silently.
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error_description") ?? params.get("error");
    if (oauthError) {
      console.error("[auth] provider returned an error:", oauthError);
      setSignInError(oauthError);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      // With detectSessionInUrl on, the `?code=` exchange happens inside this
      // call. A failure here is the case that looks like nothing happening:
      // the code sits in the address bar and the app still reads as signed
      // out. The usual cause is a missing PKCE verifier — sign-in begun in a
      // different browser, profile, or origin than the one it returned to.
      if (error) {
        console.error("[auth] could not establish a session:", error.message);
        setSignInError(error.message);
      } else if (params.has("code") && !data.session) {
        const message = "Sign-in did not complete. Start it again in this browser.";
        console.error(`[auth] ${message} (code present but no session was created)`);
        setSignInError(message);
      }

      setSession(data.session);
      setReady(true);
    });

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
      options: { redirectTo: new URL(returnTo, window.location.origin).toString() },
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
