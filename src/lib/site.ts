/**
 * Where links handed to other people point.
 *
 * On the website that is the page's own origin, so a link made on a preview
 * deploy or on `localhost` opens there too, where the issue it names exists.
 * The Android and iPhone apps load the site from the phone itself
 * (`https://localhost`, `capacitor://localhost`), an address nobody else can
 * open, so their builds set `BUN_PUBLIC_SITE_URL` to the public site
 * (`https://ouratlas.co.in`). A link made in the app then opens in any browser,
 * and in the app for whoever has it installed.
 *
 * Only for links that leave the device. Calls to our own API go through
 * `apiUrl` in `api.ts`, which has its own build value for the same reason.
 */

// Caught rather than guarded with `typeof process`, for the reason spelled out
// in `supabase.ts`: the bundler substitutes the value but not the guard.
function siteBase(): string | undefined {
  try {
    return process.env.BUN_PUBLIC_SITE_URL;
  } catch {
    return undefined;
  }
}

const SITE_BASE = siteBase() || undefined;

/** The full public address of a path on the site, for sharing. */
export function publicUrl(path: string): string {
  return new URL(path, SITE_BASE ?? location.origin).toString();
}
