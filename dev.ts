/**
 * Runs both halves of the app for development.
 *
 * The frontend needs Bun's bundler for hot reload; the API is Express. Rather
 * than ask anyone to keep two terminals open, this starts both, gives them
 * fixed ports so the proxy in `src/index.ts` knows where to find the API, and
 * makes sure neither outlives the other.
 */

import { versionOf } from "./scripts/versions";

const WEB_PORT = process.env.WEB_PORT ?? "3000";
const API_PORT = process.env.PORT ?? "3001";

const shared: Parameters<typeof Bun.spawn>[1] = {
  stdio: ["inherit", "inherit", "inherit"],
  env: {
    ...process.env,
    WEB_PORT,
    PORT: API_PORT,
    API_ORIGIN: `http://localhost:${API_PORT}`,
    // Bun's dev server inlines BUN_PUBLIC_* variables that exist in the
    // environment, and this one lives in versions.json rather than .env. Set
    // here so a development build reports the same version a released one
    // would, instead of falling back to "dev".
    BUN_PUBLIC_APP_VERSION: versionOf("ui"),
  },
};

const api = Bun.spawn(["bun", "--hot", "api/index.ts"], shared);
const web = Bun.spawn(["bun", "--hot", "src/index.ts"], shared);

const children = [api, web];
let stopping = false;

/** One dead half makes the other useless, so the pair goes down together. */
function stop(code = 0): never {
  if (!stopping) {
    stopping = true;
    for (const child of children) child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// If either process exits on its own — a syntax error at boot, a port already
// taken — stop the other rather than leave half a stack running.
await Promise.race(children.map(child => child.exited));
stop(1);
