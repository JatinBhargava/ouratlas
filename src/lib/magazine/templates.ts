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
  | "zine-collage"
  | "zine-rows"
  | "four-column"
  | "ornament-feature"
  | "quad-text"
  | "centred-article"
  | "custom-left"
  | "custom-right"
  | "custom-special"
  | "canvas"
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

/**
 * The zine collage: a column of copy, and beside it two photographs pinned up
 * at angles, overlapping.
 *
 * The plates are placed rather than laid out — that is the register — so their
 * positions are listed here, in page pixels within the collage column, rather
 * than derived from the grid. The copy beside them stays a plain rectangle:
 * the fitter measures real type and cannot pour it into a shape.
 */
/**
 * The four-column page: a black band bleeding off the head of the leaf with
 * the headline reversed out of it, then the plate, then the copy in four
 * narrow measures.
 *
 * The band is given as a depth inside the text area; it is drawn taller than
 * this, because it runs up through the head margin to the trim. Nothing is
 * measured against the part that bleeds, so the two numbers never have to
 * agree on anything but where the band stops.
 *
 * Four columns is the whole character of the page. At this measure the type
 * has to come down with it — see the theme's body overrides — and the result
 * is a page that is mostly texture with one very loud thing on it.
 */
export const BAND_HEAD = 132;
export const BAND_PLATE_DEPTH = 150;
export const COLUMN_QUARTER = (TEXT_WIDTH - GUTTER * 3) / 4;

/**
 * The ornamented feature: a rule of ornament across the head, a centred
 * headline block under it, the plate, the copy, and the same ornament along
 * the foot.
 *
 * The two rules are what close the page. Everything between them is centred
 * on the measure rather than ranged left, which is the older way of setting an
 * opening page and reads as deliberate the moment it sits beside a squared-off
 * one.
 */
/**
 * The centred article: one narrow measure standing in the middle of the leaf
 * with air either side, under a centred kicker and a rule.
 *
 * A text page that is unmistakably a *page* rather than the continuation of
 * one. The measure is deliberately narrower than a column pair — the point is
 * the air around it, and a centred measure that reaches for the margins is
 * just a wide column.
 *
 * The column is centred; the type inside it is not. Whole pages of
 * centre-aligned body copy are a thing print does for eight lines of an
 * editorial and never for a page of an article, so the alignment stays
 * whatever the theme sets.
 */
export const CENTRED_WIDTH = 300;
export const CENTRED_HEAD = 64;

export const ORNAMENT = 14;
export const ORNAMENT_HEAD = 150;
export const ORNAMENT_PLATE = 200;

/**
 * The zine rows: three bands down the leaf, each a narrow column of text
 * against a wide photograph — and the two changing places row by row. Text
 * left, then text right, then text left again.
 *
 * The proportions hold while the sides swap, so the wide cell crosses the page
 * on every band. That crossing is the page: three rows built the same way
 * round would stack, where these interlock.
 */
export const ZINE_ROW = (TEXT_HEIGHT - STACK_GAP * 2) / 3;
export const ZINE_NARROW = (TEXT_WIDTH - GUTTER) / 3;
export const ZINE_WIDE = TEXT_WIDTH - GUTTER - ZINE_NARROW;

/** Which side the text takes, band by band. The photograph takes the other. */
export const ZINE_TEXT_LEFT = [true, false, true] as const;

export const ZINE_PLATES = [
  { top: 26, left: 2, width: 196, height: 232, tilt: -3.2 },
  { top: 232, left: 24, width: 182, height: 220, tilt: 3.6 },
] as const;

const openerColumn = TEXT_HEIGHT - OPENER_HEAD - OPENER_PLATE - STACK_GAP * 2;
const halfColumn = TEXT_HEIGHT - HALF_PLATE - STACK_GAP;
const bandBelow = TEXT_HEIGHT - BAND_ABOVE - BAND_PLATE - STACK_GAP * 2;

const column = (height: number): Box => ({ width: COLUMN_WIDTH, height });
const pair = (height: number): Box[] => [column(height), column(height)];
const quarter = (height: number): Box => ({ width: COLUMN_QUARTER, height });
const quad = (height: number): Box[] => [quarter(height), quarter(height), quarter(height), quarter(height)];

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
  // One box, and it does not move: the plate shares the row rather than
  // sitting above or below the copy, so its depth costs the copy nothing.
  // The collage column is not a text box, so the copy takes the other half of
  // the measure and the whole leaf, exactly as a beside plate does.
  "zine-collage": { id: "zine-collage", plates: 2, boxes: [column(TEXT_HEIGHT)] },
  "zine-rows": {
    id: "zine-rows",
    plates: 3,
    // The text column keeps its measure whichever side it lands on, so the
    // fitter pours the same shape into all three.
    boxes: ZINE_TEXT_LEFT.map(() => ({ width: ZINE_NARROW, height: ZINE_ROW })),
  },
  // Text pages. No plate, so a theme can put one in its `plain` rotation and
  // get a page of pure reading between the illustrated ones.
  "quad-text": { id: "quad-text", plates: 0, boxes: quad(TEXT_HEIGHT) },
  // The reader's own pages. Empty here on purpose: their shape is not a
  // property of the layout but of the design the reader drew, which travels
  // with the page. The composer reads it off that and never off this.
  "custom-left": { id: "custom-left", plates: 0, boxes: [] },
  "custom-right": { id: "custom-right", plates: 0, boxes: [] },
  "custom-special": { id: "custom-special", plates: 0, boxes: [] },
  "centred-article": {
    id: "centred-article",
    plates: 0,
    boxes: [{ width: CENTRED_WIDTH, height: TEXT_HEIGHT - CENTRED_HEAD - STACK_GAP }],
  },
  "ornament-feature": {
    id: "ornament-feature",
    plates: 1,
    boxes: pair(
      TEXT_HEIGHT - ORNAMENT * 2 - ORNAMENT_HEAD - ORNAMENT_PLATE - STACK_GAP * 4,
    ),
  },
  "four-column": {
    id: "four-column",
    plates: 1,
    boxes: quad(TEXT_HEIGHT - BAND_HEAD - BAND_PLATE_DEPTH - STACK_GAP * 2),
  },
  "full-plate": { id: "full-plate", plates: 1, boxes: [] },
  "paired-plates": { id: "paired-plates", plates: 2, boxes: [] },
  // The leaf kept blank for the reader's own hand. No boxes and no plates:
  // whatever ends up here was drawn, not composed.
  canvas: { id: "canvas", plates: 0, boxes: [] },
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
 * A plate stacked above or below the copy can give depth, which the copy takes
 * back, and width, which nothing takes back — narrowing it opens the margin
 * beside the picture and re-flows nothing, because the copy was never level
 * with it. Both are real decisions and both are offered. A plate set beside a
 * column has both too — pulled wider it takes room from the column beside it, and
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
/**
 * The width a full-measure plate may be pulled back to.
 *
 * Shared by every layout whose plate sits above or below its copy rather than
 * beside it. Narrower than this and the picture stops being a plate and starts
 * being a thumbnail with a page around it.
 */
const MEASURE_WIDTH = { default: TEXT_WIDTH, min: 170, max: TEXT_WIDTH } as const;

export const PLATE_SIZING = {
  opener: { width: MEASURE_WIDTH, height: { default: OPENER_PLATE, min: 150, max: 320 } },
  "plate-above": { width: MEASURE_WIDTH, height: { default: HALF_PLATE, min: 150, max: 420 } },
  "plate-below": { width: MEASURE_WIDTH, height: { default: HALF_PLATE, min: 150, max: 420 } },
  "plate-band": { width: MEASURE_WIDTH, height: { default: BAND_PLATE, min: 110, max: 300 } },
  // The two ornament rules and the headline between them are the layout; only
  // the plate below them trades against the copy.
  "ornament-feature": { width: MEASURE_WIDTH, height: { default: ORNAMENT_PLATE, min: 110, max: 300 } },
  // The band above is fixed — it is the theme's signature and not a thing to
  // be pulled about — so the plate trades only against the columns below it.
  "four-column": { width: MEASURE_WIDTH, height: { default: BAND_PLATE_DEPTH, min: 90, max: 300 } },
  // These two are the layouts that genuinely trade: pulled wider the plate
  // takes room from the column beside it, pulled shorter it opens a
  // two-column foot underneath. Both ranges run all the way, and the snap in
  // `clampPlate` is what carries the last of a drag to the edge.
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
    case "ornament-feature":
      return pair(TEXT_HEIGHT - ORNAMENT * 2 - ORNAMENT_HEAD - plate.height - STACK_GAP * 4);
    case "four-column":
      return quad(TEXT_HEIGHT - BAND_HEAD - plate.height - STACK_GAP * 2);
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

/** What a page takes when there is no photograph due. */
export const PLAIN: TemplateId = "two-column";
