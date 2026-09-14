/**
 * The browser's Supabase auth client.
 *
 * Only the project URL and the anon key reach the browser. The anon key is
 * public by design — row-level security in `api/schema.sql` is what actually
 * protects the data, not the secrecy of this key.
 *
 * Both are read through `BUN_PUBLIC_*`, the prefix Bun is configured to inline
 * into the bundle (see `bunfig.toml`). A variable without that prefix stays on
 * the server, which is what keeps the service-role key out of here.
 */

// `AuthClient` is exported as a value alias of the class, so the class itself
// is what can name the type.
import { AuthClient, type GoTrueClient } from "@supabase/auth-js";

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

/**
 * The auth client on its own, rather than `createClient` from supabase-js.
 *
 * The browser only ever signs people in; the database is reached through our
 * API. `createClient` builds the database, realtime, storage and functions
 * clients as well, and the bundler cannot leave out what a constructor
 * references, so every reader of the home page downloaded and parsed all four
 * for nothing. `createClient` hands its settings to this same class, and they
 * are repeated here as it sets them.
 *
 * Two of them must never drift. The storage key is where every signed-in
 * reader's session already sits in localStorage, and where a sign-in that is
 * mid-redirect keeps its PKCE verifier: a different key signs everybody out
 * and fails the next return from Google. And the anon key goes as both
 * `apikey` and the bearer token, which is what the auth server expects from a
 * client that has no session yet.
 */
function authClient(projectUrl: string, key: string): GoTrueClient {
  const base = new URL(projectUrl.endsWith("/") ? projectUrl : `${projectUrl}/`);
  return new AuthClient({
    url: new URL("auth/v1", base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    storageKey: `sb-${base.hostname.split(".")[0]}-auth-token`,
    // The session lives in localStorage and is refreshed in the background, so
    // a reload does not sign anyone out.
    persistSession: true,
    autoRefreshToken: true,
    // Off on purpose. Left on, the library exchanges the `?code=` during its
    // own initialisation and reports a failure nowhere in particular — the
    // symptom is a code sitting in the address bar and an app that still reads
    // as signed out. `AuthProvider` does the exchange itself so the error has
    // somewhere to go.
    detectSessionInUrl: false,
    flowType: "pkce",
  });
}

/**
 * Shaped like the old client (`supabase.auth.…`) so its callers did not change.
 *
 * Built only in a browser. `build.ts` renders the home page ahead of time, and
 * a client made there would start refresh timers that keep the build from
 * exiting, for a session that cannot exist. `authConfigured` still reads true
 * during that render, so the nav draws the same placeholder the browser draws.
 */
export const supabase: { auth: GoTrueClient } | null =
  authConfigured && typeof window !== "undefined" ? { auth: authClient(url!, anonKey!) } : null;

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
