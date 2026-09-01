import { fitBox } from "@/lib/magazine/fit";
import { isSpent, remaining, START, toParagraphs, wordCount, type Cursor, type Slice } from "@/lib/magazine/copy";
import { BODY_CYCLE, TEMPLATES, type Template, type TemplateId } from "@/lib/magazine/templates";
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
};

/**
 * Lays the story and the photographs out as a magazine.
 *
 * Copy is poured through the layouts in order, each box measured against real
 * type before it is committed, so no page overflows and none is left half
 * empty. Photographs are dealt out as the layouts call for them and never
 * repeat; once they run out the issue settles into plain columns, and any that
 * the copy did not reach are printed as plates at the back.
 *
 * Runs in the browser and touches nothing outside this tab.
 */
export function composeIssue({ title, photos, story, when, polished = false }: ComposeInput): Issue {
  const paragraphs = toParagraphs(story);
  const words = wordCount(paragraphs);

  // With a single photograph the cover is the only place it can go.
  const cover = photos[0];
  const pool = [...(photos.length > 1 ? photos.slice(1) : photos)];
  let plateNumber = 0;

  const nextPlates = (count: number): Plate[] =>
    pool.splice(0, count).map(photo => ({ photo, label: `Plate ${roman(++plateNumber)}` }));

  let cursor: Cursor = START;
  const pages: Page[] = [];

  /** Fills a template's boxes from where the copy has got to. */
  const fill = (template: Template, dropCap = false): { slices: Slice[]; took: number } => {
    const slices: Slice[] = [];
    let took = 0;
    for (const [index, box] of template.boxes.entries()) {
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
    const { slices } = fill(template, options.dropCap);
    pages.push({
      id: `${template.id}-${pages.length}`,
      template: template.id,
      plates: options.plates ?? nextPlates(template.plates),
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
    let chosen: Template | null = null;
    for (let step = 0; step < BODY_CYCLE.length; step++) {
      const candidate = TEMPLATES[BODY_CYCLE[(cycle + step) % BODY_CYCLE.length]!];
      // Skip any layout wanting more photographs than are left, rather than
      // printing one twice.
      if (candidate.plates > pool.length) continue;
      cycle = (cycle + step + 1) % BODY_CYCLE.length;
      chosen = candidate;
      break;
    }

    const template = chosen ?? TEMPLATES["two-column"];
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
  if (pages.length % 2 !== 0) add(TEMPLATES.blank);
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
