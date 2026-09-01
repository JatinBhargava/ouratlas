import { COLUMN_WIDTH, TEXT_HEIGHT } from "@/lib/magazine/geometry";

/** A text box on a page, in reading order. */
export type Box = { width: number; height: number };

export type Template = {
  id: TemplateId;
  /** How many photographs the layout wants. */
  plates: number;
  /** Boxes copy flows into, in reading order. */
  boxes: Box[];
};

export type TemplateId =
  | "cover"
  | "contents"
  | "opener"
  | "two-column"
  | "plate-above"
  | "plate-below"
  | "plate-beside"
  | "full-plate"
  | "paired-plates"
  | "blank"
  | "colophon";

/** Vertical space taken by the opener's headline block. Two lines of title. */
export const OPENER_HEAD = 118;
/** Plate depth on the opener, caption included. */
export const OPENER_PLATE = 236;
/** Plate depth on the half-page layouts, caption included. */
export const HALF_PLATE = 276;
/** Space between stacked elements on a page. */
export const STACK_GAP = 12;

const openerColumn = TEXT_HEIGHT - OPENER_HEAD - OPENER_PLATE - STACK_GAP * 2;
const halfColumn = TEXT_HEIGHT - HALF_PLATE - STACK_GAP;

const column = (height: number): Box => ({ width: COLUMN_WIDTH, height });
const pair = (height: number): Box[] => [column(height), column(height)];

/**
 * Every layout a page can take. The boxes here are what the fitter pours copy
 * into, so they have to match what the renderer actually draws — see
 * `components/magazine/pages.tsx`, which builds from the same constants.
 */
export const TEMPLATES: Record<TemplateId, Template> = {
  cover: { id: "cover", plates: 1, boxes: [] },
  contents: { id: "contents", plates: 0, boxes: [] },
  opener: { id: "opener", plates: 1, boxes: pair(openerColumn) },
  "two-column": { id: "two-column", plates: 0, boxes: pair(TEXT_HEIGHT) },
  "plate-above": { id: "plate-above", plates: 1, boxes: pair(halfColumn) },
  "plate-below": { id: "plate-below", plates: 1, boxes: pair(halfColumn) },
  "plate-beside": { id: "plate-beside", plates: 1, boxes: [column(TEXT_HEIGHT)] },
  "full-plate": { id: "full-plate", plates: 1, boxes: [] },
  "paired-plates": { id: "paired-plates", plates: 2, boxes: [] },
  // A leaf left empty so the colophon falls on a right-hand page.
  blank: { id: "blank", plates: 0, boxes: [] },
  // No boxes: the colophon is set copy, and any box here would swallow a
  // column of the story that the layout never draws.
  colophon: { id: "colophon", plates: 0, boxes: [] },
};

/**
 * The rhythm of the body of the issue. Copy runs through it in order and the
 * cycle repeats; layouts wanting plates are skipped once the photographs are
 * spent, so a long story with few pictures settles into plain columns rather
 * than printing the same photograph twice.
 */
export const BODY_CYCLE: TemplateId[] = [
  "plate-above",
  "two-column",
  "plate-beside",
  "two-column",
  "plate-below",
  "full-plate",
  "two-column",
  "paired-plates",
];
