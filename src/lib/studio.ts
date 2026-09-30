import beachPalms from "@/assets/studio/beach-palms.jpg";
import boatUmbrella from "@/assets/studio/boat-umbrella.jpg";
import brickFacades from "@/assets/studio/brick-facades.jpg";
import cafeStreet from "@/assets/studio/cafe-street.jpg";
import cityFromHill from "@/assets/studio/city-from-hill.jpg";
import daisies from "@/assets/studio/daisies.jpg";
import farmhouse from "@/assets/studio/farmhouse.jpg";
import geese from "@/assets/studio/geese.jpg";
import gull from "@/assets/studio/gull.jpg";
import lane from "@/assets/studio/lane.jpg";
import palmsPink from "@/assets/studio/palms-pink.jpg";
import rooftops from "@/assets/studio/rooftops.jpg";
import terraces from "@/assets/studio/terraces.jpg";
import treeBench from "@/assets/studio/tree-bench.jpg";

/**
 * Atlas Studio's pages: every layout from the design canvas, as markup.
 *
 * `studio/pages.json` is written by `scripts/studio.ts` and never by hand. It is
 * about a megabyte, so it is fetched as its own chunk when the studio opens
 * (`loadStudio`) rather than carried by the page's code, and the heading and
 * shelves draw before it arrives.
 */

export type StudioPage = {
  id: string;
  title: string;
  /** The page's own size in CSS px: 780×1040 for a page, twice as wide for a spread. */
  width: number;
  height: number;
  css: string;
  html: string;
};

export type StudioSection = {
  id: string;
  group: StudioGroup;
  name: string;
  blurb: string;
  pages: StudioPage[];
};

export type StudioGroup = "one-page" | "magazine" | "ideas" | "issues";

/**
 * The shelves, in the order the page lists them. `scripts/studio.ts` decides which row sits on which.
 *
 * Each carries a line of its own, written here rather than read from
 * `pages.json`, because the pages arrive only after the studio has drawn and
 * the build draws /studio ahead of time without them (`build.ts`). These lines
 * are what a crawler that runs no script learns the shelves hold, so they name
 * what is really on each; change them when a row moves shelf.
 */
export const STUDIO_GROUPS: { id: StudioGroup; label: string; blurb: string }[] = [
  {
    id: "one-page",
    label: "One-page magazines",
    blurb: "A whole story on a single sheet, in a dozen moods: minimal, cinematic, zine, anime, the long letter and the classic cover.",
  },
  {
    id: "magazine",
    label: "Magazine pages",
    blurb: "The leaves an issue is built from: covers, contents, openers, photo plates, pull quotes and the back of the book.",
  },
  {
    id: "ideas",
    label: "New ideas",
    blurb: "Layouts still on the drawing board: a contact sheet, chapters, a postcard, a back cover and the double-page spread.",
  },
  {
    id: "issues",
    label: "Complete issues",
    blurb: "Ten-page issues from cover to colophon, each in a house style of its own, from Swiss and Gazette to Riviera, Garden and Noir.",
  },
];

/** Bundled, so each gets a hashed address and the long cache; the pages name them as `%photo:<name>%`. */
const PHOTOS: Record<string, string> = {
  "beach-palms": beachPalms,
  "boat-umbrella": boatUmbrella,
  "brick-facades": brickFacades,
  "cafe-street": cafeStreet,
  "city-from-hill": cityFromHill,
  daisies,
  farmhouse,
  geese,
  gull,
  lane,
  "palms-pink": palmsPink,
  rooftops,
  terraces,
  "tree-bench": treeBench,
};

let loading: Promise<StudioSection[]> | null = null;

/** The sections, fetched once. Forgotten on failure so the next visit can try again. */
export function loadStudio(): Promise<StudioSection[]> {
  loading ??= import("./studio/pages.json")
    .then(module => (module.default as { sections: StudioSection[] }).sections)
    .catch(error => {
      loading = null;
      throw error;
    });
  return loading;
}

const photo = (_: string, name: string) => PHOTOS[name] ?? "";

/**
 * The places a reader's photographs go in a set of pages: one per sample
 * photograph, in the order each first appears.
 *
 * Keyed by picture rather than by `<img>`, because the designs reuse a
 * picture on purpose — a spread cuts one photograph across two pages, and a
 * contents page shows small copies of the plates inside. Whatever replaces the
 * gull on the opener must replace it on the contents page too.
 */
export function photoSlots(pages: StudioPage[]): string[] {
  const seen = new Set<string>();
  for (const page of pages) {
    for (const [, name] of `${page.css}${page.html}`.matchAll(/%photo:([\w-]+)%/g)) seen.add(name!);
  }
  return [...seen];
}

/** The bundled sample photograph a slot starts with. */
export function samplePhoto(slot: string): string {
  return PHOTOS[slot] ?? "";
}

const SLOT_OF = new Map(Object.entries(PHOTOS).map(([name, url]) => [url, name]));

/** Which slot a drawn page's `<img src>` belongs to, if it is one of the samples. */
export function slotOf(url: string | null): string | undefined {
  return url ? SLOT_OF.get(url) : undefined;
}

/**
 * One page as a whole document, for an iframe's `srcdoc`.
 *
 * An iframe rather than markup dropped into the app: each page carries its own
 * stylesheet with bare class names (`.dots`, `.grid`) and a `body` rule, and in
 * the app's document those would restyle the site and each other. The frame
 * is sandboxed without scripts; `allow-same-origin` stays so the photographs
 * and the font load from the site like any other request. Without it the
 * frame's origin is opaque and the font, a cross-origin fetch then, is refused.
 *
 * The face is the site's own Instrument Serif, declared here because a frame
 * does not inherit the parent's `@font-face` rules. Italics are synthesised
 * from the upright, as they are across the site.
 */
export function pageDocument(page: StudioPage): string {
  const css = page.css.replace(/%photo:([\w-]+)%/g, photo);
  const html = page.html.replace(/%photo:([\w-]+)%/g, photo);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
@font-face{font-family:"Instrument Serif";font-style:normal;font-weight:400;font-display:block;src:url("/instrument-serif.ttf") format("truetype")}
${css}
html,body{margin:0;overflow:hidden;background:transparent}
</style></head><body>${html}</body></html>`;
}
