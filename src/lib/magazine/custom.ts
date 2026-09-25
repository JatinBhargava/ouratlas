import { TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";

/**
 * Pages the reader draws themselves.
 *
 * Every other layout in the issue is a function: give it a plate size and it
 * returns the boxes. These are the other way round — the boxes are the input,
 * drawn on a canvas and carried with the page, and the composer pours copy
 * into whatever it is handed.
 *
 * Coordinates are in page pixels inside the text area, the same units the rest
 * of the magazine is measured in, so a box drawn 211 wide is measured 211 wide
 * and drawn 211 wide. Nothing is converted anywhere.
 */

/**
 * What a box holds. "quote" is a pull quote: a line lifted from the story and
 * set large in the display face, dealt to quote boxes in order the way
 * photographs are dealt to plates. It is not poured from the story, so the
 * fitter never measures it.
 */
export type CustomKind = "text" | "plate" | "sketch" | "quote";

/** The colour a quote is set on: a block of accent, a block of ink, or the page itself. */
export type QuoteTone = "accent" | "ink" | "paper";

export type CustomBox = {
  id: string;
  kind: CustomKind;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Quote boxes only. */
  tone?: QuoteTone;
  /**
   * Quote boxes only: a sign-off rather than a quotation — the issue's title
   * set on a block of colour where the story ends, with no quotation marks.
   */
  signOff?: boolean;
};

export type CustomPage = {
  boxes: CustomBox[];
  /**
   * A photograph run to the trim, edge to edge, with no margin and no folio —
   * the page's one plate fills the leaf and its quote, if it has one, is set
   * over the picture.
   */
  bleed?: boolean;
};

/** Paper, ink and accent for a designed issue, drawn from its photographs. */
export type Palette = { paper: string; ink: string; accent: string };

/** The three pages a reader designs. */
export type CustomSlot = "left" | "right" | "special";
export type CustomDesign = Record<CustomSlot, CustomPage> & {
  /**
   * The issue's colours. Carried on the design because they belong to it —
   * they came with the pages the editor drew — and because the design already
   * goes everywhere they need to: every composition, the undo, the sign-in
   * draft.
   */
  palette?: Palette;
  /** Pull quotes from the story, dealt to quote boxes in order. */
  quotes?: string[];
};

export const CUSTOM_SLOTS: CustomSlot[] = ["left", "right", "special"];

/**
 * Single pages the reader has redrawn on the proof, by page index.
 *
 * The three slots are the design every leaf is drawn from; a leaf here has
 * been changed on its own and keeps its own boxes, so moving a box on the
 * fifth left-hand page changes that page and no other. The slot is kept with
 * it because page numbers move — a longer story can put a right-hand page
 * where a left one was — and a left page's boxes must never be laid on a
 * right page. When the slot at that index no longer matches, the leaf is
 * ignored and the shared design stands.
 */
export type CustomLeaves = Record<
  number,
  {
    slot: CustomSlot;
    page: CustomPage;
    /**
     * Redrawn by the reader on the proof, as against planned by the editor.
     * A page drawn by hand is set exactly as drawn; a planned one may still be
     * made up to fit where the story ends.
     */
    hand?: boolean;
  }
>;

export const SLOT_LABEL: Record<CustomSlot, string> = {
  left: "Left page",
  right: "Right page",
  special: "Special page",
};

export const SLOT_NOTE: Record<CustomSlot, string> = {
  left: "Every verso — the left-hand leaf of a spread.",
  right: "Every recto, facing it.",
  special: "Opens the issue, then returns every sixth leaf.",
};

/**
 * The smallest a box may be pulled to.
 *
 * A text box below this cannot hold a line worth setting; the fitter would
 * measure it, find room for nothing, and hand back an empty slice that reads
 * on the page as a hole. A plate has no such floor in principle, but one
 * smaller than this is a stamp rather than a photograph.
 */
export const MIN_BOX: Record<CustomKind, { width: number; height: number }> = {
  text: { width: 90, height: 56 },
  plate: { width: 56, height: 48 },
  // Smaller than a plate may be: a signature wants a strip, not a square.
  sketch: { width: 70, height: 40 },
  // Room for a short line at the smallest size a quote is set.
  quote: { width: 120, height: 60 },
};

let counter = 0;
export const newBoxId = () => `box-${Date.now().toString(36)}-${(counter += 1)}`;

/** A box held inside the leaf, and no smaller than it is allowed to be. */
export function clampBox(box: CustomBox): CustomBox {
  const min = MIN_BOX[box.kind];
  const width = Math.min(TEXT_WIDTH, Math.max(min.width, Math.round(box.width)));
  const height = Math.min(TEXT_HEIGHT, Math.max(min.height, Math.round(box.height)));
  return {
    ...box,
    width,
    height,
    x: Math.min(TEXT_WIDTH - width, Math.max(0, Math.round(box.x))),
    y: Math.min(TEXT_HEIGHT - height, Math.max(0, Math.round(box.y))),
  };
}

/**
 * Boxes in the order they are read: down the page, then across.
 *
 * Copy is poured into text boxes in this order and photographs dealt into
 * plate boxes in the same one, so a reader who drags a box to the top of the
 * page has moved what is printed in it, not merely where it sits.
 *
 * The band is what makes two boxes side by side count as one row. Sorting on
 * `y` alone would order a pair whose tops differ by three pixels as though one
 * came a whole row before the other.
 */
const ROW_BAND = 28;

export function inReadingOrder(boxes: CustomBox[]): CustomBox[] {
  return [...boxes].sort((a, b) => (Math.abs(a.y - b.y) > ROW_BAND ? a.y - b.y : a.x - b.x));
}

export const textBoxes = (page: CustomPage) => inReadingOrder(page.boxes.filter(b => b.kind === "text"));
export const plateBoxes = (page: CustomPage) => inReadingOrder(page.boxes.filter(b => b.kind === "plate"));
/**
 * Boxes given over to the reader's own hand.
 *
 * Unlike the other two these are not filled by the composer — nothing is
 * poured into them and no photograph is dealt to them. Each simply holds
 * whatever was drawn on it, kept against the box's own id so a page may carry
 * several and each keep its own marks.
 */
export const sketchBoxes = (page: CustomPage) => inReadingOrder(page.boxes.filter(b => b.kind === "sketch"));
export const quoteBoxes = (page: CustomPage) => inReadingOrder(page.boxes.filter(b => b.kind === "quote"));

const box = (kind: CustomKind, x: number, y: number, width: number, height: number): CustomBox => ({
  id: newBoxId(),
  kind,
  x,
  y,
  width,
  height,
});

/**
 * Where a reader starts.
 *
 * Three pages that already work, rather than three empty leaves: a plate over
 * two columns, a column beside a plate, and a centred plate between two bands
 * of copy. Something to pull about beats something to begin.
 */
export function defaultDesign(): CustomDesign {
  return {
    left: {
      boxes: [
        box("plate", 0, 0, TEXT_WIDTH, 240),
        box("text", 0, 252, 211, 339),
        box("text", 229, 252, 211, 339),
      ],
    },
    right: {
      boxes: [
        box("text", 0, 0, 211, TEXT_HEIGHT),
        box("plate", 229, 0, 211, 300),
        box("text", 229, 312, 211, 279),
      ],
    },
    special: {
      boxes: [
        box("text", 0, 0, TEXT_WIDTH, 96),
        box("plate", 70, 108, 300, 330),
        box("text", 0, 450, TEXT_WIDTH, 141),
      ],
    },
  };
}

/** True once a design has something the composer can actually use. */
export const isUsable = (page: CustomPage) => page.boxes.length > 0;
