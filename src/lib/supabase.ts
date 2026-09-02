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
/**
 * Reads a build-time value without assuming `process` exists.
 *
 * Two constraints pull against each other here. The full
 * `process.env.BUN_PUBLIC_…` expression must survive verbatim into the source,
 * because that exact text is what the bundler swaps for a literal — hoisting
 * `process.env` into a variable defeats it. But a variable that was never set
 * is left un-substituted and then reads `process` in a browser, which throws.
 *
 * A `typeof process` guard looks like the answer and is not: the bundler
 * replaces the value but not the guard, so the check still runs in the browser,
 * finds no `process`, and throws the inlined value away. Catching the
 * ReferenceError instead leaves the substitution untouched.
 */
function publicEnv(read: () => string | undefined): string | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

const url = publicEnv(() => process.env.BUN_PUBLIC_SUPABASE_URL);
const anonKey = publicEnv(() => process.env.BUN_PUBLIC_SUPABASE_ANON_KEY);

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
