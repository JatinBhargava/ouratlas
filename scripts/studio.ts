/**
 * Brings the layout canvas into the app as the pages of Atlas Studio (/studio).
 *
 * The layouts are drawn on a design canvas outside this repo: one self-contained
 * HTML page per artboard at 780×1040 (the magazine page at 1.5×), grouped into
 * rows under a heading each. This reads a downloaded copy of that canvas —
 * `canvas.json` and the `*.dc.html` files beside it, plus the photographs saved
 * as `<asset id>.jpg` — and writes `src/lib/studio/pages.json` and the photos in
 * `src/assets/studio/`.
 *
 * The pages are carried as markup and drawn in script-less iframes rather than
 * rebuilt as React, because there are two hundred of them and they change on the
 * canvas, not here. What changes on the way in:
 *
 * - Each `{{hole}}` is filled with its default from the artboard's `data-props`,
 *   since there is no editor here to change it.
 * - The Google Fonts link goes. The only face it loads is Instrument Serif, which
 *   the site already serves itself; the page document names that file instead.
 * - Each `/_blob/<id>` becomes `%photo:<name>%`, swapped for the bundled
 *   photograph's hashed address when the page is drawn.
 *
 * Anything the app would not know how to show — a new hole, an unknown
 * photograph, a font other than Instrument Serif, a script, a new row — stops the
 * import rather than shipping a page that draws wrong.
 *
 * macOS only for the photographs (`sips`), like `scripts/avif.ts`.
 *
 * Usage: bun scripts/studio.ts <folder with canvas.json>
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Usage: bun scripts/studio.ts <folder with canvas.json>");

const OUT = path.join(import.meta.dir, "../src/lib/studio/pages.json");
const PHOTO_DIR = path.join(import.meta.dir, "../src/assets/studio");

/** The canvas's asset ids, named for what each photograph shows. `src/lib/studio.ts` imports them by these names. */
const PHOTOS: Record<string, string> = {
  "3c3d29d6a7008850c84273aa28c112af": "terraces",
  "3de9f6472654dec1dd99604b255ba99a": "lane",
  "527977002d94e349b4d116e680367c5c": "cafe-street",
  "642d9e26fd28b180be2531286fe47cf0": "farmhouse",
  "75fe25d556471906d480df8a31cb7e6f": "daisies",
  "7b63de172cd5856b7bd1e2b6ff543415": "beach-palms",
  "82fdaac170bafb9a95fea507ca1285cd": "city-from-hill",
  "840de12239dbc9f8a4c84ea52bf6b52f": "geese",
  "9bab548e4007837604d3a67f7a1990ea": "gull",
  a1aaea156fbbaba60c07edbab4716b26: "tree-bench",
  caee6a5de180496cb05762923a9bec68: "brick-facades",
  cf9922717fe5e62eb9b7cfce2745bced: "boat-umbrella",
  d3952c29097b6ef92d0ca8c769335dbe: "palms-pink",
  ed894cc05ff5c6c1aa48d079709e9e7f: "rooftops",
};

/**
 * Which shelf of the studio each canvas row sits on. A row not listed stops the
 * import: where a new family belongs is an editorial decision, not a default.
 */
function groupOf(row: string): string {
  if (["heading", "min", "cin", "gz", "cool", "ani", "elo", "bea", "uni", "cls"].includes(row)) return "one-page";
  if (["mag-front", "mag-atlas", "mag-mod", "mag-zine", "mag-ed1", "mag-ed2"].includes(row)) return "magazine";
  if (row.startsWith("mag-idea")) return "ideas";
  if (row === "mag-issue" || row.startsWith("th-")) return "issues";
  throw new Error(`studio: the canvas row "${row}" has no shelf; add it to groupOf()`);
}

type Board = { x: number; y: number; w: number; h: number; title?: string };
type Note = { x: number; y: number; text: string; kind?: string };
type Canvas = { boards: Record<string, Board>; notes?: Record<string, Note> };

const canvas = (await Bun.file(path.join(source, "canvas.json")).json()) as Canvas;

// Rows are headed by a title note placed above them; a board belongs to the
// nearest heading above it.
const rows = Object.entries(canvas.notes ?? {})
  .filter(([, note]) => note.kind === "title1")
  .map(([id, note]) => ({ id: id.replace(/^row-/, ""), y: note.y, text: note.text }))
  .sort((a, b) => a.y - b.y);

type Page = { id: string; title: string; width: number; height: number; css: string; html: string };
type Section = { id: string; group: string; name: string; blurb: string; pages: Page[] };

const sections = new Map<string, Section>();
for (const row of rows) {
  const [name = row.text, ...rest] = row.text.split(" — ");
  const blurb = rest.join(" — ");
  sections.set(row.id, { id: row.id, group: groupOf(row.id), name, blurb: blurb.charAt(0).toUpperCase() + blurb.slice(1), pages: [] });
}

const boards = Object.entries(canvas.boards).sort(([, a], [, b]) => a.y - b.y || a.x - b.x);
const usedPhotos = new Set<string>();

for (const [file, board] of boards) {
  const where = `studio: ${file}`;
  const text = await Bun.file(path.join(source, file)).text();

  const row = rows.findLast(entry => entry.y < board.y);
  if (!row) throw new Error(`${where} sits above every row heading`);

  const helmet = text.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? "";
  for (const [link] of helmet.matchAll(/<link [^>]*href="([^"]+)"[^>]*>/g)) {
    if (link.includes("preconnect")) continue;
    if (!link.includes("family=Instrument+Serif")) throw new Error(`${where} loads a font the site does not serve: ${link}`);
  }
  const css = [...helmet.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]!.trim()).join("\n");

  let html = text.match(/<\/helmet>([\s\S]*?)<\/x-dc>/)?.[1]?.trim();
  if (!html) throw new Error(`${where} has no page inside <x-dc>`);
  if (/<script|<iframe|<object|<embed|\son[a-z]+=/i.test(html)) throw new Error(`${where} carries script or embedded content`);
  if (/<(sc|dc|x)-[a-z]+/.test(html)) throw new Error(`${where} uses a canvas component this import does not expand`);

  const props = JSON.parse(text.match(/data-props='([^']*)'/)?.[1] ?? "{}") as Record<string, { default?: string; width?: number; height?: number }>;
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name: string) => {
    const fallback = props[name]?.default;
    if (typeof fallback !== "string") throw new Error(`${where} has a hole {{${name}}} with no default`);
    return fallback;
  });

  const swap = (_: string, id: string) => {
    const name = PHOTOS[id];
    if (!name) throw new Error(`${where} uses a photograph (${id}) with no name in PHOTOS`);
    usedPhotos.add(id);
    return `%photo:${name}%`;
  };
  html = html.replace(/\/_blob\/([0-9a-f]{32})/g, swap);
  const pageCss = css.replace(/\/_blob\/([0-9a-f]{32})/g, swap);

  // Indentation only. A line break is a space to HTML, so this changes nothing drawn.
  if (!/white-space:\s*pre/.test(html)) html = html.replace(/\n\s+/g, "\n");

  const preview = props.$preview;
  const width = preview?.width ?? board.w;
  const height = preview?.height ?? board.h;
  const title = (board.title ?? file).replace(/^[^·]*·\s*/, "");

  sections.get(row.id)!.pages.push({ id: file.replace(/\.dc\.html$/, "").toLowerCase(), title, width, height, css: pageCss, html });
}

const output = [...sections.values()].filter(section => section.pages.length > 0);
await mkdir(path.dirname(OUT), { recursive: true });
await Bun.write(OUT, `${JSON.stringify({ sections: output }, null, 1)}\n`);
const count = output.reduce((sum, section) => sum + section.pages.length, 0);
console.log(`  ${count} pages in ${output.length} rows -> ${path.relative(process.cwd(), OUT)} (${(Bun.file(OUT).size / 1024).toFixed(0)} KB)`);

// The photographs, at the page's own height: a full-bleed plate is drawn 1040
// px tall at most, and the studio mostly shows pages far smaller than that.
await mkdir(PHOTO_DIR, { recursive: true });
for (const id of usedPhotos) {
  const from = path.join(source, `${id}.jpg`);
  if (!(await Bun.file(from).exists())) {
    console.warn(`  ${PHOTOS[id]}: no ${id}.jpg in ${source}, so the copy in src/assets/studio is kept`);
    continue;
  }
  const to = path.join(PHOTO_DIR, `${PHOTOS[id]}.jpg`);
  const done = Bun.spawnSync(["sips", "-Z", "1040", "-s", "format", "jpeg", "-s", "formatOptions", "low", from, "--out", to]);
  if (done.exitCode !== 0) throw new Error(new TextDecoder().decode(done.stderr));
  console.log(`  ${PHOTOS[id]}.jpg  ${(Bun.file(to).size / 1024).toFixed(0)} KB`);
}
