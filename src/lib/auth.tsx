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

  // Lets a slow `/api/me` that resolves after sign-out be discarded rather
  // than write a stale plan over the signed-out state.
  const requestId = useRef(0);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    // Fires on sign-in, sign-out, token refresh, and on the redirect back
    // from Google once the code in the URL has been exchanged.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
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
      signInWithGoogle,
      signOut,
      refreshBilling,
    }),
    [ready, session, billing, loadingBilling, signInWithGoogle, signOut, refreshBilling],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
