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

const url = process.env.BUN_PUBLIC_SUPABASE_URL;
const anonKey = process.env.BUN_PUBLIC_SUPABASE_ANON_KEY;

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
        // Google sends people back with the authorisation code in the URL;
        // this is what exchanges it for a session and tidies the address bar.
        detectSessionInUrl: true,
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
