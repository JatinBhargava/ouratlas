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

export type CustomKind = "text" | "plate";

export type CustomBox = {
  id: string;
  kind: CustomKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CustomPage = { boxes: CustomBox[] };

/** The three pages a reader designs. */
export type CustomSlot = "left" | "right" | "special";
export type CustomDesign = Record<CustomSlot, CustomPage>;

export const CUSTOM_SLOTS: CustomSlot[] = ["left", "right", "special"];

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
