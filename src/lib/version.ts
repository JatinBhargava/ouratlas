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
// The literal `process.env.BUN_PUBLIC_…` has to survive into the source for the
// bundler to substitute it, but Bun only inlines variables that actually exist
// in the environment. One that does not is left as-is and reaches the browser,
// where `process` is undefined and reading it throws. The typeof guard is what
// makes a missing value fall back instead of breaking the page.
export const APP_VERSION =
  (typeof process !== "undefined" ? process.env.BUN_PUBLIC_APP_VERSION : undefined) || "dev";
