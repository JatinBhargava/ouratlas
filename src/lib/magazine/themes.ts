import type { CopyStyle } from "@/lib/magazine/copy";
import type { TemplateId } from "@/lib/magazine/templates";

/**
 * The named styles an issue can be set in.
 *
 * A theme is a running order of layouts and the paper they are printed on.
 * The composer walks the cycle one step per illustrated page, so choosing a
 * theme chooses what every picture page in the magazine looks like — which is
 * the whole of what the reader is picking between.
 *
 * Each one leads with the layout it is named for and keeps one or two
 * companions in the rotation behind it. A magazine of nothing but collage
 * pages is a pattern rather than an issue; a companion page every other leaf
 * is what lets the signature layout still read as a decision when it returns.
 * Making a theme pure is a matter of deleting its companions from `cycle`.
 */

/**
 * What the issue is printed on, and in.
 *
 * Two of the three themes are grid decisions and take the house surface. The
 * zine is not: warm stock, raspberry ink, a heavy cut-out headline and a
 * typewritten body are most of what makes it a zine, and no arrangement of
 * rectangles would say it on its own.
 *
 * No new webfont is loaded for any of this. The site deliberately serves one
 * face from its own origin and asks nothing of a third party (see the note in
 * `index.html`), so a theme picks its type out of what the machine already
 * has — which for a zine is the right instinct anyway. A zine is set in
 * whatever the office had.
 */
export type Surface = {
  /** The colour of the leaf. */
  paper: string;
  /** The colour kickers, rules and folios are set in. */
  accent: string;
  /** Headline colour. */
  ink: string;
  /**
   * The face headlines and kickers are set in.
   *
   * A stack rather than one name: nothing here is downloaded, so it has to
   * degrade through what macOS, Windows and Linux each actually have.
   */
  display: string;
  /** Weight the display face is set at. The house serif has only one. */
  displayWeight?: string;
  /** Tracking on display type. Large grotesques need pulling in; a serif does not. */
  displayTracking?: string;
  /**
   * Overrides on the body face.
   *
   * These go to the fitter as well as to the page — see `CopyStyle`. Absent
   * means the house body type, unchanged.
   */
  copy?: CopyStyle;
  /** Whether plates carry the white border of a photographic print. */
  snapshots?: boolean;
  /**
   * How far a pasted-up plate leans, in degrees.
   *
   * The theme sets what it thinks right and the reader overrides it from the
   * desk, so this is a default rather than a decision. Rotation is drawn on a
   * wrapper and changes no box the fitter measured, which is why the reader
   * can move it without the issue having to be set again.
   */
  tilt?: number;
  /**
   * A second leaf, taken on alternate pages.
   *
   * One magazine here prints cream and black by turns, which is a thing a
   * single paper colour cannot say. Only colours may differ: the fitter
   * measured every box in one face at one size, so a reversing leaf may
   * change what the type is *inked* in and nothing else.
   */
  reverse?: { paper: string; ink: string; copy: string };
  /**
   * Whether full stops and ampersands are lifted into the accent colour.
   *
   * Goes to the fitter as well, because it changes the markup — see
   * `paragraphsHtml`. It cannot change where a line breaks.
   */
  punctuation?: boolean;
  /** A repeating ornament closing the head and foot of the feature pages. */
  ornament?: string;
  /**
   * How the page number is set at the foot.
   *
   * "small" is the house rule — a number in the corner, out of the way.
   * "large" is the device the modernist theme is built around: an outsized
   * light numeral against the outer edge with the section named beside it
   * behind a hairline, which on a spread reads as one wide running foot.
   */
  folio?: "small" | "large";
};

/** A block on the small diagram shown in the picker. */
export type PreviewCell = { span: number; kind: "plate" | "copy" | "head" };
export type PreviewRow = { span: number; cells: PreviewCell[] };

export type ThemeId = "atlas" | "custom" | "minimal" | "modernist" | "nocturne" | "zine";

export type Theme = {
  id: ThemeId;
  name: string;
  /** One line, said the way the printed page would say it. */
  blurb: string;
  /** The layouts its illustrated pages take, in order. */
  cycle: TemplateId[];
  /**
   * The layouts a page takes when no photograph is due, in order.
   *
   * Every theme needs these as much as it needs the illustrated ones. A run
   * of pages that all carry a picture reads as a portfolio; what makes an
   * issue is the reading between them, and a theme whose text pages look like
   * everyone else's text pages has only half a style.
   */
  plain: TemplateId[];
  /**
   * A fixed running order, laid down page after page regardless of pacing.
   *
   * Only the reader's own theme uses this. Everywhere else the composer
   * decides when a photograph is due and picks accordingly; here the reader
   * has already decided, by drawing three pages and saying where each goes,
   * and second-guessing that would be answering a question nobody asked.
   */
  fixed?: TemplateId[];
  /**
   * The fewest text pages that must fall between two illustrated ones.
   *
   * Without this a well-stocked desk fills every leaf: the composer prints a
   * photograph whenever one is owed, and fifteen photographs across fourteen
   * pages owes one every time. The result is a slideshow — which is right for
   * a theme built on pictures and quite wrong for one built on reading.
   *
   * Zero is the old behaviour: illustrate wherever the pacing allows.
   * Photographs the rhythm leaves unspent are printed at the back, as they
   * always were.
   */
  rest: number;
  surface: Surface;
  /**
   * The theme drawn as blocks, for the picker.
   *
   * Kept beside the cycle rather than in the component because it describes
   * the same decision: change the layouts and the diagram beside them has to
   * change too, and a reader who picks by the picture has to be picking by a
   * true one.
   */
  preview: PreviewRow[];
};

const plate = (span = 1): PreviewCell => ({ span, kind: "plate" });
const copy = (span = 1): PreviewCell => ({ span, kind: "copy" });
const head = (span = 1): PreviewCell => ({ span, kind: "head" });

/** What every theme but the zine is printed on: white stock, the house serif. */
const HOUSE: Surface = {
  paper: "#ffffff",
  accent: "#a8a29e",
  ink: "#1c1917",
  display: 'var(--font-editorial), ui-serif, Georgia, serif',
};

export const THEMES: Record<ThemeId, Theme> = {
  atlas: {
    id: "atlas",
    name: "Atlas",
    blurb: "The house style. The photograph moves around the page from one leaf to the next.",
    cycle: ["plate-above", "plate-beside", "plate-band", "plate-beside-right", "plate-below"],
    plain: ["two-column"],
    rest: 0,
    surface: HOUSE,
    preview: [
      { span: 4, cells: [plate()] },
      { span: 5, cells: [copy(), copy()] },
    ],
  },
  custom: {
    id: "custom",
    name: "Your own",
    blurb: "Three pages you draw yourself — boxes for words and boxes for pictures, moved and sized by hand.",
    // The special opens the issue, then left and right make the spreads, and
    // the special returns every sixth leaf to break the pattern.
    fixed: ["custom-special", "custom-left", "custom-right", "custom-left", "custom-right", "custom-left"],
    cycle: ["custom-left", "custom-right"],
    plain: ["two-column"],
    rest: 0,
    surface: HOUSE,
    preview: [
      { span: 3, cells: [plate()] },
      { span: 4, cells: [copy(), copy()] },
      { span: 2, cells: [copy(1.6), plate(1)] },
    ],
  },
  minimal: {
    id: "minimal",
    name: "Minimalist grid",
    blurb: "One column, one small photograph set low, and a great deal of air.",
    cycle: ["minimal-grid", "plate-beside", "minimal-grid", "plate-beside-right"],
    // The centred article is the quietest page in the issue, which is this
    // theme's whole argument.
    plain: ["two-column", "centred-article"],
    rest: 0,
    surface: HOUSE,
    preview: [
      { span: 1, cells: [head()] },
      { span: 5, cells: [copy(), copy()] },
      { span: 3, cells: [copy(), plate()] },
      { span: 3, cells: [] },
    ],
  },
  modernist: {
    id: "modernist",
    name: "Modernist",
    blurb: "Enormous grotesque headlines reversed out of a black band, over four narrow columns.",
    // No full-plate here any more: a photograph with no words on it is a
    // portfolio page, and two of them to a spread was most of what made this
    // theme read as a slideshow. Leftover photographs still reach the plates
    // at the back, which is where a page of pure picture belongs.
    cycle: ["four-column", "plate-above", "four-column", "plate-band"],
    // Four narrow measures with nothing on them but reading — the page the
    // reference is actually built around.
    plain: ["quad-text", "quad-text", "centred-article"],
    // A page of reading between every illustrated one. The reference is a
    // magazine of articles that happens to carry photographs, not the reverse.
    rest: 1,
    surface: {
      paper: "#ffffff",
      accent: "#111111",
      ink: "#111111",
      // The Swiss grotesque, from whatever the machine has. Helvetica on a
      // Mac, Arial on Windows, Liberation Sans on Linux — metrically close
      // enough that the fitter's measurement holds on all three.
      display: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
      displayWeight: "700",
      // Display type this large opens up; pulling it back in is most of what
      // makes it read as set rather than typed.
      displayTracking: "-0.03em",
      // Four columns to the measure leaves about twenty characters a line, so
      // the body has to come down with it or nothing fits.
      copy: {
        fontFamily: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
        fontSize: "8px",
        lineHeight: "1.42",
        textAlign: "left",
        color: "#111111",
      },
      folio: "large",
    },
    preview: [
      { span: 3, cells: [head()] },
      { span: 3, cells: [plate()] },
      { span: 4, cells: [copy(), copy(), copy(), copy()] },
    ],
  },
  nocturne: {
    id: "nocturne",
    name: "Nocturne",
    blurb: "Cream and black leaves by turns, a centred serif under ornament, and warm punctuation.",
    cycle: ["ornament-feature", "plate-band", "ornament-feature", "plate-beside"],
    // Two columns of justified serif on a reversing leaf, and every third
    // page the centred one.
    plain: ["two-column", "centred-article", "two-column"],
    rest: 1,
    surface: {
      // Uncoated cream, not white — the page it alternates with is black, and
      // a bright white against black reads as a mistake in the printing.
      paper: "#f2ede2",
      ink: "#16130f",
      // A warm coral, used only on punctuation and the kickers.
      accent: "#e05a33",
      display: 'var(--font-editorial), ui-serif, Georgia, "Times New Roman", serif',
      // Every other leaf reverses. Only the colours move; the face, the size
      // and the leading are what the fitter measured and stay put.
      reverse: { paper: "#16130f", ink: "#f2ede2", copy: "#e6ded0" },
      copy: {
        fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
        fontSize: "9px",
        lineHeight: "1.66",
        textAlign: "justify",
        color: "#16130f",
      },
      punctuation: true,
      ornament: "❦",
      folio: "small",
    },
    preview: [
      { span: 1, cells: [head()] },
      { span: 3, cells: [copy()] },
      { span: 4, cells: [plate()] },
      { span: 3, cells: [copy(), copy()] },
      { span: 1, cells: [head()] },
    ],
  },
  zine: {
    id: "zine",
    name: "Zine",
    blurb: "Cream stock and raspberry ink, with the photographs pasted up at angles as snapshots.",
    cycle: ["zine-rows", "zine-collage", "zine-rows", "plate-band"],
    plain: ["two-column"],
    rest: 0,
    // Warm stock rather than white, and a raspberry for the ink. A zine is
    // photocopied onto whatever paper was to hand, and the one thing it never
    // is, is bright white.
    surface: {
      // Warm stock rather than white. A zine is photocopied onto whatever
      // paper was to hand, and the one thing it never is, is bright white.
      paper: "#f7f1e4",
      // Raspberry, for the obvious reason.
      accent: "#a8123f",
      ink: "#241c19",
      // Cut from a magazine and pasted down: heavy, condensed, shouting.
      // Impact and Haettenschweiler ship with Windows and macOS respectively;
      // the narrow grotesques behind them are the Linux fallback.
      display: '"Haettenschweiler", "Impact", "Arial Narrow Bold", "Liberation Sans Narrow", sans-serif',
      // Typewritten, which is what a zine body actually is — and set ragged
      // right, because a typewriter cannot justify and pretending otherwise
      // opens rivers through a monospaced face.
      copy: {
        fontFamily: '"Courier New", ui-monospace, "DejaVu Sans Mono", monospace',
        fontSize: "9.5px",
        lineHeight: "1.55",
        letterSpacing: "-0.1px",
        textAlign: "left",
        color: "#241c19",
      },
      snapshots: true,
      tilt: 2.5,
    },
    preview: [
      { span: 4, cells: [copy(), plate()] },
      { span: 4, cells: [copy(), plate()] },
      { span: 2, cells: [copy(), { span: 1, kind: "copy" }] },
    ],
  },
};

export const DEFAULT_THEME: ThemeId = "atlas";

/** The themes in the order the picker offers them. */
export const THEME_LIST: Theme[] = [
  THEMES.atlas,
  THEMES.custom,
  THEMES.minimal,
  THEMES.modernist,
  THEMES.nocturne,
  THEMES.zine,
];

/** A theme by id, falling back to the house style for anything unrecognised. */
export function themeOf(id: string | undefined): Theme {
  return THEMES[(id ?? "") as ThemeId] ?? THEMES[DEFAULT_THEME];
}
