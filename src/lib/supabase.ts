/**
 * The browser's Supabase client.
 *
 * Only the project URL and the anon key reach the browser. The anon key is
 * public by design — row-level security in `api/schema.sql` is what actually
 * protects the data, not the secrecy of this key.
 *
 * Both are read through `BUN_PUBLIC_*`, the prefix Bun is configured to inline
 * into the bundle (see `bunfig.toml`). A variable without that prefix stays on
 * the server, which is what keeps the service-role key out of here.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Guarded for the same reason as in `version.ts`: an unset BUN_PUBLIC_ variable
// is not inlined, so `process` would be read in the browser and throw. Without
// the guard a clone with no .env takes the whole page down instead of quietly
// reporting sign-in as switched off, which is the behaviour this file is built
// around.
// The full `process.env.BUN_PUBLIC_…` expression must appear verbatim — that
// exact text is what the bundler substitutes. Hoisting `process.env` into a
// variable first reads naturally and silently defeats the substitution, leaving
// a bundle with no Supabase configuration at all.
const url = typeof process !== "undefined" ? process.env.BUN_PUBLIC_SUPABASE_URL : undefined;
const anonKey = typeof process !== "undefined" ? process.env.BUN_PUBLIC_SUPABASE_ANON_KEY : undefined;

/**
 * Whether this build can sign anyone in.
 *
 * The site works without it — composing and exporting a magazine never needed
 * an account — so the UI hides sign-in rather than showing a button that
 * cannot work.
 */
export const authConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = authConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // The session lives in localStorage and is refreshed in the
        // background, so a reload does not sign anyone out.
        persistSession: true,
        autoRefreshToken: true,
        // Off on purpose. Left on, the library exchanges the `?code=` during
        // its own initialisation and reports a failure nowhere in particular —
        // the symptom is a code sitting in the address bar and an app that
        // still reads as signed out. `AuthProvider` does the exchange itself so
        // the error has somewhere to go.
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

/**
 * The current access token, or null when signed out.
 *
 * Read through `getSession` rather than kept in a variable so a token that
 * expired while the tab sat open is refreshed before it is used.
 */
export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
