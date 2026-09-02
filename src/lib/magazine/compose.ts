import { riddleFor } from "@/lib/magazine/diversions";
import { fitBox } from "@/lib/magazine/fit";
import { isSpent, remaining, START, toParagraphs, wordCount, type Cursor, type Slice } from "@/lib/magazine/copy";
import {
  boxesFor,
  PLAIN,
  PLATE_CYCLE,
  plateSize,
  TEMPLATES,
  type PlateBox,
  type Template,
} from "@/lib/magazine/templates";
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
}: ComposeInput): Issue {
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

  let cursor: Cursor = START;
  const pages: Page[] = [];

  /** Fills a set of boxes from where the copy has got to. */
  const fill = (boxes: { width: number; height: number }[], dropCap = false): { slices: Slice[]; took: number } => {
    const slices: Slice[] = [];
    let took = 0;
    for (const [index, box] of boxes.entries()) {
      const fitted = fitBox(paragraphs, cursor, box.width, box.height, {
        dropCap: dropCap && index === 0,
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
    const { slices } = fill(boxesFor(template.id, plate), options.dropCap);

    pages.push({
      id: `${template.id}-${index}`,
      index,
      template: template.id,
      plates: options.plates ?? nextPlates(template.plates),
      plate,
      slices,
      folio: null,
      dropCap: options.dropCap,
    });
  };

  add(TEMPLATES.cover, { plates: cover ? [{ photo: cover, label: "Cover" }] : [] });
  add(TEMPLATES.contents);
  add(TEMPLATES.opener, { dropCap: true });

  // The body: keep laying pages down until the copy is spent.
  let cycle = 0;
  while (!isSpent(paragraphs, cursor) && pages.length < MAX_PAGES) {
    // How far through the story this page begins, against how much of the
    // supply has been printed. `plateNumber <= progress * supply` is behind or
    // level; at the start both sides are zero, so the first page is always
    // illustrated, and when there are more photographs than pages the test
    // never fails and every page gets one.
    const progress = words > 0 ? (words - remaining(paragraphs, cursor)) / words : 1;
    const due = pool.length > 0 && plateNumber <= progress * supply;

    const template = due ? TEMPLATES[PLATE_CYCLE[cycle % PLATE_CYCLE.length]!] : TEMPLATES[PLAIN];
    if (due) cycle += 1;

    const before = remaining(paragraphs, cursor);
    add(template);

    // A layout that consumed neither copy nor photographs would loop forever.
    if (template.boxes.length > 0 && remaining(paragraphs, cursor) === before) break;
  }

  // Photographs the copy never reached are printed at the back.
  while (pool.length > 0 && pages.length < MAX_PAGES) {
    add(pool.length >= 2 ? TEMPLATES["paired-plates"] : TEMPLATES["full-plate"]);
  }

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
  };
}
