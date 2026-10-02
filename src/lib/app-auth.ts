/**
 * Google sign-in inside the Android and iPhone apps.
 *
 * The website's sign-in is a full-page redirect that comes back to the site's
 * own address. That cannot work in the app: its address is the phone
 * (`https://localhost`), which Google cannot send anyone back to, and Google
 * refuses to sign anyone in inside an app's embedded web view at all. So the
 * app opens Google in the system's browser sheet (a Custom Tab on Android),
 * and Supabase sends the reader back to `in.co.ouratlas://auth`, a link
 * Android hands to this app instead of the browser (see AndroidManifest.xml).
 *
 * The return then becomes exactly the website's: the app reloads itself at the
 * page sign-in began from, with `?code=` added. `AuthProvider` exchanges the
 * code against the PKCE verifier Supabase wrote to this same storage when
 * sign-in began, and a parked desk comes back through `draft.ts`, with no
 * second path through either to keep in step.
 *
 * Imported only inside the app, by `auth.tsx`, so the website never downloads
 * the plugins.
 */

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

/**
 * Where Supabase sends the reader back to. It must be listed under Auth → URL
 * Configuration → Redirect URLs in the Supabase dashboard (as
 * `in.co.ouratlas://auth**`); an address missing from that list is replaced
 * with the Site URL, and the reader lands on the website in Chrome instead.
 */
const RETURN = "in.co.ouratlas://auth";

/** The URL Supabase will send the reader back to, carrying the page to reopen. */
export function returnAddress(returnTo: string): string {
  const url = new URL(RETURN);
  url.searchParams.set("to", returnTo);
  return url.toString();
}

/** Opens Google's consent page in the browser sheet, over the app. */
export async function openSignIn(url: string): Promise<void> {
  await Browser.open({ url, presentationStyle: "popover" });
}

/**
 * Only a path on this app. `to` comes back from outside, so a value like
 * `https://elsewhere` or `//elsewhere` would otherwise send the web view to
 * another site carrying the code.
 */
function safePath(to: string | null): string {
  return to && to.startsWith("/") && !to.startsWith("//") ? to : "/account";
}

/** Resolve a return path without allowing URL parsing to leave the app origin. */
export function resolveReturn(to: string | null, origin: string): URL {
  const fallback = new URL("/account", origin);
  try {
    const target = new URL(safePath(to), origin);
    return target.origin === fallback.origin ? target : fallback;
  } catch {
    return fallback;
  }
}

/** Reloads the app at the page sign-in began from, with the provider's answer. */
function resume(link: string): void {
  let incoming: URL;
  try {
    incoming = new URL(link);
  } catch {
    return;
  }
  if (`${incoming.protocol}//${incoming.host}` !== RETURN) return;

  const target = resolveReturn(incoming.searchParams.get("to"), window.location.origin);
  // The same four the website's return reads: a code to exchange, or the
  // refusal Google or Supabase reported instead.
  for (const key of ["code", "error", "error_description"]) {
    const value = incoming.searchParams.get(key);
    if (value) target.searchParams.set(key, value);
  }

  // The sheet closes itself on Android when the link brings the app forward;
  // on iPhone it has to be told.
  void Browser.close().catch(() => {});
  window.location.replace(target.toString());
}

/**
 * Listens for the link back from sign-in. Two routes, because Android may
 * have closed the app while the reader was choosing an account: a running
 * app hears `appUrlOpen`, and one started by the link finds it as the launch
 * URL.
 */
export async function listenForSignInReturn(): Promise<void> {
  await App.addListener("appUrlOpen", ({ url }) => resume(url));

  // Android reports the same launch URL for as long as the app stays open, so
  // the reload `resume` causes (and any later one) would find it again and
  // replay a code that has already been spent. The link is written down as
  // handled first; sessionStorage outlives a reload but not the app.
  const launch = await App.getLaunchUrl();
  if (launch?.url && !handled(launch.url)) resume(launch.url);
}

const HANDLED_KEY = "atlas-app-auth-launch";

function handled(link: string): boolean {
  try {
    if (sessionStorage.getItem(HANDLED_KEY) === link) return true;
    sessionStorage.setItem(HANDLED_KEY, link);
    return false;
  } catch {
    // Without storage there is no telling a replay from a new link. The code
    // in the address means this page is already the result of one.
    return new URLSearchParams(window.location.search).has("code");
  }
}
