import tailwind from "bun-plugin-tailwind";
import { versionOf } from "./scripts/versions";
import { NOT_FOUND, ROUTES, SITE, type Head } from "./src/lib/seo";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

/**
 * Build-time values, shared by the browser bundle and the prerender bundle
 * below. The two must agree: a switch that read differently in each would draw
 * different markup, and hydration would fail on it.
 */
const define = {
  "process.env.NODE_ENV": JSON.stringify("production"),
  // Baked in like the Supabase settings, and for the same reason: the
  // bundle has to carry it, there is no run time to read it at.
  "process.env.BUN_PUBLIC_APP_VERSION": JSON.stringify(process.env.BUN_PUBLIC_APP_VERSION ?? versionOf("ui")),
};

const result = await Bun.build({
  entrypoints,
  outdir,
  // Absolute asset addresses rather than `./chunk.js`. The shell is served at
  // more than one depth — /pricing today, /guides/<slug> later — and a
  // relative address resolves against the page's own folder, so from
  // /guides/goa it would ask for /guides/chunk.js and be handed HTML.
  publicPath: "/",
  // Required for `lazy(() => import(...))` in App.tsx to become a separate
  // file. Without it Bun inlines every dynamic import into the one bundle, and
  // the desk's magazine engine ships to every reader of the cover.
  splitting: true,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  sourcemap: "linked",
  // Same prefix bunfig.toml gives the dev server, so a production bundle and a
  // hot-reloaded one see the same Supabase settings.
  env: "BUN_PUBLIC_*",
  define,
});

// Everything in src/static is copied through verbatim and unhashed, because
// each of these files is addressed from outside the bundle: robots.txt by
// crawlers, favicon.ico by browsers, og.jpg by whatever cached it when
// somebody shared a link, and the font by a stylesheet that names it. Hashing
// any of them would move an address something else has written down.
for (const name of new Bun.Glob("*").scanSync({ cwd: "src/static" })) {
  await Bun.write(path.join(outdir, name), Bun.file(path.join("src/static", name)));
  console.log(` ${path.join("dist", name)}  ${(Bun.file(path.join("src/static", name)).size / 1024).toFixed(1)} KB`);
}

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}

// One HTML file per route, each carrying its own head.
//
// The app renders every route in the browser, but crawlers that run no
// JavaScript and every link unfurler read only the HTML they are sent. With
// one shell for every address, /pricing was titled, described and
// canonicalised as the home page. The heads come from `src/lib/seo.ts`, which
// the app also reads as it navigates, so the two cannot disagree.
//
// Vercel serves these through `cleanUrls` (/pricing → pricing.html) and, with
// the catch-all rewrite gone, answers any other address with 404.html and a
// real 404 status. A 200 shell for a mistyped address is a soft 404 to Google.
//
// Each replacement must match exactly once in the built shell. A head tag
// renamed or duplicated in index.html fails the build here, rather than
// quietly shipping every page with the home page's title again.

const built = await Bun.file(path.join(outdir, "index.html")).text();

// Module preloads for every chunk the entry script imports statically.
//
// With `splitting` on, the entry no longer carries everything: it imports
// shared chunks (React, the auth client) that the browser discovers only after
// it has downloaded and parsed the entry itself. On a slow phone that is one
// file after another, and in testing it pushed the largest paint later than
// the single bundle did. Named in the HTML, they all download at once.
//
// Found with Bun's own import scanner rather than a pattern over minified
// code, and static imports only: the desk's chunk, reached by a dynamic
// import, must stay unfetched until somebody opens the desk.
const scanner = new Bun.Transpiler({ loader: "js" });

async function staticChunks(file: string, seen = new Set<string>()): Promise<Set<string>> {
  const source = await Bun.file(path.join(outdir, file)).text();
  for (const { path: specifier, kind } of scanner.scanImports(source)) {
    if (kind !== "import-statement") continue;
    const name = path.basename(specifier);
    if (seen.has(name)) continue;
    seen.add(name);
    await staticChunks(name, seen);
  }
  return seen;
}

const entryTag = built.match(/<script type="module"[^>]*src="\/([^"]+\.js)"[^>]*><\/script>/);
const entryFile = entryTag?.[1];
if (!entryTag || !entryFile) throw new Error("build.ts: no module script found in dist/index.html");
const firstLoad = await staticChunks(entryFile);
const modulePreloads = [...firstLoad].map(name => `<link rel="modulepreload" crossorigin href="/${name}" />`).join("");
// The headline face, preloaded on every page, just ahead of the @font-face
// rule in index.html that names it.
//
// A rule alone fetches nothing: the browser asks for the file only once it has
// laid out text that needs it. With the home page arriving as finished HTML, a
// throttled Lighthouse run measured that request starting at 1.7 s, queued
// behind the scripts, and finishing at 4.5 s. The headline is the largest paint
// on a phone, and it was counted when the face swapped in. `crossorigin` is
// required even on our own origin, or the preloaded copy is not the one the
// rule uses and the file is fetched twice.
//
// Written here rather than in index.html, where the HTML bundler would try to
// resolve the address as a source file and fail the build.
const fontPreload = `<link rel="preload" href="/instrument-serif.ttf" as="font" type="font/ttf" crossorigin />\n    `;
const shell = replaceOnce(built, /<style>(?=\s*@font-face)/, `${fontPreload}<style>`).replace(
  entryTag[0],
  () => `${modulePreloads}${entryTag[0]}`,
);
console.log(` dist/*.html  modulepreload ${[...firstLoad].join(", ") || "none"}`);

// The desk and the account page are lazy chunks (App.tsx), so on their own
// addresses the browser would learn of them only after the entry had run and
// asked — one more round trip, measured as a later paint on /create, which is
// also where the return from Google lands. Their own HTML names them up front;
// no other page does. The chunk is found by the page's source file in its
// source map, which is exact, rather than by guessing at minified contents.
const LAZY_PAGES: Record<string, string> = {
  "/create": "src/pages/Create.tsx",
  "/account": "src/pages/Account.tsx",
  "/magazines": "src/pages/Magazines.tsx",
  "/read": "src/pages/Read.tsx",
};

async function lazyPreloads(source: string): Promise<string> {
  for (const output of result.outputs) {
    const name = path.basename(output.path);
    if (!/^chunk-[a-z0-9]+\.js$/.test(name)) continue;
    const map = Bun.file(path.join(outdir, `${name}.map`));
    if (!(await map.exists())) continue;
    const { sources } = (await map.json()) as { sources: string[] };
    if (!sources.some(file => file.endsWith(source))) continue;
    const chunks = [name, ...(await staticChunks(name))].filter(chunk => !firstLoad.has(chunk) && chunk !== entryFile);
    return chunks.map(chunk => `<link rel="modulepreload" crossorigin href="/${chunk}" />`).join("");
  }
  console.warn(` build.ts: no chunk found for ${source}, so its page gets no module preload`);
  return "";
}

/** Escapes text for a double-quoted attribute (and, harmlessly, for <title>). */
const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** A `<meta>` by name or property, however the source happens to wrap it. */
const meta = (key: "name" | "property", value: string) => new RegExp(`<meta\\s+${key}="${value}"\\s+content="[^"]*"\\s*/>`);

function replaceOnce(html: string, pattern: RegExp, replacement: string): string {
  const count = html.match(new RegExp(pattern.source, "g"))?.length ?? 0;
  if (count !== 1) throw new Error(`build.ts: expected one match for ${pattern} in dist/index.html, found ${count}`);
  return html.replace(pattern, () => replacement);
}

function page(head: Head, url: string | null, structuredData: boolean): string {
  if ([...head.title].length > 60) throw new Error(`build.ts: title over 60 characters: ${head.title}`);
  if ([...head.description].length > 155) throw new Error(`build.ts: description over 155 characters: ${head.description}`);

  const title = escape(head.title);
  const description = escape(head.description);

  let html = shell;
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = replaceOnce(html, meta("name", "description"), `<meta name="description" content="${description}" />`);
  html = replaceOnce(html, meta("property", "og:title"), `<meta property="og:title" content="${title}" />`);
  html = replaceOnce(html, meta("property", "og:description"), `<meta property="og:description" content="${description}" />`);
  html = replaceOnce(html, meta("name", "twitter:title"), `<meta name="twitter:title" content="${title}" />`);
  html = replaceOnce(html, meta("name", "twitter:description"), `<meta name="twitter:description" content="${description}" />`);

  // An address that is not a page has no URL of its own to claim.
  html = replaceOnce(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/, url ? `<link rel="canonical" href="${url}" />` : "");
  html = replaceOnce(html, meta("property", "og:url"), url ? `<meta property="og:url" content="${url}" />` : "");

  // Early in the head, so a crawler that stops reading at noindex stops soon.
  if (!head.index) {
    html = replaceOnce(html, /<meta\s+charset="UTF-8"\s*\/>/, `<meta charset="UTF-8" />\n    <meta name="robots" content="noindex" />`);
  }

  // The site and product graph describes what the home page shows. Repeated
  // on the terms of service it would be a claim about a page that makes none.
  if (!structuredData) {
    html = replaceOnce(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, "");
  }

  return html;
}

// The home page, drawn at build time and hydrated in the browser.
//
// Until the bundle had downloaded and run, a reader of the cover saw the
// scene and nothing else: on a mid-range phone that was about 2.7 s of the
// 3.9 s before the largest paint, and the photograph itself took 0.1 s of it.
// Writing the rendered page into index.html puts the masthead and the plate on
// screen as soon as the HTML and the stylesheet arrive, and `frontend.tsx`
// hydrates the markup instead of drawing it again.
//
// Only the home page. It is the page that arrives from search and shared links
// and the one measured as slow. The desk draws from state that exists only in
// the reader's browser, and the other pages are small enough that the wait
// was never theirs.
//
// Rendered from its own bundle of `src/prerender.tsx`, built with the same
// plugins, public path and `define` as the browser's. Importing the app
// straight into this script would give every photograph its source path rather
// than the hashed address in dist, and the markup would then disagree with the
// browser's render on every <img>.
//
// No `<link rel="preload">` for the home page's largest photograph. It was
// measured before this existed, when the plate painted only after the bundle
// ran, and cost 100–150 ms by competing with the scripts. The <img> is now in
// the HTML itself, with `fetchpriority="high"`, so the browser's preload
// scanner finds it just as early without one.
const prerenderDir = await mkdtemp(path.join(tmpdir(), "atlas-prerender-"));
const prerender = await Bun.build({
  entrypoints: ["src/prerender.tsx"],
  outdir: prerenderDir,
  publicPath: "/",
  plugins: [tailwind],
  target: "bun",
  env: "BUN_PUBLIC_*",
  define,
});
const prerenderEntry = prerender.outputs.find(output => output.kind === "entry-point");
if (!prerender.success || !prerenderEntry) throw new Error("build.ts: the prerender bundle did not build");
const { render } = (await import(prerenderEntry.path)) as { render: (location: string) => string };
const homeMarkup = render("/");
await rm(prerenderDir, { recursive: true, force: true });

// Every file the rendered page points at must be one this build wrote. The two
// bundles hash assets independently, and if they ever disagreed the page would
// ship with broken images that only the hydrated render repaired, after the
// wait this exists to remove.
for (const [, address] of homeMarkup.matchAll(/(?:src|srcSet|srcset|href)="(\/[^"#?]+\.[a-z0-9]+)"/g)) {
  if (!(await Bun.file(path.join(outdir, address!)).exists())) {
    throw new Error(`build.ts: the prerendered home page points at ${address}, which is not in dist`);
  }
}
console.log(` dist/index.html  prerendered ${(homeMarkup.length / 1024).toFixed(1)} KB of markup`);

for (const [route, head] of Object.entries(ROUTES)) {
  const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
  let html = page(head, new URL(route, SITE).toString(), route === "/");
  // Marked with the address it was drawn for, which `frontend.tsx` checks
  // before hydrating rather than trusting whichever path was served this file.
  if (route === "/") {
    html = replaceOnce(html, /<div id="root"><\/div>/, `<div id="root" data-prerendered="/">${homeMarkup}</div>`);
  }
  const lazySource = LAZY_PAGES[route];
  if (lazySource) {
    const preloads = await lazyPreloads(lazySource);
    if (preloads) html = replaceOnce(html, /<\/head>/, `  ${preloads}\n  </head>`);
  }
  await Bun.write(path.join(outdir, file), html);
  console.log(` ${path.join("dist", file)}  ${head.index ? "" : "noindex  "}${head.title}`);
}
await Bun.write(path.join(outdir, "404.html"), page(NOT_FOUND, null, false));
console.log(` dist/404.html  noindex  ${NOT_FOUND.title}`);

// The sitemap, from the same table, so it lists exactly the pages that exist
// and are indexable. It used to be written by hand and fell behind the routes.

/** "3 September 2026", as the legal pages print it, to the date a sitemap wants. */
function isoDay(text: string): string {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`build.ts: cannot read "${text}" as a date (LEGAL.updated)`);
  // Local parts, not toISOString: in IST midnight is the previous day in UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const urls: string[] = [];
for (const [route, head] of Object.entries(ROUTES)) {
  const { sitemap } = head;
  if (!head.index || !sitemap) continue;
  urls.push(
    [
      "  <url>",
      `    <loc>${new URL(route, SITE)}</loc>`,
      ...(sitemap.updated ? [`    <lastmod>${isoDay(sitemap.updated)}</lastmod>`] : []),
      `    <changefreq>${sitemap.changefreq}</changefreq>`,
      `    <priority>${sitemap.priority.toFixed(1)}</priority>`,
      "  </url>",
    ].join("\n"),
  );
}

await Bun.write(
  path.join(outdir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by build.ts from src/lib/seo.ts. Pages marked noindex are left out. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`,
);
console.log(` dist/sitemap.xml  ${urls.length} URLs`);
