/**
 * Runs both halves of the app for development.
 *
 * The frontend needs Bun's bundler for hot reload; the API is Express. Rather
 * than ask anyone to keep two terminals open, this starts both, gives them
 * fixed ports so the proxy in `src/index.ts` knows where to find the API, and
 * keeps them running.
 *
 * `--hot` covers code edits in both. Two things it cannot cover are handled
 * here, because each otherwise meant stopping and re-running `bun dev`:
 *
 * - `.env` is read once, when a process starts. So an edit to it restarts
 *   both halves — the web half too, since BUN_PUBLIC_* values are inlined into
 *   the bundle as it is built. For the restart to see the new values this
 *   script must not hand its own copy of them down, which is why `bun dev`
 *   runs it with `--no-env-file` and lets each child read `.env` for itself.
 * - A half that crashes after it was up is started again rather than taking
 *   the other down with it. One that dies straight after starting is broken,
 *   not unlucky — a port already taken, an error at boot — and respawning it
 *   would only loop, so that still stops everything.
 */

import { watch } from "node:fs";

import { versionOf } from "./scripts/versions";

const WEB_PORT = process.env.WEB_PORT ?? "3000";
const API_PORT = process.env.PORT ?? "3001";

/** A half that dies sooner than this after starting failed to boot. */
const BOOT_MS = 5_000;

/** Editors save in bursts (write, rename, touch); one restart per burst. */
const SETTLE_MS = 300;

const env = {
  ...process.env,
  WEB_PORT,
  PORT: API_PORT,
  API_ORIGIN: `http://localhost:${API_PORT}`,
  // Bun's dev server inlines BUN_PUBLIC_* variables that exist in the
  // environment, and this one lives in versions.json rather than .env. Set
  // here so a development build reports the same version a released one
  // would, instead of falling back to "dev".
  BUN_PUBLIC_APP_VERSION: versionOf("ui"),
};

type Half = { name: string; entry: string; child: Bun.Subprocess; startedAt: number; restarting: boolean };

let stopping = false;

/** One dead half makes the other useless, so the pair goes down together. */
function stop(code = 0): never {
  if (!stopping) {
    stopping = true;
    for (const half of halves) half.child.kill();
  }
  process.exit(code);
}

function spawn(half: Half): void {
  half.startedAt = Date.now();
  half.restarting = false;

  const child = Bun.spawn(["bun", "--hot", half.entry], { stdio: ["inherit", "inherit", "inherit"], env });
  half.child = child;

  void child.exited.then(code => {
    // A newer process has already taken this one's place, or we are the ones
    // shutting down; neither is news.
    if (stopping || half.child !== child) return;

    if (half.restarting) {
      spawn(half);
      return;
    }

    if (Date.now() - half.startedAt < BOOT_MS) {
      console.error(`\n[dev] ${half.name} exited during startup (code ${code}); stopping.\n`);
      stop(1);
    }

    console.error(`\n[dev] ${half.name} exited (code ${code}); starting it again.\n`);
    spawn(half);
  });
}

function restart(half: Half): void {
  half.restarting = true;
  half.child.kill();
}

const halves: Half[] = [
  { name: "api", entry: "api/index.ts" },
  { name: "web", entry: "src/index.ts" },
].map(({ name, entry }) => ({ name, entry, child: null as unknown as Bun.Subprocess, startedAt: 0, restarting: false }));

halves.forEach(spawn);

// The directory rather than the file: editors that save by writing a new file
// and renaming it over the old one would leave a watch on the file pointing at
// the replaced inode, and a `.env` created after startup would never be seen.
let settle: Timer | undefined;
watch(".", (_event, filename) => {
  if (filename !== ".env" && filename !== ".env.local") return;

  clearTimeout(settle);
  settle = setTimeout(() => {
    console.log(`\n[dev] ${filename} changed; restarting api and web.\n`);
    halves.forEach(restart);
  }, SETTLE_MS);
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

// Held open by the children and the watcher; this only keeps top-level await
// semantics obvious to a reader looking for where the script ends.
await new Promise(() => {});
