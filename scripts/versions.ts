/**
 * The single source of truth for version numbers is `versions.json`.
 *
 * This is the one place that reads it, so nothing else has to know the file's
 * shape or location. Three ways to use it:
 *
 *   bun scripts/versions.ts              both, as JSON
 *   bun scripts/versions.ts api          just that one, bare — for shells and CI
 *   bun scripts/versions.ts exec <cmd>   run <cmd> with API_VERSION and
 *                                        WEB_VERSION set in its environment
 *
 * The last form is what lets docker compose use the versions without being
 * able to read JSON itself. It is spelled `exec` rather than `--` because Bun
 * consumes a bare `--` before the script ever sees it.
 */

import versions from "../versions.json";

export type Component = keyof typeof versions;

export function versionOf(component: Component): string {
  return versions[component];
}

/** Image tag form. `0.1.0` in the file, `v0.1.0` on the image. */
export function tagOf(component: Component): string {
  return `v${versionOf(component)}`;
}

export { versions };

if (import.meta.main) {
  const args = Bun.argv.slice(2);

  if (args[0] === "exec") {
    const command = args.slice(1);
    if (command.length === 0) {
      console.error("Nothing to run after `exec`");
      process.exit(2);
    }

    const child = Bun.spawn(command, {
      stdio: ["inherit", "inherit", "inherit"],
      env: { ...process.env, API_VERSION: versions.api, WEB_VERSION: versions.ui },
    });
    process.exit(await child.exited);
  }

  const [component] = args;
  if (!component) {
    console.log(JSON.stringify(versions, null, 2));
  } else if (component in versions) {
    console.log(versions[component as Component]);
  } else {
    console.error(`Unknown component "${component}". Known: ${Object.keys(versions).join(", ")}`);
    process.exit(2);
  }
}
