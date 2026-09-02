import tailwind from "bun-plugin-tailwind";
import { versionOf } from "./scripts/versions";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  // Same prefix bunfig.toml gives the dev server, so a production bundle and a
  // hot-reloaded one see the same Supabase settings.
  env: "BUN_PUBLIC_*",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Baked in like the Supabase settings, and for the same reason: the
    // bundle has to carry it, there is no run time to read it at.
    "process.env.BUN_PUBLIC_APP_VERSION": JSON.stringify(process.env.BUN_PUBLIC_APP_VERSION ?? versionOf("ui")),
  },
});

// Everything in src/static is copied through verbatim and unhashed, because
// each of these files is addressed from outside the bundle: robots.txt and
// sitemap.xml by crawlers, favicon.ico by browsers, og.jpg by whatever cached
// it when somebody shared a link, and the font by a stylesheet that names it.
// Hashing any of them would move an address something else has written down.
for (const name of new Bun.Glob("*").scanSync({ cwd: "src/static" })) {
  await Bun.write(path.join(outdir, name), Bun.file(path.join("src/static", name)));
  console.log(` ${path.join("dist", name)}  ${(Bun.file(path.join("src/static", name)).size / 1024).toFixed(1)} KB`);
}

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}
