import tailwind from "bun-plugin-tailwind";
import { versionOf } from "./scripts/versions";
import { NOT_FOUND, ROUTES, SITE, type Head } from "./src/lib/seo";
import { rm } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

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
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Baked in like the Supabase settings, and for the same reason: the
    // bundle has to carry it, there is no run time to read it at.
    "process.env.BUN_PUBLIC_APP_VERSION": JSON.stringify(process.env.BUN_PUBLIC_APP_VERSION ?? versionOf("ui")),
  },
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
const shell = built.replace(entryTag[0], () => `${modulePreloads}${entryTag[0]}`);
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

// No `<link rel="preload">` for the home page's largest photograph, although
// it looks like the obvious fix. It was measured: the plate is painted only
// once the bundle has run, so fetching it earlier buys nothing, and in all
// three comparisons made (simulated and real throttling, with and without
// splitting) it moved the largest paint 100–150 ms later by competing with the
// scripts for the connection.

for (const [route, head] of Object.entries(ROUTES)) {
  const file = route === "/" ? "index.html" : `${route.slice(1)}.html`;
  let html = page(head, new URL(route, SITE).toString(), route === "/");
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
