/**
 * The editor: the art director of the issue. It looks at the photographs and
 * reads the story, and decides how the magazine is made up — its style, which
 * photograph is the cover and in what order the rest are dealt, the layout of
 * every page, where each picture's subject sits so the crop keeps it, a line
 * under each photograph, and what the issue is called.
 *
 * It is the one feature that sends photographs anywhere, and only as small
 * previews the browser makes when the reader asks for it. They go to the model
 * with the story, the plan comes back, and nothing is written down on the way
 * through — no logging, no database, no file.
 *
 * Claude Opus by default (`editorProvider()` in `api/env.ts`), through the
 * Anthropic SDK: adaptive thinking, because making up a magazine is judgement
 * across pictures and pacing, and the plan returned as structured output
 * against a JSON schema. OpenAI remains available with EDITOR_PROVIDER=openai.
 * Either way the plan is checked again here, because the desk applies it
 * without asking.
 *
 * This module is the engine; `routes/editor.ts` is the endpoint.
 */

import Anthropic from "@anthropic-ai/sdk";

import { editor, editorProvider, polish } from "@api/env";
import { HttpError } from "@api/http";
import type { EditorPlan, EditorRequest } from "@/types";

/** Enough of the story to judge its mood, places and moments; the rest adds cost, not judgement. */
const STORY_CHARS = 30_000;

/** Longest body plan kept: past this the shared design takes over, which is a rhythm of its own. */
const MAX_PAGES = 16;

const SYSTEM = `You are the art director of a travel magazine — the kind people keep: generous photographs, confident type, pages that each feel considered. A reader has brought the photographs and their own account of one trip, and you make up their issue. It should feel like a real feature spread: travel-magazine polish, but warm, playful and personal rather than corporate.

THE COVER. A single photograph fills a portrait page (520 × 693), so choose the most arresting picture that survives a portrait crop — a clear subject, a face, a moment — not a panorama whose point sits at one edge.

THE ORDER. "cover" names the cover photograph. "order" lists every other photograph — not the cover — in the order they are dealt through the pages. Follow the trip: where the story names places or times of day, keep their photographs in the same sequence. Within that, pace it like an editor — wide view, then detail, then people — so two similar pictures never meet.

THE STYLE. Choose one style from the list. Each says what it looks like and what it suits; judge the photographs first (daylight or night, landscape or portrait, calm or crowded), then the voice of the writing. Most trips are daylight trips. Choose "custom" — pages you design — whenever the ready styles would crop the photographs badly (mostly portraits, few photographs, one far stronger than the rest), or when the material deserves a bolder, more varied issue than a ready style gives. For any other style set design and type to null.

DESIGNING PAGES (only for "custom"). You never draw boxes. You choose a layout and a share for each page from the list of layouts; every layout already fills its page edge to edge on the magazine grid, with proper margins and gutters, so there is no white space for you to manage. Your job is rhythm and fit:
- "pages" is your plan for the body of the issue, page by page in reading order. The rhythm list tells you which kind each page is — "special" pages open the issue and return every sixth page (make them showpieces: a hero with a high share, or a picture page), "left" and "right" face each other across a spread.
- Make every spread a pair that answers itself — a hero facing a column page, mirrored columns, a picture page facing a text-heavy one. Never repeat the same layout on consecutive pages, and vary the shares so the issue breathes: big moments big, quiet pages quieter.
- Fit layouts to the photographs they will receive, in your order: column, pair and checkerboard layouts for portraits; hero, band and picture pages for landscapes; the strip for three small details.
- Count photographs. The first photograph in "order" always goes to the feature's opening page, under the headline, before your planned pages begin; your pages receive the rest, from the second in "order" on, each taking as many as its layout holds. Plan pages until those are used up, then stop — pages beyond your plan are set as text in the shared design. Never plan more photographs than there are.
- Estimate length: a text-heavy page holds about 450 words, a page half photograph about 250. Do not plan far more pages than the story can fill.
- "special", "left" and "right" are the shared design used past the end of your plan: choose them as a sound default spread.
- Type: a display face with character for headlines; a serif or clean sans for body at 9 to 10.5, leading 1.45 to 1.7, justified for serifs.
- Make it look like something people would post: every designed issue should have at least one full-bleed page and one or two quote layouts, placed where the story peaks. Never put two full-bleed pages next to each other.

THE PALETTE (designed issues only). Three hex colours that make the issue feel like these photographs: "paper", the page colour — a warm off-white, cream or pale tint taken from the pictures' light, not pure white; "ink", a deep, near-black colour for text, tinted toward the photographs' shadows; "accent", the most characteristic saturated colour in the set (terracotta roofs, sea blue, a painted shutter, marigold), used for quote blocks and small type. Text is set in ink on paper and quotes in paper on accent, so both pairs must read clearly: ink very dark against a light paper, accent strong and mid-to-dark.

PULL QUOTES (designed issues only). Choose the lines a reader would screenshot: short (at most twenty words), vivid, funny or moving, and copied exactly, word for word and with the story's own punctuation — never paraphrased, never stitched from two places. List them in the order they appear in the story: one for each quote a planned page takes, one for each full-bleed page, and three or four more — once the photographs are spent, the text pages that follow are broken up with the spare quotes, so a long story needs more of them. Leave the list empty for a ready style.

FRAMING. For every photograph give the point its subject is at, as percentages across and down (0–100): a face, a doorway, the gull mid-air — what a crop must never cut. 50, 50 when there is no single subject.

CAPTIONS. Under every photograph, one short caption in the magazine's voice — at most eight words, specific, a little witty where the picture allows, never a cliché. Name only what the story or the picture shows; if the story doesn't place it, describe it rather than guess where it is.

THE TITLE. At most six words, drawn from the trip itself — a place, a moment, a phrase from the writing. Something a reader would pick up. No quotation marks, no colon-and-subtitle, no "journey", "adventure", "wanderlust" or "memories".

TILT only matters for the zine style: 1 to 4 degrees there, 0 otherwise.

NOTES. Three to five one-sentence notes to the reader, as an editor would pencil in the margin: what you chose and why, in plain words. Refer to photographs by what they show, never by their labels. No flattery.

Only use what you can see and what the story says. Never invent places, people or facts.`;

/** The plan's shape, built per request so ids, styles, layouts and faces are closed lists. */
function schema(request: EditorRequest) {
  const ids = request.photos.map(photo => photo.id);
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "theme", "cover", "order", "focus", "captions", "tilt", "design", "type", "palette", "quotes", "notes"],
    properties: {
      title: { type: "string" },
      theme: { type: "string", enum: request.themes.map(theme => theme.id) },
      cover: { type: "string", enum: ids },
      order: { type: "array", items: { type: "string", enum: ids } },
      focus: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "x", "y"],
          properties: { id: { type: "string", enum: ids }, x: { type: "number" }, y: { type: "number" } },
        },
      },
      captions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "caption"],
          properties: { id: { type: "string", enum: ids }, caption: { type: "string" } },
        },
      },
      tilt: { type: "number" },
      design: { anyOf: [designSchema(request), { type: "null" }] },
      type: { anyOf: [typeSchema(request), { type: "null" }] },
      palette: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["paper", "ink", "accent"],
            properties: { paper: { type: "string" }, ink: { type: "string" }, accent: { type: "string" } },
          },
          { type: "null" },
        ],
      },
      quotes: { type: "array", items: { type: "string" } },
      notes: { type: "array", items: { type: "string" } },
    },
  } as const;
}

function designSchema(request: EditorRequest) {
  const page = {
    type: "object",
    additionalProperties: false,
    required: ["layout", "share"],
    properties: {
      layout: { type: "string", enum: request.layouts.map(layout => layout.id) },
      share: { type: "number" },
    },
  } as const;
  return {
    type: "object",
    additionalProperties: false,
    required: ["special", "left", "right", "pages"],
    properties: { special: page, left: page, right: page, pages: { type: "array", items: page } },
  } as const;
}

function typeSchema(request: EditorRequest) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["display", "body", "size", "leading", "align"],
    properties: {
      display: { type: "string", enum: request.faces.map(face => face.id) },
      body: { type: "string", enum: request.faces.filter(face => face.body).map(face => face.id) },
      size: { type: "number" },
      leading: { type: "number" },
      align: { type: "string", enum: ["justify", "left"] },
    },
  } as const;
}

const shape = (width: number, height: number) =>
  width > height * 1.1 ? "landscape" : height > width * 1.1 ? "portrait" : "square";

/** Everything but the pictures, as the text the model reads first. */
function brief(request: EditorRequest): string {
  const styles = request.themes
    .map(theme => `- ${theme.id} ("${theme.name}"): looks like — ${theme.blurb} Suits — ${theme.suits}`)
    .join("\n");
  const layouts = request.layouts
    .map(
      layout =>
        `- ${layout.id} ("${layout.name}", ${layout.plates} photograph${layout.plates === 1 ? "" : "s"}${layout.quotes ? `, ${layout.quotes} quote` : ""}, share ${layout.minShare}–${layout.maxShare}): ${layout.description}`,
    )
    .join("\n");
  const faces = request.faces
    .map(face => `- ${face.id}: ${face.name}${face.body ? " (body or display)" : " (display only)"}`)
    .join("\n");
  const story = request.story.trim();
  const shown = story.length > STORY_CHARS ? `${story.slice(0, STORY_CHARS)}\n[…the story continues]` : story;
  const shapes = request.photos.map(photo => shape(photo.width, photo.height));
  const count = (kind: string) => shapes.filter(value => value === kind).length;

  return [
    `Styles:\n${styles}`,
    `Page layouts, for a designed issue:\n${layouts}`,
    `Faces, for a designed issue:\n${faces}`,
    `Rhythm of the body pages, in order: ${request.rhythm.slice(0, MAX_PAGES).map((slot, i) => `${i + 1} ${slot}`).join(", ")}.`,
    `Photographs: ${request.photos.length} (${count("landscape")} landscape, ${count("portrait")} portrait, ${count("square")} square). One is the cover and one goes to the opening page, so your planned pages have ${Math.max(0, request.photos.length - 2)} to share between them.`,
    `Story length: ${request.words.toLocaleString("en")} words.`,
    `Title so far: ${request.title.trim() || "(none yet)"}`,
    `The story:\n${shown || "(no story written yet — judge from the photographs alone)"}`,
    `The photographs follow, each introduced by its label, its full size and its shape.`,
  ].join("\n\n");
}

// ── Anthropic ──────────────────────────────────────────────────────────────

let client: Anthropic | null = null;

/** Built on first use, so a server without the key still boots. */
function anthropic(): Anthropic {
  client ??= new Anthropic({
    apiKey: polish.anthropic.key,
    // Identity-linked keys must name the workspace; ordinary keys reject it.
    defaultHeaders: polish.anthropic.workspace ? { "anthropic-workspace-id": polish.anthropic.workspace } : undefined,
    // The reader is waiting on a spinner; one retry, and a ceiling well past a
    // normal answer but short of an abandoned tab.
    maxRetries: 1,
    timeout: 150_000,
  });
  return client;
}

type ImageMedia = "image/jpeg" | "image/png" | "image/webp";

async function askAnthropic(request: EditorRequest): Promise<unknown> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: brief(request) }];
  for (const photo of request.photos) {
    const comma = photo.preview.indexOf(",");
    const media = photo.preview.slice(5, photo.preview.indexOf(";")) as ImageMedia;
    content.push({ type: "text", text: `${photo.id} — ${photo.width}×${photo.height}, ${shape(photo.width, photo.height)}` });
    content.push({ type: "image", source: { type: "base64", media_type: media, data: photo.preview.slice(comma + 1) } });
  }

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic().beta.messages.create({
      model: editor.anthropicModel,
      max_tokens: 16_000,
      // A declined request is re-run on a fallback model inside the same call,
      // rather than leaving the reader with an error for a trip photograph.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      // Medium, not high: the reader waits on this, and at high the answer took
      // close to a minute without choosing better — the layouts are a closed
      // list, so the judgement is in the picking, not in long deliberation.
      output_config: { effort: "medium", format: { type: "json_schema", schema: schema(request) } },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (error) {
    throw explainAnthropic(error);
  }

  if (response.stop_reason === "refusal") throw new HttpError(422, "The editor declined to lay out these photographs.");
  if (response.stop_reason === "max_tokens") throw new HttpError(502, "The editor ran out of room before finishing. Try again.");

  const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")?.text;
  if (!text) throw new HttpError(502, "The editor's answer could not be read.");
  return JSON.parse(text);
}

/** Maps the SDK's typed errors to what the reader can act on; the operator gets the detail in the log. */
function explainAnthropic(error: unknown): HttpError {
  if (!(error instanceof Anthropic.APIError)) {
    console.error("[editor] anthropic request failed:", error instanceof Error ? error.message : error);
    return new HttpError(502, "The editor could not be reached.");
  }
  console.error(`[editor] anthropic ${error.status}: ${error.message}`);

  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(502, "The editor rejected this server's API key.");
  }
  if (error instanceof Anthropic.RateLimitError) return new HttpError(429, "The editor is busy right now. Try again in a moment.");
  // An empty balance arrives as a 400 with no type of its own.
  if (error instanceof Anthropic.BadRequestError && /credit balance|billing/i.test(error.message)) {
    return new HttpError(503, "The editor is unavailable right now. Your desk is untouched.");
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new HttpError(502, "This server names an editor model its key cannot reach. Check ANTHROPIC_EDITOR_MODEL.");
  }
  return new HttpError(502, "The editor could not be reached.");
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

async function askOpenAI(request: EditorRequest): Promise<unknown> {
  const content: unknown[] = [{ type: "text", text: brief(request) }];
  for (const photo of request.photos) {
    content.push({ type: "text", text: `${photo.id} — ${photo.width}×${photo.height}, ${shape(photo.width, photo.height)}` });
    // "low" is a 512-pixel look at each, which is all the preview holds anyway.
    content.push({ type: "image_url", image_url: { url: photo.preview, detail: "low" } });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${polish.openai.key}` },
    body: JSON.stringify({
      model: editor.openaiModel,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
      response_format: { type: "json_schema", json_schema: { name: "issue_plan", strict: true, schema: schema(request) } },
    }),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: any) => body?.error?.message as string | undefined)
      .catch(() => undefined);
    console.error(`[editor] openai ${response.status}: ${detail ?? "no detail"}`);
    if (response.status === 401 || response.status === 403) return Promise.reject(new HttpError(502, "The editor rejected this server's API key."));
    if (/quota|billing/i.test(detail ?? "")) return Promise.reject(new HttpError(503, "The editor is unavailable right now. Your desk is untouched."));
    if (response.status === 429) return Promise.reject(new HttpError(429, "The editor is busy right now. Try again in a moment."));
    return Promise.reject(new HttpError(502, "The editor could not be reached."));
  }

  const body = (await response.json()) as any;
  const message = body?.choices?.[0]?.message;
  if (message?.refusal) throw new HttpError(422, "The editor declined to lay out these photographs.");
  return JSON.parse(message?.content ?? "null");
}

// ── Checking the plan ──────────────────────────────────────────────────────

const clamp = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback;

/**
 * Checks the plan against the request and repairs what it can.
 *
 * The schema already closes most doors, but a plan is applied to the desk in
 * one go, so an order that drops or repeats a photograph would lose a picture
 * from the magazine. Anything missing is put back in the reader's own order.
 */
function settle(raw: unknown, request: EditorRequest): EditorPlan {
  if (typeof raw !== "object" || raw === null) throw new HttpError(502, "The editor's answer could not be read.");
  const plan = raw as Partial<Record<keyof EditorPlan, unknown>>;
  const ids = request.photos.map(photo => photo.id);

  const theme = request.themes.some(option => option.id === plan.theme) ? (plan.theme as string) : request.themes[0]!.id;

  // The cover is asked for on its own and put first here: asked for as "the
  // first of the order", the editor wrote notes about one cover and ordered
  // another.
  const given = raw as Record<string, unknown>;
  const cover = typeof given.cover === "string" && ids.includes(given.cover) ? [given.cover] : [];
  const chosen = Array.isArray(plan.order) ? plan.order.filter((id): id is string => ids.includes(id as string)) : [];
  const order = [...new Set([...cover, ...chosen, ...ids])];

  const focus = ids.map(id => {
    const given = Array.isArray(plan.focus) ? (plan.focus as any[]).find(entry => entry?.id === id) : undefined;
    return { id, x: clamp(given?.x, 0, 100, 50), y: clamp(given?.y, 0, 100, 50) };
  });

  const captions = ids.flatMap(id => {
    const given = Array.isArray(plan.captions) ? (plan.captions as any[]).find(entry => entry?.id === id) : undefined;
    const caption = typeof given?.caption === "string" ? given.caption.replace(/["“”]/g, "").trim().slice(0, 80) : "";
    return caption ? [{ id, caption }] : [];
  });

  const title = typeof plan.title === "string" ? plan.title.replace(/["“”]/g, "").trim().slice(0, 80) : "";
  const notes = Array.isArray(plan.notes)
    ? plan.notes.filter((note): note is string => typeof note === "string" && note.trim().length > 0).slice(0, 5)
    : [];

  // A design is kept only with the style that uses it, and the style only with
  // a design: "custom" with nothing drawn would hand the reader an issue set in
  // default boxes they never asked for.
  const designed = theme === "custom" ? shapeDesign(plan.design, request) : null;
  const settledTheme =
    theme === "custom" && !designed ? (request.themes.find(option => option.id !== "custom")?.id ?? theme) : theme;

  const designedIssue = settledTheme === "custom";
  const hex = (value: unknown) => (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : null);
  const shade = plan.palette as Record<string, unknown> | null | undefined;
  const palette =
    designedIssue && shade && hex(shade.paper) && hex(shade.ink) && hex(shade.accent)
      ? { paper: hex(shade.paper)!, ink: hex(shade.ink)!, accent: hex(shade.accent)! }
      : null;
  const quotes =
    designedIssue && Array.isArray(plan.quotes)
      ? plan.quotes
          .filter((quote): quote is string => typeof quote === "string" && quote.trim().length > 0)
          .map(quote => quote.trim().slice(0, 240))
          .slice(0, 12)
      : [];

  return {
    title,
    theme: settledTheme,
    order,
    focus,
    captions,
    palette,
    quotes,
    tilt: clamp(plan.tilt, 0, 6, 0),
    design: settledTheme === "custom" ? designed : null,
    type: settledTheme === "custom" ? shapeType(plan.type, request) : null,
    notes,
  };
}

/**
 * Checks a design's shape: a known layout and a number for each page. The
 * share is held inside the layout's range by the desk, which builds the pages.
 */
function shapeDesign(raw: unknown, request: EditorRequest): EditorPlan["design"] {
  if (typeof raw !== "object" || raw === null) return null;
  const design = raw as Record<string, any>;
  const page = (value: any) =>
    request.layouts.some(layout => layout.id === value?.layout) && Number.isFinite(value?.share)
      ? { layout: value.layout as string, share: value.share as number }
      : null;

  const special = page(design.special);
  const left = page(design.left);
  const right = page(design.right);
  if (!special || !left || !right) return null;

  // A plan that stops at the first unreadable page, rather than skipping it:
  // skipping would shift every later page onto the wrong side of its spread.
  const pages: NonNullable<EditorPlan["design"]>["pages"] = [];
  for (const entry of Array.isArray(design.pages) ? design.pages.slice(0, MAX_PAGES) : []) {
    const settled = page(entry);
    if (!settled) break;
    pages.push(settled);
  }
  return { special, left, right, pages };
}

function shapeType(raw: unknown, request: EditorRequest): EditorPlan["type"] {
  if (typeof raw !== "object" || raw === null) return null;
  const type = raw as Record<string, unknown>;
  const face = (value: unknown, body: boolean) =>
    request.faces.some(option => option.id === value && (!body || option.body)) ? (value as string) : null;
  const display = face(type.display, false);
  const body = face(type.body, true);
  if (!display || !body) return null;

  return {
    display,
    body,
    size: clamp(type.size, 7, 12, 10),
    leading: clamp(type.leading, 1.15, 2, 1.6),
    align: type.align === "left" ? "left" : "justify",
  };
}

/** Asks the editor for a plan. Throws `HttpError` for anything the reader should read. */
export async function planIssue(request: EditorRequest): Promise<EditorPlan> {
  const provider = editorProvider();
  if (!provider) {
    throw new HttpError(503, "The editor is switched off: this server has no ANTHROPIC_API_KEY or OPENAI_API_KEY set.");
  }

  let raw: unknown;
  try {
    raw = provider === "anthropic" ? await askAnthropic(request) : await askOpenAI(request);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[editor] request failed:", error instanceof Error ? error.message : error);
    throw new HttpError(502, "The editor could not be reached.");
  }
  return settle(raw, request);
}
