/**
 * Client side of the editor — the agent that makes up an issue.
 *
 * Photographs never leave the browser except here, and only when the reader
 * asks: each is drawn down to a small JPEG preview, enough for a model to see
 * what it shows and nowhere near enough to print. The desk's own ids stay on
 * the desk; the editor sees labels ("p1", "p2"…) that are mapped back here.
 */

import { api } from "@/lib/api";
import { buildPage, isArchetype } from "@/lib/magazine/archetypes";
import {
  defaultDesign,
  CUSTOM_SLOTS,
  type CustomDesign,
  type CustomLeaves,
  type CustomPage,
  type CustomSlot,
  type Palette,
} from "@/lib/magazine/custom";
import { BODY_START } from "@/lib/magazine/compose";
import { buildGrid, editorPage, inventGrid } from "@/lib/magazine/grid";
import { THEMES, type ThemeId } from "@/lib/magazine/themes";
import { clampType, FACES, FACE_IDS, type FaceId, type TypeChoice } from "@/lib/magazine/typography";
import {
  cleanNote,
  DEFAULT_DIRECTION,
  type EditorDesign,
  type EditorDirection,
  type EditorFace,
  type EditorPage,
  type EditorPlan,
  type EditorRequest,
  type EditorTheme,
  type Focus,
  type Photo,
} from "@/types";

/** Longest side of a preview. Models look at about this much of an image anyway. */
const PREVIEW_PX = 512;
const PREVIEW_QUALITY = 0.72;

/** What the desk applies: the plan, in the desk's own ids and types. */
export type EditorResult = {
  title: string;
  theme: ThemeId;
  /** Desk photo ids, cover first. */
  order: string[];
  focus: Record<string, Focus>;
  tilt: number;
  /** Pages the editor drew, when it chose to design the issue itself. */
  design: CustomDesign | null;
  /** Its page-by-page plan for the body, by page index; empty unless it designed the issue. */
  leaves: CustomLeaves;
  /** A line for each photograph, by desk id. */
  captions: Record<string, string>;
  type: TypeChoice | null;
  notes: string[];
};

/**
 * When each style is the right one — what the blurb, written for readers
 * choosing by eye, never says. Without it the editor chose Nocturne for
 * everything, it being the style whose description sounds most like a mood.
 */
const SUITS: Record<ThemeId, string> = {
  atlas:
    "A daylight story with five or more photographs, most of them landscape-shaped — views, streets, places, gatherings — told in the order it happened.",
  modernist:
    "Cities, architecture and design; bold, graphic photographs with strong lines; a brisk, reported voice with plenty of text.",
  nocturne:
    "Only stories that happen after dark or in low light — dusk, night markets, candlelit dinners, lamplit rooms, deep winter — or a quiet, literary, melancholy story. Never a sunny daylight one.",
  zine: "Casual days with friends, road trips, parties, festivals, phone snapshots, and a chatty or funny voice.",
  custom:
    "Choose this when most photographs are portrait-shaped, when there are four or fewer photographs, when one photograph is far stronger than the rest — the ready styles are built around landscape pictures and crop portraits badly — or whenever the issue deserves pages designed for it alone. You draw every page yourself, as a grid.",
};

/**
 * The one style the editor is offered: its own design. It draws every page of
 * every issue new, so the house styles — the reader's to choose by hand on the
 * desk — are never what it hands back.
 */
export function offeredThemes(): EditorTheme[] {
  return [THEMES.custom].map(theme => ({
    id: theme.id,
    name: theme.name,
    blurb:
      theme.id === "custom"
        ? "Pages the editor designs itself, from boxes for words and boxes for photographs, set in type it chooses."
        : theme.blurb,
    suits: SUITS[theme.id],
  }));
}

/**
 * Faces a magazine would set a feature in. The typewriter is left out:
 * it is the zine's voice, and an editor reaching for it on a designed issue
 * produced pages that read as a draft rather than a magazine.
 */
const MAGAZINE_FACES: FaceId[] = FACE_IDS.filter(id => id !== "typewriter");

export const offeredFaces = (): EditorFace[] =>
  MAGAZINE_FACES.map(id => ({ id, name: FACES[id].name, body: FACES[id].body }));

/**
 * The kind of page each body page is, in order, as the "custom" style deals
 * them: its fixed sequence, repeated. Sent to the editor so its page plan
 * knows which side of the spread every page falls on, and used again here to
 * lay that plan onto the right page numbers.
 */
function rhythm(count = 24): CustomSlot[] {
  const fixed = THEMES.custom.fixed ?? THEMES.custom.cycle;
  return Array.from({ length: count }, (_, k) => fixed[k % fixed.length]!.replace("custom-", "") as CustomSlot);
}

/**
 * One planned page, drawn: the grid the editor drew, the full-bleed page, or
 * from a server that still sends it, a fixed layout and its share.
 */
function drawPlanned(page: EditorPage): CustomPage | null {
  if (page.layout !== undefined) return isArchetype(page.layout) ? buildPage(page.layout, page.share ?? Number.NaN) : null;
  return editorPage(page);
}

/** The most body pages an issue can run to, past which there is nothing left to design. */
const BODY_PAGES = 96 - BODY_START;

/**
 * The editor's body plan as single pages, from the first page of the body on,
 * and every page after the end of its plan invented to follow it — so an
 * issue it designs never falls back on the three shared pages, however long
 * the story runs. A page the composer never reaches costs nothing.
 */
function planLeaves(pages: EditorDesign["pages"]): CustomLeaves {
  const slots = rhythm(BODY_PAGES);
  const leaves: CustomLeaves = {};
  pages.forEach((page, k) => {
    const drawn = drawPlanned(page);
    if (drawn) leaves[BODY_START + k] = { slot: slots[k]!, page: drawn };
  });
  let previous: ReturnType<typeof inventGrid> | undefined;
  for (let k = pages.length; k < BODY_PAGES; k++) {
    if (leaves[BODY_START + k]) continue;
    previous = inventGrid(Math.random, previous);
    leaves[BODY_START + k] = { slot: slots[k]!, page: { boxes: buildGrid(previous), ...(previous.stock ? { stock: previous.stock } : {}) } };
  }
  return leaves;
}

/**
 * The three shared pages of an issue the editor made, invented rather than
 * taken from its plan. Every page it reaches has a leaf of its own
 * (`planLeaves`), so these are never the issue's pages; they are only what the
 * reader starts from if they turn the issue into a design of their own.
 */
function settleDesign(): CustomDesign {
  const design = defaultDesign();
  for (const slot of CUSTOM_SLOTS) {
    const invented = inventGrid();
    design[slot] = { boxes: buildGrid(invented), ...(invented.stock ? { stock: invented.stock } : {}) };
  }
  return design;
}

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

/**
 * The editor's colours, if they can be read. A page of body copy in ink on
 * paper needs the contrast of print (7:1, WCAG's enhanced level); a quote is
 * large type, set in paper on accent, and needs 3:1. A palette that fails
 * either is dropped whole rather than patched — the house colours are a
 * better issue than a mended guess.
 */
function settlePalette(palette: EditorPlan["palette"]): Palette | undefined {
  if (!palette) return undefined;
  if (contrast(palette.ink, palette.paper) < 7) return undefined;
  if (contrast(palette.accent, palette.paper) < 3) return undefined;
  return palette;
}

/** Whitespace and curly punctuation folded, so a quote copied faithfully is recognised as such. */
const plain = (text: string) =>
  text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Pull quotes that really are in the story. A quote the reader never wrote,
 * set large on a coloured block, is the worst thing an editor could put in
 * their mouth; anything not found word for word is left out.
 */
function settleQuotes(quotes: string[], story: string): string[] {
  const text = plain(story);
  return (
    quotes
      .filter(quote => quote.split(/\s+/).length <= 24 && text.includes(plain(quote).replace(/[.,;:!?]+$/, "")))
      // Lifted from mid-sentence, a quote starts in lower case, which set large
      // reads as a mistake. The words stay exactly the reader's.
      .map(quote => quote.charAt(0).toUpperCase() + quote.slice(1))
  );
}

/**
 * Type held to what reads well in a magazine column: the size and leading the
 * panel allows are wider than that, for readers who want a poster or a
 * pamphlet, but the editor's choice should look like a feature.
 */
function settleType(type: NonNullable<EditorPlan["type"]>): TypeChoice {
  const face = (id: string, fallback: FaceId): FaceId =>
    MAGAZINE_FACES.includes(id as FaceId) ? (id as FaceId) : fallback;
  const body = face(type.body, "oldstyle");
  return clampType({
    display: face(type.display, "editorial"),
    body: FACES[body].body ? body : "oldstyle",
    size: Math.min(10.5, Math.max(9, type.size)),
    leading: Math.min(1.7, Math.max(1.45, type.leading)),
    align: type.align,
  });
}

async function preview(photo: Photo): Promise<{ data: string; width: number; height: number }> {
  // Honouring the camera's orientation flag, so a portrait taken on a phone is
  // judged as a portrait and its focus point lands where the reader sees it.
  const bitmap = await createImageBitmap(photo.file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PREVIEW_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();

  return { data: canvas.toDataURL("image/jpeg", PREVIEW_QUALITY), ...size };
}

/**
 * The direction as it goes out. "Your own" with nothing written is the
 * editor's own judgement, which is what it would get anyway; a named look
 * carries no note, because the panel only offers one for "Your own".
 */
function sendable(direction: EditorDirection | undefined): EditorDirection {
  if (!direction) return DEFAULT_DIRECTION;
  if (direction.id !== "custom") return { id: direction.id, note: "" };
  const note = cleanNote(direction.note);
  return note ? { id: "custom", note } : DEFAULT_DIRECTION;
}

/**
 * Where a request to the editor has got to. The previews and the setting of
 * the pages happen here and are counted as they go; the editor's own work
 * happens far away in one call that says nothing until it answers, so that
 * stretch is "thinking", started at a known moment and ended by the answer.
 */
export type EditorStep = { stage: "previews"; done: number; total: number } | { stage: "thinking"; since: number } | { stage: "setting" };

/** Sends the desk to the editor and returns its plan in desk terms. */
export async function askEditor(
  input: {
    title: string;
    story: string;
    photos: Photo[];
    direction?: EditorDirection;
  },
  onStep?: (step: EditorStep) => void,
): Promise<EditorResult> {
  const labels = input.photos.map((_, index) => `p${index + 1}`);
  let made = 0;
  onStep?.({ stage: "previews", done: 0, total: input.photos.length });
  const previews = await Promise.all(
    input.photos.map(async photo => {
      const shot = await preview(photo);
      onStep?.({ stage: "previews", done: ++made, total: input.photos.length });
      return shot;
    }),
  );

  const request: EditorRequest = {
    title: input.title,
    story: input.story,
    words: input.story.trim() ? input.story.trim().split(/\s+/).length : 0,
    rhythm: rhythm(),
    themes: offeredThemes(),
    faces: offeredFaces(),
    direction: sendable(input.direction),
    photos: previews.map((shot, index) => ({
      id: labels[index]!,
      preview: shot.data,
      width: shot.width,
      height: shot.height,
    })),
  };

  onStep?.({ stage: "thinking", since: Date.now() });
  const plan = await api.post<EditorPlan>("/api/editor", request);
  onStep?.({ stage: "setting" });

  const idOf = new Map(labels.map((label, index) => [label, input.photos[index]!.id]));
  const order = plan.order.map(label => idOf.get(label)).filter((id): id is string => Boolean(id));
  const focus = Object.fromEntries(
    plan.focus.flatMap(point => {
      const id = idOf.get(point.id);
      return id ? [[id, { x: Math.round(point.x), y: Math.round(point.y) }]] : [];
    }),
  );
  const theme = (plan.theme in THEMES ? plan.theme : "atlas") as ThemeId;
  const designed = theme === "custom" && plan.design;

  return {
    title: plan.title,
    theme,
    order,
    focus,
    tilt: plan.tilt,
    design: designed
      ? { ...settleDesign(), palette: settlePalette(plan.palette), quotes: settleQuotes(plan.quotes, input.story) }
      : null,
    type: designed && plan.type ? settleType(plan.type) : null,
    leaves: designed ? planLeaves(plan.design!.pages ?? []) : {},
    captions: Object.fromEntries(
      plan.captions.flatMap(entry => {
        const id = idOf.get(entry.id);
        return id ? [[id, entry.caption]] : [];
      }),
    ),
    notes: plan.notes,
  };
}
