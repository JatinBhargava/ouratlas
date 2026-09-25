import { COLUMN_WIDTH, GUTTER, TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";
import { newBoxId, type CustomBox, type CustomKind, type CustomPage, type QuoteTone } from "@/lib/magazine/custom";
import { STACK_GAP } from "@/lib/magazine/templates";

/**
 * Page layouts the editor builds a designed issue from.
 *
 * The editor used to draw its pages box by box, in pixels, and the results
 * read like it: a photograph centred with a strip of nothing either side,
 * columns stopping short of the foot, gaps that matched nothing else in the
 * issue. A model is a good art director and a poor paste-up hand. So it now
 * chooses, and these draw.
 *
 * Every layout here tiles the whole text area on the magazine's own grid —
 * two columns and the gutter between them, the same stack gap the house
 * layouts use — so a page built from one has no stray white space, straight
 * edges, and margins that agree with every other page in the issue. The one
 * thing the editor sets is `share`: how much of the page's depth the
 * photograph takes, held inside a range that keeps the text around it worth
 * reading.
 */

export type ArchetypeId =
  | "hero-top"
  | "hero-bottom"
  | "plate-right"
  | "plate-left"
  | "band-middle"
  | "pair-top"
  | "checkerboard"
  | "picture-page"
  | "staggered"
  | "strip"
  | "bleed"
  | "quote-hero"
  | "quote-column"
  | "quote-split";

export type Archetype = {
  name: string;
  /** For the editor: what the page looks like and what it is for. */
  description: string;
  /** Photographs the page takes. */
  plates: number;
  /** Pull quotes the page takes. */
  quotes?: number;
  /** Runs its photograph to the trim, with no margin and no folio. */
  bleed?: boolean;
  /** The photograph's share of the page's depth, lowest to highest. */
  share: { min: number; max: number };
  build: (share: number) => CustomBox[];
};

const W = TEXT_WIDTH;
const H = TEXT_HEIGHT;
const C = COLUMN_WIDTH;
const G = GUTTER;
const S = STACK_GAP;
/** The right-hand column's left edge. */
const R = C + G;

const box = (kind: CustomKind, x: number, y: number, width: number, height: number, tone?: QuoteTone): CustomBox => ({
  id: newBoxId(),
  kind,
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
  ...(tone ? { tone } : {}),
});

/** Depth of a quote band across the page: two lines of display type and its air. */
const QUOTE_BAND = 104;

/** The photograph's depth for a share of the page. */
const depth = (share: number) => Math.round(H * share);

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  "hero-top": {
    name: "Hero above",
    description:
      "A photograph across the full width at the head of the page, two columns of text beneath. The classic opener; best for a strong landscape photograph.",
    plates: 1,
    share: { min: 0.35, max: 0.66 },
    build: share => {
      const h = depth(share);
      return [box("plate", 0, 0, W, h), box("text", 0, h + S, C, H - h - S), box("text", R, h + S, C, H - h - S)];
    },
  },
  "hero-bottom": {
    name: "Hero below",
    description:
      "Two columns of text, then a photograph across the full width at the foot. The page lands on the picture; good for a closing view or a wide landscape.",
    plates: 1,
    share: { min: 0.3, max: 0.6 },
    build: share => {
      const h = depth(share);
      return [box("text", 0, 0, C, H - h - S), box("text", R, 0, C, H - h - S), box("plate", 0, H - h, W, h)];
    },
  },
  "plate-right": {
    name: "Photograph in the right column",
    description:
      "A full column of text on the left; on the right a tall photograph with text continuing beneath it. For portrait photographs; a high share makes a tall, narrow picture.",
    plates: 1,
    share: { min: 0.4, max: 0.72 },
    build: share => {
      const h = depth(share);
      return [box("text", 0, 0, C, H), box("plate", R, 0, C, h), box("text", R, h + S, C, H - h - S)];
    },
  },
  "plate-left": {
    name: "Photograph in the left column",
    description:
      "The mirror of the right-column page: a tall photograph at the head of the left column with text beneath, a full column of text on the right. For portrait photographs.",
    plates: 1,
    share: { min: 0.4, max: 0.72 },
    build: share => {
      const h = depth(share);
      return [box("plate", 0, 0, C, h), box("text", 0, h + S, C, H - h - S), box("text", R, 0, C, H)];
    },
  },
  "band-middle": {
    name: "Band across the middle",
    description:
      "Two columns of text above and below a photograph that runs across the full width through the middle of the page. For panoramas and wide street scenes; keep the share low so the band stays a band.",
    plates: 1,
    // Above 0.38 the text over the band falls under three inches of copy and
    // reads as a caption.
    share: { min: 0.25, max: 0.38 },
    build: share => {
      const h = depth(share);
      const above = Math.round((H - h - 2 * S) * 0.42);
      const below = H - h - 2 * S - above;
      const y = above + S;
      return [
        box("text", 0, 0, C, above),
        box("text", R, 0, C, above),
        box("plate", 0, y, W, h),
        box("text", 0, y + h + S, C, below),
        box("text", R, y + h + S, C, below),
      ];
    },
  },
  "pair-top": {
    name: "Pair above",
    description:
      "Two photographs side by side at the head of the page, one per column, two columns of text beneath. For two related portrait or square photographs — two people, two details of one place.",
    plates: 2,
    share: { min: 0.35, max: 0.6 },
    build: share => {
      const h = depth(share);
      return [
        box("plate", 0, 0, C, h),
        box("plate", R, 0, C, h),
        box("text", 0, h + S, C, H - h - S),
        box("text", R, h + S, C, H - h - S),
      ];
    },
  },
  "checkerboard": {
    name: "Checkerboard",
    description:
      "Four equal quarters: a photograph and text on top, text and a photograph beneath, crossing corner to corner. Lively; for two portrait photographs that contrast. Share is fixed.",
    plates: 2,
    share: { min: 0.5, max: 0.5 },
    build: () => {
      const top = Math.round((H - S) / 2);
      const bottom = H - S - top;
      return [
        box("plate", 0, 0, C, top),
        box("text", R, 0, C, top),
        box("text", 0, top + S, C, bottom),
        box("plate", R, top + S, C, bottom),
      ];
    },
  },
  "picture-page": {
    name: "Picture page",
    description:
      "The photograph takes most of the page, with a short band of two columns beneath it. A breather between reading pages; for the most striking landscape or a big moment.",
    plates: 1,
    // Above 0.76 the band beneath falls under ten lines a column.
    share: { min: 0.68, max: 0.76 },
    build: share => {
      const h = depth(share);
      return [box("plate", 0, 0, W, h), box("text", 0, h + S, C, H - h - S), box("text", R, h + S, C, H - h - S)];
    },
  },
  "staggered": {
    name: "Staggered pair",
    description:
      "Two photographs set on a diagonal: one at the head of the left column, one at the foot of the right, with text filling the other ends. A lively page for two portrait photographs of one place or one day.",
    plates: 2,
    share: { min: 0.35, max: 0.55 },
    build: share => {
      const h = depth(share);
      return [
        box("plate", 0, 0, C, h),
        box("text", R, 0, C, H - h - S),
        box("text", 0, h + S, C, H - h - S),
        box("plate", R, H - h, C, h),
      ];
    },
  },
  "strip": {
    name: "Contact strip",
    description:
      "Three small photographs stacked down the left column like a contact sheet, a full column of text beside them. For three details — food, signs, faces, textures. Share is fixed.",
    plates: 3,
    share: { min: 1, max: 1 },
    build: () => {
      const cell = Math.floor((H - 2 * S) / 3);
      const last = H - 2 * S - 2 * cell;
      return [
        box("plate", 0, 0, C, cell),
        box("plate", 0, cell + S, C, cell),
        box("plate", 0, 2 * (cell + S), C, last),
        box("text", R, 0, C, H),
      ];
    },
  },
  "bleed": {
    name: "Full bleed",
    description:
      "One photograph run edge to edge to the trim — no margins, no page number — with a pull quote set over the foot of the picture. The page people stop on; for the single most striking image, and never two in a row. Share is fixed.",
    plates: 1,
    quotes: 1,
    bleed: true,
    share: { min: 1, max: 1 },
    // The box stands for the whole leaf; the page draws it to the trim.
    build: () => [box("plate", 0, 0, W, H)],
  },
  "quote-hero": {
    name: "Hero with quote band",
    description:
      "A photograph across the full width, then a band of accent colour carrying a pull quote, then two columns of text. Bold and graphic; for a strong landscape and a line worth shouting.",
    plates: 1,
    quotes: 1,
    share: { min: 0.3, max: 0.48 },
    build: share => {
      const h = depth(share);
      const y = h + S + QUOTE_BAND + S;
      return [
        box("plate", 0, 0, W, h),
        box("quote", 0, h + S, W, QUOTE_BAND, "accent"),
        box("text", 0, y, C, H - y),
        box("text", R, y, C, H - y),
      ];
    },
  },
  "quote-split": {
    name: "Quote across the columns",
    description:
      "No photograph: two columns of text broken by a band of accent colour carrying a pull quote across the full width. For a long stretch of writing between pictures, so it never reads as plain grey columns.",
    plates: 0,
    quotes: 1,
    share: { min: 1, max: 1 },
    build: () => quoteSplit(),
  },
  "quote-column": {
    name: "Column with quote block",
    description:
      "A full column of text on the left; on the right a block of ink carrying a pull quote, with a portrait photograph beneath it. Magazine-feature energy; for a portrait and a memorable line.",
    plates: 1,
    quotes: 1,
    share: { min: 0.42, max: 0.62 },
    build: share => {
      const h = depth(share);
      return [box("text", 0, 0, C, H), box("quote", R, 0, C, H - h - S, "ink"), box("plate", R, H - h, C, h)];
    },
  },
};

/** A page of reading: two full columns, for a designed issue that has run out of photographs. */
export const textPage = (): CustomBox[] => [box("text", 0, 0, C, H), box("text", R, 0, C, H)];

/**
 * A page of reading broken by a pull quote: two columns above and below a band
 * of accent colour across the full width. What a designed issue sets once its
 * photographs are spent and it still has lines worth lifting, so that the
 * back half does not fall into plain grey columns.
 */
export const quoteSplit = (): CustomBox[] => {
  const above = Math.round((H - QUOTE_BAND - 2 * S) * 0.45);
  const below = H - QUOTE_BAND - 2 * S - above;
  const y = above + S + QUOTE_BAND + S;
  return [
    box("text", 0, 0, C, above),
    box("text", R, 0, C, above),
    box("quote", 0, above + S, W, QUOTE_BAND, "accent"),
    box("text", 0, y, C, below),
    box("text", R, y, C, below),
  ];
};

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

export const isArchetype = (id: string): id is ArchetypeId => id in ARCHETYPES;

/** Builds a page's boxes from a layout and a share, holding the share inside the layout's range. */
export function buildArchetype(id: ArchetypeId, share: number): CustomBox[] {
  const { share: range, build } = ARCHETYPES[id];
  const held = Number.isFinite(share) ? Math.min(range.max, Math.max(range.min, share)) : (range.min + range.max) / 2;
  return build(held);
}

/** The whole page: its boxes, and whether it runs to the trim. */
export function buildPage(id: ArchetypeId, share: number): CustomPage {
  return { boxes: buildArchetype(id, share), ...(ARCHETYPES[id].bleed ? { bleed: true } : {}) };
}
