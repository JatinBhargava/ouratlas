/**
 * The version this bundle was built from.
 *
 * Inlined at build time from `versions.json` (see `build.ts`), the same way the
 * Supabase settings are — a bundle has no run time at which to read a file.
 * `dev` is what an unversioned local build honestly reports.
 *
 * Its counterpart is `/api/health`, which reports the API's own version. The
 * two are versioned separately on purpose, so a frontend deploy does not have
 * to claim the backend changed.
 */
// Caught rather than guarded with `typeof process`, for the reason spelled out
// in `supabase.ts`: the bundler substitutes the value but not the guard, so a
// runtime check would discard the very thing it was meant to protect.
function buildVersion(): string | undefined {
  try {
    return process.env.BUN_PUBLIC_APP_VERSION;
  } catch {
    return undefined;
  }
}

export const APP_VERSION = buildVersion() || "dev";
