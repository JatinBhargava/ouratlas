import { PAGE } from "@/lib/magazine/geometry";
import type { PosterFontId } from "@/types";

/**
 * The poster studio's document: pages the reader lays out by hand, box by box.
 *
 * Unlike the magazine, nothing here is poured or measured. Every box sits
 * exactly where it was put, in page pixels on the magazine's own sheet (520 ×
 * 693), so a PDF of a poster is the same size as a PDF of an issue and the
 * print stylesheet's `@page` fits both.
 *
 * The document holds no photographs, only ids into the page's photo store:
 * the files themselves are object URLs that never leave the browser, and a
 * document that carried them could not be copied for undo without copying
 * every image with it.
 */

export const SHEET = PAGE;

/** The smallest a box may be made, so a stray drag cannot lose one to a dot. */
export const MIN_SIZE = 12;

export type Align = "left" | "center" | "right" | "justify";
export type VAlign = "top" | "middle" | "bottom";
export type Fit = "cover" | "contain";
export type Filter = "none" | "mono" | "sepia" | "warm" | "cool" | "fade" | "punch";
export type ShapeKind = "rect" | "ellipse";

type Frame = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, about the centre. */
  rotation: number;
  /** 0 to 1. */
  opacity: number;
  /** A locked box cannot be dragged or resized on the page, only edited from the panel. */
  locked?: boolean;
};

export type TextBox = Frame & {
  kind: "text";
  text: string;
  font: FontId;
  /** Page pixels. */
  size: number;
  weight: 400 | 700 | 900;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  /** Em. */
  tracking: number;
  /** A multiple of the size. */
  leading: number;
  align: Align;
  valign: VAlign;
  color: string;
  /** Behind the text; `transparent` for none. */
  fill: string;
  /** Page pixels inside the box, all four sides. */
  padding: number;
  shadow: boolean;
  /** Set in columns, as a Studio layout's long text often is; absent or 1 is one column. */
  columns?: number;
  /** Page pixels between columns. */
  gap?: number;
  /**
   * Marks the page number a Studio layout prints at its head or foot. The
   * words either side are kept and the number is set to where the page now
   * sits in the issue (`renumber`). Typing over it takes the mark off: the
   * reader has made the line their own.
   */
  folio?: Folio;
};

/** A page number's words either side of the number, and how many digits it is padded to ("04"). */
export type Folio = { before: string; after: string; pad: number };

export type PhotoBox = Frame & {
  kind: "photo";
  /** Into the photo store; null is an empty frame waiting for a picture. */
  photo: string | null;
  fit: Fit;
  /** 1 fills the box; above it crops closer. */
  zoom: number;
  /** Where the crop is centred, 0–100 on each axis. */
  focusX: number;
  focusY: number;
  /** Page pixels; half the shorter side makes a circle. */
  radius: number;
  /** Round the top corners only, square the bottom: a window arch. */
  arch?: boolean;
  borderWidth: number;
  borderColor: string;
  filter: Filter;
  flip: boolean;
};

export type ShapeBox = Frame & {
  kind: "shape";
  shape: ShapeKind;
  fill: string;
  radius: number;
  borderWidth: number;
  borderColor: string;
};

export type Box = TextBox | PhotoBox | ShapeBox;
export type BoxKind = Box["kind"];

export type PosterPage = {
  id: string;
  background: string;
  boxes: Box[];
  /** The Atlas Studio layout the page was started from, so the page after it can be that layout's next page. */
  studio?: StudioOrigin;
};

/** A Studio section (one of its themes or shelves) and a page in it, by id. */
export type StudioOrigin = { section: string; page: string };

export type PosterDoc = { pages: PosterPage[] };

/** A picture the reader brought, kept in memory by the page and never sent anywhere. */
export type Photo = { id: string; url: string; width: number; height: number; name: string; file: File };

let counter = 0;
/** Short, unique within a session, and never derived from anything the reader wrote or chose. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Typefaces the studio offers.
 *
 * Stacks of what the machine already has, the same rule the magazine keeps,
 * with a fallback for macOS, Windows and Linux in turn. A poster is drawn to
 * a PDF on the machine that set it, so what the reader sees is what they get;
 * the magazine's stricter reason — text measured on one face and drawn in
 * another — does not arise, because nothing here is measured. That is what
 * lets this list be longer than the desk's.
 */
export const FONTS = {
  editorial: { name: "Instrument Serif", stack: "var(--font-editorial), ui-serif, Georgia, serif" },
  georgia: { name: "Georgia", stack: 'Georgia, ui-serif, "Times New Roman", serif' },
  times: { name: "Times", stack: '"Times New Roman", Times, ui-serif, serif' },
  garamond: { name: "Garamond", stack: 'Garamond, "Apple Garamond", "EB Garamond", Baskerville, Georgia, serif' },
  baskerville: { name: "Baskerville", stack: 'Baskerville, "Baskerville Old Face", "Libre Baskerville", Georgia, serif' },
  palatino: { name: "Palatino", stack: '"Palatino Linotype", Palatino, "Book Antiqua", "URW Palladio L", serif' },
  didot: { name: "Didot", stack: 'Didot, "Bodoni 72", "Bodoni MT", "Noto Serif Display", Georgia, serif' },
  helvetica: { name: "Helvetica", stack: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif' },
  system: { name: "System sans", stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' },
  avenir: { name: "Avenir", stack: '"Avenir Next", Avenir, "Segoe UI", "Nunito Sans", sans-serif' },
  futura: { name: "Futura", stack: 'Futura, "Century Gothic", "Avenir Next", "URW Gothic", sans-serif' },
  gill: { name: "Gill Sans", stack: '"Gill Sans", "Gill Sans MT", Calibri, "Linux Biolinum", sans-serif' },
  trebuchet: { name: "Trebuchet", stack: '"Trebuchet MS", "Lucida Grande", "DejaVu Sans", sans-serif' },
  verdana: { name: "Verdana", stack: 'Verdana, Geneva, "DejaVu Sans", sans-serif' },
  impact: { name: "Impact", stack: 'Haettenschweiler, Impact, "Arial Narrow Bold", "Liberation Sans Narrow", sans-serif' },
  rockwell: { name: "Rockwell", stack: 'Rockwell, "Rockwell Nova", "Roboto Slab", "Courier New", serif' },
  copperplate: { name: "Copperplate", stack: 'Copperplate, "Copperplate Gothic Light", "Engravers MT", serif' },
  courier: { name: "Typewriter", stack: '"Courier New", Courier, ui-monospace, "DejaVu Sans Mono", monospace' },
  mono: { name: "Mono", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace' },
  script: { name: "Script", stack: '"Snell Roundhand", "Brush Script MT", "Segoe Script", "URW Chancery L", cursive' },
  marker: { name: "Marker", stack: '"Marker Felt", "Segoe Print", "Comic Sans MS", "Comic Neue", cursive' },
  // Both used by Atlas Studio's layouts, so a page started from one keeps its face.
  narrow: { name: "Narrow", stack: '"Arial Narrow", "Helvetica Neue Condensed", "Roboto Condensed", "Liberation Sans Narrow", sans-serif' },
  hand: { name: "Handwriting", stack: '"Bradley Hand", "Segoe Print", "Comic Neue", cursive' },
  // Checked against the ids the API accepts for a submitted layout, so the two lists cannot drift.
} as const satisfies Record<PosterFontId, { name: string; stack: string }>;

export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as FontId[];

/** CSS for a photo filter preset. Kept to what `filter` can do, so the PDF draws it exactly as the page does. */
export const FILTERS: Record<Filter, { name: string; css: string }> = {
  none: { name: "Original", css: "none" },
  mono: { name: "Black & white", css: "grayscale(1) contrast(1.08)" },
  sepia: { name: "Sepia", css: "sepia(0.6) contrast(1.02)" },
  warm: { name: "Warm", css: "sepia(0.18) saturate(1.2) brightness(1.03)" },
  cool: { name: "Cool", css: "saturate(0.9) hue-rotate(-12deg) brightness(1.02)" },
  fade: { name: "Faded", css: "contrast(0.85) brightness(1.08) saturate(0.8)" },
  punch: { name: "Punchy", css: "contrast(1.2) saturate(1.3)" },
};

/** Colours offered as swatches beside every picker: paper, ink, and the accents the templates use. */
export const SWATCHES = [
  "#ffffff",
  "#f7f3ea",
  "#e9e5dc",
  "#1b1a17",
  "#000000",
  "#b4532a",
  "#c2410c",
  "#e3261b",
  "#ff4fa3",
  "#f5b700",
  "#d6ff3d",
  "#2f6b3f",
  "#0f766e",
  "#1f5f8b",
  "#1d4ed8",
  "#6b2340",
];

const frame = (x: number, y: number, width: number, height: number): Frame => ({
  id: newId("b"),
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
});

export function textBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    ...frame(60, 60, 400, 80),
    kind: "text",
    text: "Your words here",
    font: "editorial",
    size: 40,
    weight: 400,
    italic: false,
    underline: false,
    uppercase: false,
    tracking: 0,
    leading: 1.15,
    align: "left",
    valign: "top",
    color: "#1b1a17",
    fill: "transparent",
    padding: 0,
    shadow: false,
    ...overrides,
  };
}

export function photoBox(overrides: Partial<PhotoBox> = {}): PhotoBox {
  return {
    ...frame(60, 160, 400, 300),
    kind: "photo",
    photo: null,
    fit: "cover",
    zoom: 1,
    focusX: 50,
    focusY: 50,
    radius: 0,
    borderWidth: 0,
    borderColor: "#ffffff",
    filter: "none",
    flip: false,
    ...overrides,
  };
}

export function shapeBox(overrides: Partial<ShapeBox> = {}): ShapeBox {
  return {
    ...frame(60, 60, 200, 200),
    kind: "shape",
    shape: "rect",
    fill: "#b4532a",
    radius: 0,
    borderWidth: 0,
    borderColor: "#1b1a17",
    ...overrides,
  };
}

export function blankPage(background = "#ffffff"): PosterPage {
  return { id: newId("p"), background, boxes: [] };
}

/** A copy with fresh ids throughout, for duplicating a box or a page. */
export function cloneBox<T extends Box>(box: T, offset = 0): T {
  return { ...box, id: newId("b"), x: box.x + offset, y: box.y + offset };
}

export function clonePage(page: PosterPage): PosterPage {
  return { ...page, id: newId("p"), boxes: page.boxes.map(box => cloneBox(box)) };
}

/** A page number as a page prints it: the number padded as the layout padded it, inside its words. */
export function folioText(folio: Folio, number: number): string {
  return `${folio.before}${String(number).padStart(folio.pad, "0")}${folio.after}`;
}

/**
 * Sets every marked page number to the page's place in the issue. Run after
 * anything that adds, removes or moves pages, so a layout's "4" always sits on
 * page four. Pages with nothing to change are handed back as they were, so an
 * undo step holds no copies it does not need.
 */
export function renumber(pages: PosterPage[]): PosterPage[] {
  return pages.map((page, at) => {
    let changed = false;
    const boxes = page.boxes.map(box => {
      if (box.kind !== "text" || !box.folio) return box;
      const text = folioText(box.folio, at + 1);
      if (text === box.text) return box;
      changed = true;
      return { ...box, text };
    });
    return changed ? { ...page, boxes } : page;
  });
}

/**
 * Keeps a box at least partly on the page and never smaller than `MIN_SIZE`.
 *
 * Partly, not wholly: a photograph run off the edge is a bleed, and the
 * reader should be able to make one. A quarter of it must stay on the sheet
 * so it can always be found and dragged back.
 */
export function clampBox<T extends Box>(box: T): T {
  // A shape may be a hairline rule, which `MIN_SIZE` would thicken into a bar the first time it moved.
  const least = box.kind === "shape" ? 1 : MIN_SIZE;
  const width = Math.max(least, Math.round(box.width));
  const height = Math.max(least, Math.round(box.height));
  const x = Math.round(Math.min(SHEET.width - width / 4, Math.max(-width * 0.75, box.x)));
  const y = Math.round(Math.min(SHEET.height - height / 4, Math.max(-height * 0.75, box.y)));
  return { ...box, x, y, width, height };
}

/** Layouts to start a page from. Every box is an ordinary box once placed; nothing about a starter is special. */
export const STARTERS = {
  blank: { name: "Blank page", build: () => blankPage() },
  cover: {
    name: "Cover",
    build: (): PosterPage => ({
      id: newId("p"),
      background: "#14213d",
      boxes: [
        photoBox({ ...frame(0, 0, SHEET.width, SHEET.height) }),
        textBox({ ...frame(28, 22, 464, 150), text: "Atlas", size: 150, leading: 0.9, color: "#ffffff" }),
        textBox({
          ...frame(30, 176, 460, 20),
          text: "NO. 01 · YOUR STORY, IN PRINT",
          font: "helvetica",
          size: 10,
          weight: 700,
          tracking: 0.2,
          color: "#ffffff",
        }),
        textBox({ ...frame(30, 520, 460, 110), text: "Out on the water", size: 62, leading: 0.95, color: "#ffffff" }),
        textBox({
          ...frame(30, 636, 400, 34),
          text: "Four slow days and the afternoon the whole lake went quiet.",
          font: "helvetica",
          size: 12,
          leading: 1.4,
          color: "#ffffff",
        }),
      ],
    }),
  },
  poster: {
    name: "Poster",
    build: (): PosterPage => ({
      id: newId("p"),
      background: "#b8431f",
      boxes: [
        textBox({ ...frame(28, 24, 464, 16), text: "ATLAS PRESENTS", font: "helvetica", size: 9, weight: 700, tracking: 0.2, color: "#fff4e4" }),
        textBox({ ...frame(26, 50, 470, 230), text: "SALT &\nSTONE", font: "impact", size: 118, leading: 0.86, color: "#fff4e4" }),
        photoBox({ ...frame(200, 290, 292, 310), radius: 146, arch: true, borderWidth: 3, borderColor: "#fff4e4" }),
        textBox({
          ...frame(28, 420, 160, 120),
          text: "“We stayed until the tea went cold.”",
          size: 24,
          italic: true,
          leading: 1.05,
          color: "#fff4e4",
        }),
        shapeBox({ ...frame(28, 620, 464, 2), fill: "#fff4e4" }),
        textBox({ ...frame(28, 632, 464, 40), text: "Four days, late summer · Up the coast road · Three friends, one bag", size: 16, color: "#fff4e4" }),
      ],
    }),
  },
  story: {
    name: "Story",
    build: (): PosterPage => ({
      id: newId("p"),
      background: "#fbf8f2",
      boxes: [
        photoBox({ ...frame(28, 90, 180, 250) }),
        photoBox({ ...frame(222, 0, 298, 340) }),
        textBox({ ...frame(28, 30, 180, 40), text: "Atlas\nOut in the World", font: "helvetica", size: 10, weight: 700, leading: 1.3 }),
        textBox({ ...frame(28, 360, 220, 14), text: "JUST BACK FROM", font: "helvetica", size: 8, weight: 700, tracking: 0.14, color: "#b4532a" }),
        textBox({ ...frame(28, 378, 220, 80), text: "The Coast, in Four Days", size: 34, leading: 0.95 }),
        textBox({
          ...frame(28, 466, 220, 190),
          text: "We arrived after dark with one bag between three of us and no plan beyond the first night. The days found their own shape: coffee on the step, a swim before the heat, a long lunch that turned into the afternoon.",
          font: "georgia",
          size: 9.5,
          leading: 1.55,
        }),
        textBox({ ...frame(270, 360, 222, 14), text: "A BRIEF GUIDE", font: "helvetica", size: 10, weight: 900, tracking: 0.06, color: "#b4532a" }),
        textBox({
          ...frame(270, 382, 222, 200),
          text: "Where to stay: up the hill, not on the front.\n\nWhere to eat: wherever the tables spill into the street after nine.\n\nHow to get around: on foot, mostly.",
          font: "helvetica",
          size: 9,
          leading: 1.45,
        }),
        textBox({ ...frame(28, 668, 300, 12), text: "24  ATLAS / SEPTEMBER 2026", font: "helvetica", size: 7, tracking: 0.1 }),
      ],
    }),
  },
  grid: {
    name: "Photo grid",
    build: (): PosterPage => ({
      id: newId("p"),
      background: "#f4f1ea",
      boxes: [
        textBox({ ...frame(28, 24, 464, 70), text: "Field Notes", size: 64, italic: true, leading: 1 }),
        shapeBox({ ...frame(28, 100, 464, 1.5), fill: "#1f2a24" }),
        photoBox({ ...frame(28, 116, 305, 250) }),
        photoBox({ ...frame(341, 116, 151, 250) }),
        photoBox({ ...frame(28, 374, 151, 170) }),
        photoBox({ ...frame(185, 374, 151, 170) }),
        photoBox({ ...frame(341, 374, 151, 170) }),
        textBox({
          ...frame(28, 556, 464, 110),
          text: "01 The city from the hill, the evening we arrived.\n02 Palms outside the guesthouse.\n03 The gull that followed the ferry.\n04 Terraces on the walk nobody warned us was uphill.\n05 Daisies, carried home.",
          font: "courier",
          size: 9,
          leading: 1.5,
          color: "#1f2a24",
        }),
      ],
    }),
  },
} satisfies Record<string, { name: string; build: () => PosterPage }>;

export type StarterId = keyof typeof STARTERS;
export const STARTER_IDS = Object.keys(STARTERS) as StarterId[];
