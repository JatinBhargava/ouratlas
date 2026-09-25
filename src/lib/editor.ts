/**
 * Client side of the editor — the agent that makes up an issue.
 *
 * Photographs never leave the browser except here, and only when the reader
 * asks: each is drawn down to a small JPEG preview, enough for a model to see
 * what it shows and nowhere near enough to print. The desk's own ids stay on
 * the desk; the editor sees labels ("p1", "p2"…) that are mapped back here.
 */

import { api } from "@/lib/api";
import { ARCHETYPE_IDS, ARCHETYPES, buildPage, isArchetype } from "@/lib/magazine/archetypes";
import {
  defaultDesign,
  CUSTOM_SLOTS,
  type CustomDesign,
  type CustomLeaves,
  type CustomSlot,
  type Palette,
} from "@/lib/magazine/custom";
import { BODY_START } from "@/lib/magazine/compose";
import { THEMES, type ThemeId } from "@/lib/magazine/themes";
import { clampType, FACES, FACE_IDS, type FaceId, type TypeChoice } from "@/lib/magazine/typography";
import type { EditorDesign, EditorFace, EditorLayout, EditorPlan, EditorRequest, EditorTheme, Focus, Photo } from "@/types";

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
    "A daylight trip with five or more photographs, most of them landscape-shaped — views, streets, places — and a story told in the order it happened.",
  modernist:
    "Cities, architecture and design; bold, graphic photographs with strong lines; a brisk, reported voice with plenty of text.",
  nocturne:
    "Only trips that happen after dark or in low light — dusk, night markets, lamplit rooms, deep winter — or a quiet, literary, melancholy story. Never a sunny daylight trip.",
  zine: "Casual trips with friends, road trips, festivals, phone snapshots, and a chatty or funny voice.",
  custom:
    "Choose this when most photographs are portrait-shaped, when there are four or fewer photographs, or when one photograph is far stronger than the rest — the ready styles are built around landscape pictures and crop portraits badly. You pick a layout for each page from the page layouts below.",
};

/** Every style, "Your own" included: choosing it means the editor draws the pages itself. */
export function offeredThemes(): EditorTheme[] {
  return Object.values(THEMES).map(theme => ({
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
 * Faces a travel magazine would set a feature in. The typewriter is left out:
 * it is the zine's voice, and an editor reaching for it on a designed issue
 * produced pages that read as a draft rather than a magazine.
 */
const MAGAZINE_FACES: FaceId[] = FACE_IDS.filter(id => id !== "typewriter");

export const offeredFaces = (): EditorFace[] =>
  MAGAZINE_FACES.map(id => ({ id, name: FACES[id].name, body: FACES[id].body }));

export const offeredLayouts = (): EditorLayout[] =>
  ARCHETYPE_IDS.map(id => ({
    id,
    name: ARCHETYPES[id].name,
    description: ARCHETYPES[id].description,
    plates: ARCHETYPES[id].plates,
    quotes: ARCHETYPES[id].quotes ?? 0,
    minShare: ARCHETYPES[id].share.min,
    maxShare: ARCHETYPES[id].share.max,
  }));

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

/** The editor's body plan as single pages, from the first page of the body on. */
function planLeaves(pages: EditorDesign["pages"]): CustomLeaves {
  const slots = rhythm(pages.length);
  const leaves: CustomLeaves = {};
  pages.forEach((page, k) => {
    if (!isArchetype(page.layout)) return;
    leaves[BODY_START + k] = { slot: slots[k]!, page: buildPage(page.layout, page.share) };
  });
  return leaves;
}

/**
 * Builds the three pages from the layouts the editor chose. A layout this
 * build does not know (an older server, a model answering off-list) leaves
 * that page as the reader's starting design rather than a broken one.
 */
function settleDesign(chosen: EditorDesign): CustomDesign {
  const design = defaultDesign();
  for (const slot of CUSTOM_SLOTS) {
    const page = chosen[slot];
    if (page && isArchetype(page.layout)) design[slot] = buildPage(page.layout, page.share);
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

/** Sends the desk to the editor and returns its plan in desk terms. */
export async function askEditor(input: { title: string; story: string; photos: Photo[] }): Promise<EditorResult> {
  const labels = input.photos.map((_, index) => `p${index + 1}`);
  const previews = await Promise.all(input.photos.map(preview));

  const request: EditorRequest = {
    title: input.title,
    story: input.story,
    words: input.story.trim() ? input.story.trim().split(/\s+/).length : 0,
    rhythm: rhythm(),
    themes: offeredThemes(),
    faces: offeredFaces(),
    layouts: offeredLayouts(),
    photos: previews.map((shot, index) => ({
      id: labels[index]!,
      preview: shot.data,
      width: shot.width,
      height: shot.height,
    })),
  };

  const plan = await api.post<EditorPlan>("/api/editor", request);

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
      ? { ...settleDesign(plan.design!), palette: settlePalette(plan.palette), quotes: settleQuotes(plan.quotes, input.story) }
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
