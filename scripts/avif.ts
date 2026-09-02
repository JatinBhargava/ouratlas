/**
 * Re-encodes the sample photographs as AVIF, beside the JPEGs they came from.
 *
 * The site serves both: AVIF to browsers that understand it, JPEG to the rest.
 * At quality 60 the set drops from about 845 KB to 390 KB with no visible
 * difference at the size these are drawn, which is more than half the weight of
 * the landing page.
 *
 * macOS only, like the share card: `sips` is doing the work.
 *
 * Usage: bun scripts/avif.ts
 */

import path from "node:path";

const QUALITY = 60;
const DIR = path.join(import.meta.dir, "../src/assets/slideshow");

let before = 0;
let after = 0;

for (const name of new Bun.Glob("*.jpg").scanSync({ cwd: DIR })) {
  const from = path.join(DIR, name);
  const to = from.replace(/\.jpg$/, ".avif");

  const done = Bun.spawnSync(["sips", "-s", "format", "avif", "-s", "formatOptions", String(QUALITY), from, "--out", to]);
  if (done.exitCode !== 0) throw new Error(new TextDecoder().decode(done.stderr));

  const was = Bun.file(from).size;
  const is = Bun.file(to).size;
  before += was;
  after += is;
  console.log(`  ${name.padEnd(44)} ${(was / 1024).toFixed(0).padStart(4)} KB -> ${(is / 1024).toFixed(0).padStart(4)} KB`);
}

console.log(`\n  ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB  (${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
