/**
 * Compiles the Journal (`/blog`) from `src/content/blog/*.md`.
 *
 * Each post is a Markdown file with a short front matter block. This reads
 * them all, checks them, renders the Markdown with Bun's own parser, and
 * writes two things the app imports:
 *
 * - `src/lib/blog/posts.ts`: every post's metadata, newest first, and a loader
 *   per post for its body.
 * - `src/lib/blog/bodies/<slug>.ts`: one post's rendered HTML, one file each.
 *
 * Bodies are separate modules so the bundler makes each its own chunk. A post
 * a day is several megabytes of HTML within a year, and the Journal's index
 * page needs none of it; only the post being read is fetched.
 *
 * The Markdown is rendered here, at build time, rather than in the browser:
 * Bun's parser runs only under Bun, and a parser in the bundle would be paid
 * for by every reader to save work that can be done once.
 *
 * `build.ts` runs this before bundling, so production always matches the
 * sources. The generated files are committed as well, because `typecheck`
 * runs before the build in CI and the dev server bundles straight from `src/`.
 * Never edit them by hand.
 *
 * Anything that would publish wrong stops the compile: a title too long for
 * its <title>, a link to a page that does not exist, raw HTML, an image, a
 * post too short to be worth indexing. The blog-writer agent runs this after
 * every post it writes, so its mistakes stop here rather than on the site.
 *
 * Usage: bun scripts/blog.ts
 */

import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { POST_KINDS, type PostKind, type PostMeta } from "../src/lib/blog/types";
import { ROUTES } from "../src/lib/seo";

const ROOT = path.join(import.meta.dir, "..");
const SOURCE_DIR = path.join(ROOT, "src/content/blog");
const OUT_DIR = path.join(ROOT, "src/lib/blog");
const BODY_DIR = path.join(OUT_DIR, "bodies");

/**
 * Below this a post is thin content, which does a site more harm in search
 * than having no post at all. Code blocks are not counted.
 */
const MIN_WORDS = 600;
const WORDS_PER_MINUTE = 220;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today in India, where the Journal is published, as an ISO day. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * The front matter: `key: value` lines between two `---` lines, with
 * `[a, b]` for a list. Deliberately this small rather than a YAML parser,
 * because the fields are fixed and a richer syntax would only be another way
 * to write a post that parses into something unexpected.
 */
function frontMatter(file: string, text: string): { fields: Record<string, string | string[]>; body: string } {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${file}: no front matter (a block between two --- lines at the top)`);
  const fields: Record<string, string | string[]> = {};
  for (const line of match[1]!.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon < 1) throw new Error(`${file}: cannot read front matter line "${line}"`);
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim();
    const unquote = (value: string) => value.replace(/^(["'])(.*)\1$/, "$2");
    fields[key] = raw.startsWith("[")
      ? raw
          .replace(/^\[|\]$/g, "")
          .split(",")
          .map(item => unquote(item.trim()))
          .filter(Boolean)
      : unquote(raw);
  }
  return { fields, body: text.slice(match[0].length) };
}

function text(file: string, fields: Record<string, string | string[]>, key: string, required: true): string;
function text(file: string, fields: Record<string, string | string[]>, key: string, required: false): string | undefined;
function text(file: string, fields: Record<string, string | string[]>, key: string, required: boolean) {
  const value = fields[key];
  if (value === undefined || value === "") {
    if (required) throw new Error(`${file}: front matter needs "${key}"`);
    return undefined;
  }
  if (Array.isArray(value)) throw new Error(`${file}: "${key}" should be a single value, not a list`);
  return value;
}

function isoDay(file: string, key: string, value: string): string {
  if (!ISO_DAY.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new Error(`${file}: "${key}" should be a day like 2026-10-01, not "${value}"`);
  }
  return value;
}

/** Words a reader reads: the Markdown minus code blocks, link targets and markup. */
function countWords(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\]\([^)]*\)/g, "]")
    .replace(/[#>*_`|[\]-]/g, " ")
    .split(/\s+/)
    .filter(word => /[\p{L}\p{N}]/u.test(word)).length;
}

type Compiled = { meta: PostMeta; html: string; draft: boolean };

/**
 * The versions an engineering post may name in `feature`: the headings of
 * `CHANGELOG.md`. Not `versions.json`, which holds only the current version,
 * while a post may explain something that shipped long before it.
 */
async function releasedVersions(): Promise<Set<string>> {
  const changelog = await Bun.file(path.join(ROOT, "CHANGELOG.md")).text();
  return new Set([...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(match => match[1]!));
}

function compile(file: string, source: string, slugs: Set<string>, versions: Set<string>): Compiled {
  const slug = path.basename(file, ".md");
  if (!SLUG.test(slug)) throw new Error(`${file}: the file name is the address, so lowercase letters, digits and single hyphens only`);

  const { fields, body } = frontMatter(file, source);
  const known = new Set(["title", "description", "kind", "date", "updated", "tags", "keyword", "feature", "draft"]);
  for (const key of Object.keys(fields)) {
    if (!known.has(key)) throw new Error(`${file}: unknown front matter "${key}" (known: ${[...known].join(", ")})`);
  }

  const title = text(file, fields, "title", true);
  const description = text(file, fields, "description", true);
  // Counted in characters as build.ts counts them, so a title accepted here is never refused there.
  if ([...title].length > 60) throw new Error(`${file}: title is ${[...title].length} characters; 60 at most, it is also the <title>`);
  if ([...description].length > 155) {
    throw new Error(`${file}: description is ${[...description].length} characters; 155 at most, it is also the meta description`);
  }
  if ([...description].length < 70) throw new Error(`${file}: description is under 70 characters; say what the reader will get from the post`);

  const kind = text(file, fields, "kind", true) as PostKind;
  if (!(kind in POST_KINDS)) throw new Error(`${file}: kind "${kind}" is not one of ${Object.keys(POST_KINDS).join(", ")}`);

  const date = isoDay(file, "date", text(file, fields, "date", true));
  const updatedText = text(file, fields, "updated", false);
  const updated = updatedText ? isoDay(file, "updated", updatedText) : undefined;
  if (updated && updated < date) throw new Error(`${file}: updated (${updated}) is before date (${date})`);

  const tagsField = fields.tags ?? [];
  const tags = Array.isArray(tagsField) ? tagsField : [tagsField];
  if (tags.length < 1 || tags.length > 4) throw new Error(`${file}: 1 to 4 tags`);
  // The kind is already the post's filing; a tag that repeats it files it twice.
  for (const tag of tags) {
    if (tag !== tag.toLowerCase()) throw new Error(`${file}: tag "${tag}" should be lowercase`);
    if (tag === kind || tag === `${kind}s`) throw new Error(`${file}: tag "${tag}" repeats the kind; tags say what the post is about`);
  }
  const feature = text(file, fields, "feature", false);
  // Both explain a shipped feature, so both say which release shipped it.
  if ((kind === "engineering" || kind === "spotlight") && !feature) {
    throw new Error(`${file}: ${kind === "engineering" ? "an engineering" : "a spotlight"} post names the version it explains in "feature"`);
  }
  if (feature && !versions.has(feature)) {
    throw new Error(`${file}: feature "${feature}" is not a version in CHANGELOG.md (${[...versions].join(", ")})`);
  }

  // Markdown rules the renderer cannot enforce by itself.
  if (/^# /m.test(body.replace(/```[\s\S]*?```/g, ""))) {
    throw new Error(`${file}: no "# " headings in the body; the page sets the title as its only <h1>, so start sections at "## "`);
  }
  if (/!\[[^\]]*\]\(/.test(body)) {
    throw new Error(`${file}: images are not supported yet; there is nowhere for a post's pictures to be served from`);
  }

  // Every link into the site must reach a page that exists. A post linking
  // to a feature that was never built is worse than one with no link.
  for (const [, target] of body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const href = target!;
    if (href.startsWith("#")) continue;
    if (href.startsWith("/")) {
      const route = href.replace(/[#?].*$/, "").replace(/\/+$/, "") || "/";
      const post = route.match(/^\/blog\/(.+)$/)?.[1];
      if (post ? !slugs.has(post) : !(route in ROUTES)) {
        throw new Error(`${file}: links to ${href}, which is not a page on the site`);
      }
      continue;
    }
    if (!href.startsWith("https://")) throw new Error(`${file}: link "${href}" should be https:// or a path on the site`);
  }

  const words = countWords(body);
  if (words < MIN_WORDS) throw new Error(`${file}: ${words} words; a post needs at least ${MIN_WORDS} to be worth indexing`);

  // Raw HTML is escaped rather than passed through: posts are written by an
  // agent from things it read on the web, and nothing it copied should be
  // able to put a script or a form on ouratlas.co.in.
  let html = Bun.markdown.html(body, { noHtmlBlocks: true, noHtmlSpans: true, headings: { ids: true } });
  // Other sites open in a new tab and learn nothing about this one.
  html = html.replaceAll('<a href="https://', '<a target="_blank" rel="noopener noreferrer" href="https://');

  return {
    meta: {
      slug,
      title,
      description,
      kind,
      date,
      ...(updated ? { updated } : {}),
      tags,
      ...(fields.keyword ? { keyword: text(file, fields, "keyword", true) } : {}),
      ...(feature ? { feature } : {}),
      minutes: Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)),
    },
    html,
    draft: fields.draft === "true",
  };
}

/** Writes a file only when its contents change, so a rebuild does not wake the dev server for nothing. */
async function writeIfChanged(file: string, contents: string): Promise<void> {
  const existing = Bun.file(file);
  if ((await existing.exists()) && (await existing.text()) === contents) return;
  await Bun.write(file, contents);
}

/**
 * Compiles every post, writes the generated modules, and returns the
 * published posts newest first.
 *
 * A draft (`draft: true`) or a post dated after today is checked like any
 * other but left out, so a post can be written ahead and appears on its day
 * with the next build.
 */
export async function compileBlog(): Promise<PostMeta[]> {
  await mkdir(SOURCE_DIR, { recursive: true });
  const files = (await readdir(SOURCE_DIR)).filter(name => name.endsWith(".md")).sort();
  const slugs = new Set(files.map(name => path.basename(name, ".md")));
  const versions = await releasedVersions();

  const now = today();
  const published: Compiled[] = [];
  // One post per search: two chasing the same keyword compete with each
  // other in the results. Near-synonyms are the writer's judgement; exact
  // repeats are caught here, drafts and held-back posts included.
  const keywords = new Map<string, string>();
  for (const name of files) {
    const compiled = compile(`src/content/blog/${name}`, await Bun.file(path.join(SOURCE_DIR, name)).text(), slugs, versions);
    const keyword = compiled.meta.keyword?.toLowerCase().replace(/\s+/g, " ").trim();
    if (keyword) {
      const taken = keywords.get(keyword);
      if (taken) throw new Error(`src/content/blog/${name}: keyword "${keyword}" is already ${taken}'s`);
      keywords.set(keyword, compiled.meta.slug);
    }
    if (compiled.draft || compiled.meta.date > now) {
      console.log(` blog: held back ${compiled.meta.slug} (${compiled.draft ? "draft" : `dated ${compiled.meta.date}`})`);
      continue;
    }
    published.push(compiled);
  }
  // A link to a held-back post would be a dead link until its day.
  const live = new Set(published.map(post => post.meta.slug));
  for (const post of published) {
    for (const [, slug] of post.html.matchAll(/href="\/blog\/([a-z0-9-]+)/g)) {
      if (!live.has(slug!)) throw new Error(`src/content/blog/${post.meta.slug}.md: links to /blog/${slug}, which is not published yet`);
    }
  }
  published.sort((a, b) => b.meta.date.localeCompare(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug));

  await mkdir(BODY_DIR, { recursive: true });
  for (const { meta, html } of published) {
    await writeIfChanged(
      path.join(BODY_DIR, `${meta.slug}.ts`),
      `// Generated by scripts/blog.ts from src/content/blog/${meta.slug}.md. Do not edit.\nexport default ${JSON.stringify(html)};\n`,
    );
  }
  for (const name of await readdir(BODY_DIR)) {
    if (!live.has(path.basename(name, ".ts"))) await rm(path.join(BODY_DIR, name));
  }

  const metas = published.map(post => post.meta);
  await writeIfChanged(
    path.join(OUT_DIR, "posts.ts"),
    [
      "// Generated by scripts/blog.ts from src/content/blog/*.md. Do not edit.",
      'import type { PostMeta } from "./types";',
      "",
      "/** Every published post, newest first. */",
      `export const POSTS: PostMeta[] = ${JSON.stringify(metas, null, 2)};`,
      "",
      "/** Each post's rendered HTML, a chunk of its own so only the post being read is fetched. */",
      "export const BODIES: Record<string, () => Promise<{ default: string }>> = {",
      ...metas.map(meta => `  ${JSON.stringify(meta.slug)}: () => import("./bodies/${meta.slug}"),`),
      "};",
      "",
    ].join("\n"),
  );

  console.log(` blog: ${metas.length} published post${metas.length === 1 ? "" : "s"}`);
  return metas;
}

if (import.meta.main) await compileBlog();
