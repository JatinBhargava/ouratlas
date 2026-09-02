import { COLUMN_WIDTH, GUTTER, TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";

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
  | "plate-beside-right"
  | "plate-band"
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

/**
 * The band layout: a wide, shallow plate with copy above and below it.
 *
 * The two runs of copy are deliberately unequal — a band sitting on the
 * halfway line reads as a page cut in two, where one set low reads as a page
 * with a picture in it.
 */
export const BAND_PLATE = 176;
export const BAND_ABOVE = 180;

const openerColumn = TEXT_HEIGHT - OPENER_HEAD - OPENER_PLATE - STACK_GAP * 2;
const halfColumn = TEXT_HEIGHT - HALF_PLATE - STACK_GAP;
const bandBelow = TEXT_HEIGHT - BAND_ABOVE - BAND_PLATE - STACK_GAP * 2;

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
  // The same layout turned round. Alternating the side a plate sits on is
  // what stops a run of illustrated pages reading as one repeated page.
  "plate-beside-right": { id: "plate-beside-right", plates: 1, boxes: [column(TEXT_HEIGHT)] },
  "plate-band": { id: "plate-band", plates: 1, boxes: [...pair(BAND_ABOVE), ...pair(bandBelow)] },
  "full-plate": { id: "full-plate", plates: 1, boxes: [] },
  "paired-plates": { id: "paired-plates", plates: 2, boxes: [] },
  // A leaf left empty so the colophon falls on a right-hand page.
  blank: { id: "blank", plates: 0, boxes: [] },
  // No boxes: the colophon is set copy, and any box here would swallow a
  // column of the story that the layout never draws.
  colophon: { id: "colophon", plates: 0, boxes: [] },
};

/**
 * Smallest run of copy worth setting under a plate.
 *
 * Below this a beside plate simply takes the whole height of the leaf: two
 * columns three lines deep read as a mistake, not as a layout.
 */
const BESIDE_FOOT = 96;

/** Depth of the two-column foot under a beside plate, or 0 when it has none. */
export function besideFoot(height: number): number {
  const left = TEXT_HEIGHT - height - STACK_GAP;
  return left >= BESIDE_FOOT ? left : 0;
}

/**
 * Narrowest column worth setting beside a plate. Below this the plate takes
 * the whole measure instead and the copy goes under it, or on to the next page.
 */
const BESIDE_COLUMN = 140;

/** Width of the column beside a plate, or 0 when the plate takes the measure. */
export function besideColumn(width: number): number {
  const left = TEXT_WIDTH - width - GUTTER;
  return left >= BESIDE_COLUMN ? left : 0;
}

type Range = { default: number; min: number; max: number };

/**
 * Layouts whose plate can be resized, along which axes, and how far.
 *
 * Every layout where a plate shares the page with copy is here: resizing one
 * moves the boundary between picture and text, which is a real editorial
 * decision. Which axes are free depends on how the layout is built.
 *
 * A plate stacked above or below the copy has only its depth to give: it is
 * already the full measure wide, and the grid fixes that. A plate set beside a
 * column has both — pulled wider it takes room from the column beside it, and
 * pulled shorter it opens a two-column foot underneath. That second axis is
 * what a portrait photograph needs, since width alone cannot make a tall
 * picture sit differently on the page.
 *
 * Either axis runs all the way: a beside plate can be given the whole measure,
 * or the whole leaf, and the copy that had been sitting there simply goes on
 * to the next page. Nothing is lost by making a picture big — the issue grows
 * a leaf instead.
 *
 * Only `cover`, `full-plate` and `paired-plates` are absent, and there is
 * nothing to resize on those: they run to the trim with no copy to give room
 * to or take it from.
 *
 * The bounds keep both sides of every boundary usable: at the limit the copy
 * that remains is still several lines, and a column still wide enough to set.
 */
export const PLATE_SIZING = {
  opener: { height: { default: OPENER_PLATE, min: 150, max: 320 } },
  "plate-above": { height: { default: HALF_PLATE, min: 150, max: 420 } },
  "plate-below": { height: { default: HALF_PLATE, min: 150, max: 420 } },
  "plate-band": { height: { default: BAND_PLATE, min: 110, max: 300 } },
  "plate-beside": {
    width: { default: COLUMN_WIDTH, min: 140, max: TEXT_WIDTH },
    height: { default: TEXT_HEIGHT, min: 240, max: TEXT_HEIGHT },
  },
  "plate-beside-right": {
    width: { default: COLUMN_WIDTH, min: 140, max: TEXT_WIDTH },
    height: { default: TEXT_HEIGHT, min: 240, max: TEXT_HEIGHT },
  },
} as const satisfies Partial<Record<TemplateId, { width?: Range; height?: Range }>>;

export type ResizableId = keyof typeof PLATE_SIZING;
export type Axis = "width" | "height";

/** The size of a page's plate, on both axes. */
export type PlateBox = { width: number; height: number };

export function isResizable(id: TemplateId): id is ResizableId {
  return id in PLATE_SIZING;
}

function rangeOf(id: TemplateId, axis: Axis): Range | null {
  const sizing = PLATE_SIZING[id as ResizableId] as { width?: Range; height?: Range } | undefined;
  return sizing?.[axis] ?? null;
}

/** Which axes of a layout's plate can actually be moved. */
export function plateAxes(id: TemplateId): Axis[] {
  return (["width", "height"] as Axis[]).filter(axis => rangeOf(id, axis) !== null);
}

/**
 * A requested size held inside what the layout can take.
 *
 * A beside plate snaps outwards once the copy left alongside or under it would
 * be too small to set — to the full measure on width, to the full leaf on
 * depth — so the drawn plate and the fitted boxes always agree on which boxes
 * exist at all. The snap is what makes the last part of a drag reach the edge
 * rather than stop short of it.
 */
export function clampPlate(id: TemplateId, axis: Axis, value: number): number {
  const range = rangeOf(id, axis);
  if (!range) return value;

  const held = Math.min(range.max, Math.max(range.min, Math.round(value)));
  if (id !== "plate-beside" && id !== "plate-beside-right") return held;

  if (axis === "width") return besideColumn(held) === 0 ? TEXT_WIDTH : held;
  return besideFoot(held) === 0 ? TEXT_HEIGHT : held;
}

/** The size a page's plate is drawn at: what was asked for, or the default. */
export function plateSize(id: TemplateId, asked?: Partial<PlateBox>): PlateBox {
  if (!isResizable(id)) return { width: 0, height: 0 };

  const on = (axis: Axis, whole: number) => {
    const range = rangeOf(id, axis);
    if (!range) return whole;
    return asked?.[axis] === undefined ? range.default : clampPlate(id, axis, asked[axis]!);
  };

  return { width: on("width", TEXT_WIDTH), height: on("height", TEXT_HEIGHT) };
}

/**
 * The text boxes a layout has once its plate is set to a given size.
 *
 * This is the single place the arithmetic lives. The composer fits against
 * what comes back and the renderer draws from the same numbers, so a resized
 * page cannot end up measured one way and drawn another.
 */
export function boxesFor(id: TemplateId, plate: PlateBox): Box[] {
  switch (id) {
    case "opener":
      return pair(TEXT_HEIGHT - OPENER_HEAD - plate.height - STACK_GAP * 2);
    case "plate-above":
    case "plate-below":
      return pair(TEXT_HEIGHT - plate.height - STACK_GAP);
    case "plate-band":
      return [...pair(BAND_ABOVE), ...pair(TEXT_HEIGHT - BAND_ABOVE - plate.height - STACK_GAP * 2)];
    // The copy runs down the side of the plate, and then across two columns
    // beneath it — each of those only if the plate has been left room for it.
    // A plate given both the measure and the leaf has no boxes at all, and the
    // page carries the photograph alone.
    case "plate-beside":
    case "plate-beside-right": {
      const column = besideColumn(plate.width);
      const foot = besideFoot(plate.height);
      return [
        ...(column > 0 ? [{ width: column, height: plate.height }] : []),
        ...(foot > 0 ? pair(foot) : []),
      ];
    }
    default:
      return TEMPLATES[id].boxes;
  }
}

/**
 * The illustrated layouts, in the order they are used.
 *
 * Every one of these carries copy *and* a plate, which is the point: the
 * composer decides whether a page is due a photograph and then takes the next
 * layout from here, so a page that gets a picture never has to give up its
 * text to have one. `two-column` is what a page falls back to, not part of
 * the rhythm.
 *
 * The order alternates where the eye lands — top, left, middle, right, bottom
 * — so consecutive illustrated pages do not read as the same page twice.
 */
export const PLATE_CYCLE: TemplateId[] = [
  "plate-above",
  "plate-beside",
  "plate-band",
  "plate-beside-right",
  "plate-below",
];

/** What a page takes when there is no photograph due. */
export const PLAIN: TemplateId = "two-column";
