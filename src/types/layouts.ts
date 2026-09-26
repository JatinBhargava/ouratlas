/**
 * Layouts readers submit to the directory: shared by the API, which stores
 * them, and the browser, which draws them.
 *
 * A layout is the design of a page and nothing of its content. Whatever a
 * submission carries, `sanitizeDesign` rebuilds it from known fields only:
 * photographs are dropped (every photo box comes back an empty frame), every
 * word in a text box is replaced with a placeholder sized to the box, colours
 * must be hex, fonts must be ones the studio offers, numbers are clamped. The
 * API runs it on every submission, so what reaches the database is a template
 * whatever the request said — and the browser runs the same function to show
 * the submitter exactly what will be published.
 *
 * The one piece of real content is the sample: a picture of the finished
 * page, which the submitter chooses to attach and agrees may be shown.
 */

export type LayoutKind = "poster" | "magazine";
export type LayoutStatus = "pending" | "accepted" | "rejected";
export type LayoutSort = "top" | "new";

export const LAYOUT_KINDS: readonly LayoutKind[] = ["poster", "magazine"];

export const LAYOUT_LIMITS = {
  title: 60,
  description: 280,
  note: 500,
  /** The sample picture, decoded. A 1600-pixel JPEG sits well inside it. */
  sampleBytes: 1_500_000,
  /** Submissions waiting at once per account; review is by hand. */
  pending: 5,
  posterPages: 12,
  boxesPerPage: 60,
} as const;

/** Typefaces the studio offers, by id. `src/lib/poster/model.ts` names each one; this is what the server accepts. */
export const POSTER_FONT_IDS = [
  "editorial",
  "georgia",
  "times",
  "garamond",
  "baskerville",
  "palatino",
  "didot",
  "helvetica",
  "system",
  "avenir",
  "futura",
  "gill",
  "trebuchet",
  "verdana",
  "impact",
  "rockwell",
  "copperplate",
  "courier",
  "mono",
  "script",
  "marker",
] as const;
export type PosterFontId = (typeof POSTER_FONT_IDS)[number];

export const POSTER_FILTERS = ["none", "mono", "sepia", "warm", "cool", "fade", "punch"] as const;

/** One layout as the directory shows it. `design` is already sanitized. */
export type LayoutCard = {
  id: string;
  kind: LayoutKind;
  title: string;
  description: string;
  design: LayoutDesign;
  /** A short-lived signed URL, or null once a rejected sample has been cleared away. */
  sampleUrl: string | null;
  likes: number;
  /** Whether the person asking has liked it; false when signed out. */
  liked: boolean;
  /** The submitter's first name, or null. Never an email. */
  author: string | null;
  createdAt: string;
};

/** A layout as its submitter (and a reviewer) sees it, with where it stands. */
export type OwnLayout = LayoutCard & {
  status: LayoutStatus;
  note: string | null;
  reviewedAt: string | null;
};

export type ReviewLayout = OwnLayout & { authorEmail: string | null; notified: boolean };

export type LayoutList = { layouts: LayoutCard[] };
export type OwnLayoutList = { layouts: OwnLayout[] };
export type ReviewList = { layouts: ReviewLayout[] };

/** `POST /api/layouts` */
export type LayoutSubmission = {
  kind: LayoutKind;
  title: string;
  description: string;
  design: unknown;
  /** A data URL: JPEG, PNG or WebP. */
  sample: string;
};

/** `POST /api/layouts/:id/like` */
export type LikeResult = { liked: boolean; likes: number };

/** `POST /api/admin/layouts/:id/review` */
export type ReviewDecision = { decision: "accept" | "reject"; note: string };
export type ReviewResult = { status: LayoutStatus; emailed: boolean };

/* ------------------------------------------------------------ designs */

type Frame = { id: string; x: number; y: number; width: number; height: number; rotation: number; opacity: number; locked?: boolean };

export type PosterTextData = Frame & {
  kind: "text";
  text: string;
  font: PosterFontId;
  size: number;
  weight: 400 | 700 | 900;
  italic: boolean;
  underline: boolean;
  uppercase: boolean;
  tracking: number;
  leading: number;
  align: "left" | "center" | "right" | "justify";
  valign: "top" | "middle" | "bottom";
  color: string;
  fill: string;
  padding: number;
  shadow: boolean;
};

export type PosterPhotoData = Frame & {
  kind: "photo";
  photo: null;
  fit: "cover" | "contain";
  zoom: number;
  focusX: number;
  focusY: number;
  radius: number;
  arch: boolean;
  borderWidth: number;
  borderColor: string;
  filter: (typeof POSTER_FILTERS)[number];
  flip: boolean;
};

export type PosterShapeData = Frame & {
  kind: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  radius: number;
  borderWidth: number;
  borderColor: string;
};

export type PosterPageData = { id: string; background: string; boxes: (PosterTextData | PosterPhotoData | PosterShapeData)[] };
export type PosterDesign = { pages: PosterPageData[] };

export type MagazineBoxData = {
  id: string;
  kind: "text" | "plate" | "sketch" | "quote";
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: "accent" | "ink" | "paper";
  signOff?: boolean;
};
export type MagazinePageData = { boxes: MagazineBoxData[]; bleed?: boolean };
export type MagazineDesign = {
  left: MagazinePageData;
  right: MagazinePageData;
  special: MagazinePageData;
  palette?: { paper: string; ink: string; accent: string };
};

export type LayoutDesign = PosterDesign | MagazineDesign;

/* ----------------------------------------------------------- sanitize */

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const record = (value: unknown): Record<string, unknown> => (typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const bool = (value: unknown) => value === true;
const pick = <T extends string | number>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const color = (value: unknown, fallback: string) => (typeof value === "string" && HEX.test(value) ? value.toLowerCase() : fallback);
const fill = (value: unknown, fallback: string) => (value === "transparent" ? "transparent" : color(value, fallback));

/**
 * Words for a text box of a given size, so a template still reads as the
 * kind of text that goes there: a headline, a line of display, a label, a
 * paragraph. Never the submitter's own.
 */
export function placeholderText(size: number, uppercase: boolean): string {
  if (size >= 40) return "Headline";
  if (size >= 20) return "A line that sets the scene";
  if (uppercase || size < 10) return "Label";
  return "Your words go here: a sentence or two about the moment, who was there and why it mattered.";
}

function frame(value: Record<string, unknown>, index: number): Frame {
  return {
    id: `b${index}`,
    x: num(value.x, -2000, 2000, 0),
    y: num(value.y, -2000, 2000, 0),
    width: num(value.width, 1, 2000, 100),
    height: num(value.height, 1, 2000, 100),
    rotation: num(value.rotation, -360, 360, 0),
    opacity: num(value.opacity, 0.05, 1, 1),
    ...(value.locked === true ? { locked: true } : {}),
  };
}

function posterBox(input: unknown, index: number): PosterPageData["boxes"][number] | null {
  const value = record(input);
  if (value.kind === "text") {
    const size = num(value.size, 4, 400, 16);
    const uppercase = bool(value.uppercase);
    return {
      ...frame(value, index),
      kind: "text",
      text: placeholderText(size, uppercase),
      font: pick(value.font, POSTER_FONT_IDS, "georgia"),
      size,
      weight: pick(value.weight, [400, 700, 900] as const, 400),
      italic: bool(value.italic),
      underline: bool(value.underline),
      uppercase,
      tracking: num(value.tracking, -0.5, 2, 0),
      leading: num(value.leading, 0.5, 4, 1.2),
      align: pick(value.align, ["left", "center", "right", "justify"] as const, "left"),
      valign: pick(value.valign, ["top", "middle", "bottom"] as const, "top"),
      color: color(value.color, "#1b1a17"),
      fill: fill(value.fill, "transparent"),
      padding: num(value.padding, 0, 200, 0),
      shadow: bool(value.shadow),
    };
  }
  if (value.kind === "photo") {
    return {
      ...frame(value, index),
      kind: "photo",
      photo: null,
      fit: pick(value.fit, ["cover", "contain"] as const, "cover"),
      zoom: num(value.zoom, 1, 5, 1),
      focusX: num(value.focusX, 0, 100, 50),
      focusY: num(value.focusY, 0, 100, 50),
      radius: num(value.radius, 0, 1000, 0),
      arch: bool(value.arch),
      borderWidth: num(value.borderWidth, 0, 100, 0),
      borderColor: color(value.borderColor, "#ffffff"),
      filter: pick(value.filter, POSTER_FILTERS, "none"),
      flip: bool(value.flip),
    };
  }
  if (value.kind === "shape") {
    return {
      ...frame(value, index),
      kind: "shape",
      shape: pick(value.shape, ["rect", "ellipse"] as const, "rect"),
      fill: fill(value.fill, "#b4532a"),
      radius: num(value.radius, 0, 1000, 0),
      borderWidth: num(value.borderWidth, 0, 100, 0),
      borderColor: color(value.borderColor, "#1b1a17"),
    };
  }
  return null;
}

function posterDesign(input: unknown): PosterDesign | string {
  const pages = record(input).pages;
  if (!Array.isArray(pages) || pages.length === 0) return "A layout needs at least one page.";
  if (pages.length > LAYOUT_LIMITS.posterPages) return `A layout can have at most ${LAYOUT_LIMITS.posterPages} pages.`;
  const clean: PosterPageData[] = [];
  for (const [at, page] of pages.entries()) {
    const value = record(page);
    const boxes = Array.isArray(value.boxes) ? value.boxes : [];
    if (boxes.length > LAYOUT_LIMITS.boxesPerPage) return `A page can have at most ${LAYOUT_LIMITS.boxesPerPage} boxes.`;
    clean.push({
      id: `p${at}`,
      background: color(value.background, "#ffffff"),
      boxes: boxes.map(posterBox).filter(box => box !== null),
    });
  }
  if (clean.every(page => page.boxes.length === 0)) return "That layout is empty. Add some boxes first.";
  return { pages: clean };
}

function magazinePage(input: unknown): MagazinePageData {
  const value = record(input);
  const boxes = (Array.isArray(value.boxes) ? value.boxes : []).slice(0, 20).flatMap((box, index): MagazineBoxData[] => {
    const entry = record(box);
    const kind = pick(entry.kind, ["text", "plate", "sketch", "quote"] as const, "text");
    return [
      {
        id: `m${index}`,
        kind,
        x: num(entry.x, 0, 1000, 0),
        y: num(entry.y, 0, 1000, 0),
        width: num(entry.width, 10, 1000, 100),
        height: num(entry.height, 10, 1000, 100),
        ...(kind === "quote" ? { tone: pick(entry.tone, ["accent", "ink", "paper"] as const, "accent") } : {}),
        ...(kind === "quote" && entry.signOff === true ? { signOff: true } : {}),
      },
    ];
  });
  return { boxes, ...(value.bleed === true ? { bleed: true } : {}) };
}

function magazineDesign(input: unknown): MagazineDesign | string {
  const value = record(input);
  const design: MagazineDesign = {
    left: magazinePage(value.left),
    right: magazinePage(value.right),
    special: magazinePage(value.special),
  };
  if (design.left.boxes.length + design.right.boxes.length + design.special.boxes.length === 0) return "That layout has no boxes.";
  const palette = record(value.palette);
  if (palette.paper || palette.ink || palette.accent) {
    design.palette = { paper: color(palette.paper, "#fbf8f2"), ink: color(palette.ink, "#1b1a17"), accent: color(palette.accent, "#b4532a") };
  }
  // Pull quotes are lines from the submitter's story, so they are never carried.
  return design;
}

/** The template a submission becomes, or the reason it cannot be one. */
export function sanitizeDesign(kind: LayoutKind, design: unknown): LayoutDesign | string {
  return kind === "poster" ? posterDesign(design) : magazineDesign(design);
}

export function isPosterDesign(design: LayoutDesign): design is PosterDesign {
  return Array.isArray((design as PosterDesign).pages);
}
