import { riddleFor } from "@/lib/magazine/diversions";
import { fitBox } from "@/lib/magazine/fit";
import { isSpent, remaining, START, toParagraphs, wordCount, type Cursor, type Slice } from "@/lib/magazine/copy";
import { boxesFor, PLAIN, plateSize, TEMPLATES, type PlateBox, type Template } from "@/lib/magazine/templates";
import { DEFAULT_THEME, THEMES, type ThemeId } from "@/lib/magazine/themes";
import { plateBoxes, textBoxes, type CustomDesign, type CustomPage, type CustomSlot } from "@/lib/magazine/custom";
import { surfaceOf, type TypeChoice } from "@/lib/magazine/typography";
import type { Issue, Page, Plate } from "@/lib/magazine/types";
import type { Photo } from "@/types";

/** An issue never runs longer than this, however much copy is pasted in. */
const MAX_PAGES = 96;

const ROMAN: [number, string][] = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** Plates are numbered in the old way: Plate VII, not Plate 7. */
function roman(value: number): string {
  let left = value;
  let out = "";
  for (const [size, numeral] of ROMAN) {
    while (left >= size) {
      out += numeral;
      left -= size;
    }
  }
  return out;
}

export function dateline(when = new Date()): string {
  return when.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

type ComposeInput = {
  title: string;
  photos: Photo[];
  story: string;
  when?: Date;
  /** True if the words were edited by the copy desk. */
  polished?: boolean;
  /**
   * Plate sizes the reader has set, by page index. An axis left out takes the
   * layout's default, and anything out of range is clamped to what the layout
   * can take.
   *
   * Keyed by index because that is what survives a recomposition: a bigger
   * plate holds less copy, so every page after it re-flows, but the resized
   * page and everything before it stay where they were.
   */
  plateSizes?: Record<number, Partial<PlateBox>>;
  /**
   * Decides the riddle on the blank leaf.
   *
   * Chosen once when the issue is sent to press and handed back unchanged on
   * every recomposition afterwards, so the riddle is new each time you press
   * but holds still while you are moving plates around. Absent, it falls back
   * to the title, which keeps a composition made without one repeatable.
   */
  seed?: string;
  /**
   * The style the issue is set in — which layouts its illustrated pages take,
   * and what they are printed on.
   *
   * Absent, the house style. Changing it re-lays the whole magazine, which is
   * why the reader's plate sizes are dropped alongside it: those are recorded
   * against page numbers, and a different theme paginates differently.
   */
  theme?: ThemeId;
  /**
   * The three pages the reader drew, used only by their own theme.
   *
   * Absent, the custom layouts have no boxes and fall back to plain columns —
   * which is what a theme chosen before anything was drawn should do.
   */
  custom?: CustomDesign;
  /**
   * Type chosen by the reader, replacing the theme's own.
   *
   * Unlike the lean, this cannot be applied after the fact: the body face and
   * its size are what every box was measured against, so changing it means
   * setting the issue again.
   */
  type?: TypeChoice;
  /** Whether the issue carries a leaf for the reader to draw or sign on. */
  sketch?: boolean;
};

/**
 * Lays the story and the photographs out as a magazine.
 *
 * Copy is poured through the layouts in order, each box measured against real
 * type before it is committed, so no page overflows and none is left half
 * empty.
 *
 * Photographs are spread across the whole issue rather than spent as fast as
 * the layouts will take them. Before each page the composer asks how far
 * through the story it has got and how many plates it has printed; a page that
 * has fallen behind takes a photograph, one that is ahead takes plain columns.
 * With enough photographs every page is illustrated, and with few they arrive
 * at an even interval to the last page instead of stopping a third of the way
 * in. No photograph is ever printed twice.
 *
 * Runs in the browser and touches nothing outside this tab.
 */
export function composeIssue({
  title,
  photos,
  story,
  when,
  polished = false,
  plateSizes,
  seed,
  theme = DEFAULT_THEME,
  custom,
  type,
  sketch,
}: ComposeInput): Issue {
  const base = THEMES[theme] ?? THEMES[DEFAULT_THEME];
  // The reader's type wins over the theme's, and the fitter below is given
  // the result rather than the theme's own.
  const chosen = type ? { ...base, surface: { ...base.surface, ...surfaceOf(type) } } : base;
  const order = chosen.cycle;
  // The face every box on every page is measured in. A theme that changes the
  // body type has to change it here too, or the pages are measured in one
  // typeface and set in another.
  const copyStyle = chosen.surface.copy;
  // Needed by the fitter only for the drop cap, which is display type set
  // inside a measured box.
  const displayFont = chosen.surface.display;
  // Changes the markup, so the fitter has to see it too — a span the renderer
  // added afterwards would be measured against text that never had it.
  const inkedPunctuation = chosen.surface.punctuation;
  // A theme with none named falls back to the house text page.
  const plainOrder = chosen.plain.length > 0 ? chosen.plain : [PLAIN];
  const paragraphs = toParagraphs(story);
  const words = wordCount(paragraphs);

  // With a single photograph the cover is the only place it can go.
  const cover = photos[0];
  const pool = [...(photos.length > 1 ? photos.slice(1) : photos)];
  let plateNumber = 0;

  // Fixed before anything is dealt: the pacing below measures progress against
  // the whole supply, and a shrinking denominator would make it accelerate.
  const supply = pool.length;

  const nextPlates = (count: number): Plate[] =>
    pool.splice(0, count).map(photo => ({ photo, label: `Plate ${roman(++plateNumber)}` }));

  /**
   * The design behind one of the reader's own layouts, if that is what this is.
   *
   * Everywhere else a template's shape is a property of the template. These
   * three take theirs from what was drawn, so every question the composer asks
   * about them — how many photographs, which boxes, what to record on the page
   * — goes through here.
   */
  const SLOT_OF: Partial<Record<Template["id"], CustomSlot>> = {
    "custom-left": "left",
    "custom-right": "right",
    "custom-special": "special",
  };
  const designFor = (id: Template["id"]): CustomPage | undefined => {
    const slot = SLOT_OF[id];
    return slot ? custom?.[slot] : undefined;
  };

  /** How many photographs a layout wants, the reader's own included. */
  const platesWanted = (template: Template): number => {
    const design = designFor(template.id);
    return design ? plateBoxes(design).length : template.plates;
  };

  let cursor: Cursor = START;
  const pages: Page[] = [];

  /** Fills a set of boxes from where the copy has got to. */
  const fill = (boxes: { width: number; height: number }[], dropCap = false): { slices: Slice[]; took: number } => {
    const slices: Slice[] = [];
    let took = 0;
    for (const [index, box] of boxes.entries()) {
      const fitted = fitBox(paragraphs, cursor, box.width, box.height, {
        dropCap: dropCap && index === 0,
        copy: copyStyle,
        display: displayFont,
        punctuation: inkedPunctuation,
      });
      slices.push(fitted.slice);
      cursor = fitted.next;
      took += fitted.taken;
    }
    return { slices, took };
  };

  const add = (template: Template, options: { plates?: Plate[]; dropCap?: boolean } = {}) => {
    const index = pages.length;

    // The plate is settled before the copy is poured, because on these layouts
    // the plate is what decides how much room the copy has.
    const plate = plateSize(template.id, plateSizes?.[index]);
    const design = designFor(template.id);
    // A drawn page brings its own boxes; every other layout derives them.
    const boxes = design ? textBoxes(design) : boxesFor(template.id, plate);
    const { slices } = fill(boxes, options.dropCap);

    pages.push({
      id: `${template.id}-${index}`,
      index,
      template: template.id,
      plates: options.plates ?? nextPlates(platesWanted(template)),
      plate,
      slices,
      folio: null,
      dropCap: options.dropCap,
      // Kept on the page so the drawn issue survives the design being edited
      // underneath it.
      layout: design,
    });
  };

  add(TEMPLATES.cover, { plates: cover ? [{ photo: cover, label: "Cover" }] : [] });
  add(TEMPLATES.contents);
  add(TEMPLATES.opener, { dropCap: true });

  let cycle = 0;

  /**
   * The next illustrated layout there are photographs enough for.
   *
   * Layouts want different numbers of them — the editorial grid wants three,
   * the zine collage two — so taking whatever comes next in the cycle would
   * print those with empty cells the moment the pool ran low. Instead the
   * cycle steps past a layout it cannot fill and comes back to it on a later
   * pass, when a page that has fallen behind is due several plates at once.
   *
   * Falling all the way through means the theme has nothing the remaining
   * photographs can fill — a grid theme down to its last two. Those are left
   * to the plates at the back rather than forced onto a page with holes in it.
   */
  const nextIllustrated = (): Template | null => {
    for (let step = 0; step < order.length; step += 1) {
      const candidate = TEMPLATES[order[(cycle + step) % order.length]!];
      if (platesWanted(candidate) <= pool.length) {
        cycle += step + 1;
        return candidate;
      }
    }
    return null;
  };

  /**
   * The next text page.
   *
   * Rotated, exactly as the illustrated layouts are, so a run of pages with no
   * photograph due is not the same page four times. Kept on its own counter:
   * the two rotations advance independently, or a theme with three text pages
   * and four illustrated ones would only ever pair them one way.
   */
  let plainStep = 0;
  /** Text pages laid down since the last photograph. Starts spent, so the
      first page of the body may illustrate however long the rest is. */
  let rested = chosen.rest;
  const nextPlain = (): Template => TEMPLATES[plainOrder[plainStep++ % plainOrder.length]!];

  /**
   * The reader's own theme lays its three pages down in the order it was
   * given, and the pacing above is not consulted at all — they have already
   * said which page goes where.
   */
  const running = chosen.fixed;
  let runningStep = 0;

  // The body: keep laying pages down until the copy is spent.
  while (!isSpent(paragraphs, cursor) && pages.length < MAX_PAGES) {
    if (running) {
      const next = TEMPLATES[running[runningStep++ % running.length]!];
      const before = remaining(paragraphs, cursor);
      add(next);
      // A drawn page with no text box on it would take no copy, and the issue
      // would never end. One with no boxes at all is not a page yet.
      const boxes = designFor(next.id) ? textBoxes(designFor(next.id)!).length : next.boxes.length;
      if (boxes > 0 && remaining(paragraphs, cursor) === before) break;
      if (boxes === 0) break;
      continue;
    }

    // How far through the story this page begins, against how much of the
    // supply has been printed. `plateNumber <= progress * supply` is behind or
    // level; at the start both sides are zero, so the first page is always
    // illustrated, and when there are more photographs than pages the test
    // never fails and every page gets one.
    const progress = words > 0 ? (words - remaining(paragraphs, cursor)) / words : 1;
    // Owed a photograph, and far enough from the last one to print it.
    const due = pool.length > 0 && plateNumber <= progress * supply && rested >= chosen.rest;

    const template = (due ? nextIllustrated() : null) ?? nextPlain();
    rested = template.plates > 0 ? 0 : rested + 1;

    const before = remaining(paragraphs, cursor);
    add(template);

    // A layout that consumed neither copy nor photographs would loop forever.
    if (template.boxes.length > 0 && remaining(paragraphs, cursor) === before) break;
  }

  // Photographs the copy never reached are printed at the back.
  while (pool.length > 0 && pages.length < MAX_PAGES) {
    add(pool.length >= 2 ? TEMPLATES["paired-plates"] : TEMPLATES["full-plate"]);
  }

  // The blank leaf, if one was asked for. After the plates and before the
  // padding, so it is the last thing in the issue that carries anything.
  if (sketch && pages.length < MAX_PAGES) add(TEMPLATES.canvas);

  // The cover stands alone, so the rest must be even for every spread to be
  // whole. Pad before the colophon rather than after it, so the issue closes
  // on a right-hand page the way a printed one does.
  if (pages.length % 2 !== 0) {
    add(TEMPLATES.blank);
    pages[pages.length - 1]!.riddle = riddleFor(seed ?? title);
  }
  add(TEMPLATES.colophon);

  pages.forEach((page, index) => {
    page.folio = index === 0 ? null : index + 1;
  });

  // The contents can only be set once every plate knows its page number.
  const entries = pages.flatMap(page =>
    page.folio === null ? [] : page.plates.map(plate => ({ label: plate.label, folio: page.folio! })),
  );
  const contents = pages.find(page => page.template === "contents");
  if (contents) contents.entries = entries;

  return {
    title: title.trim() || "Untitled",
    dateline: dateline(when),
    pages,
    words,
    overflowWords: remaining(paragraphs, cursor),
    polished,
    theme,
    type,
  };
}
