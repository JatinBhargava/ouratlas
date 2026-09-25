import { riddleFor } from "@/lib/magazine/diversions";
import { fitBox } from "@/lib/magazine/fit";
import { isSpent, remaining, START, toParagraphs, wordCount, type Cursor, type Slice } from "@/lib/magazine/copy";
import { boxesFor, PLAIN, plateSize, STACK_GAP, TEMPLATES, type PlateBox, type Template } from "@/lib/magazine/templates";
import { COLUMN_WIDTH, GUTTER, TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";
import { buildArchetype, quoteSplit, textPage } from "@/lib/magazine/archetypes";

/**
 * Where the body of the issue begins: after the cover, the contents and the
 * opener. The editor plans pages from here, so this and the three `add` calls
 * that set those pages down have to agree.
 */
export const BODY_START = 3;
import { DEFAULT_THEME, THEMES, type ThemeId } from "@/lib/magazine/themes";
import {
  newBoxId,
  plateBoxes,
  quoteBoxes,
  textBoxes,
  type CustomDesign,
  type CustomLeaves,
  type CustomPage,
  type CustomSlot,
} from "@/lib/magazine/custom";
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
  /** Single pages redrawn on the proof, which win over the design for that page alone. */
  leaves?: CustomLeaves;
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
  leaves,
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
  // Pull quotes, dealt to quote boxes in order as photographs are to plates.
  // Only a designed issue carries any; every other theme has no box for them.
  const quotePool = theme === "custom" ? [...(custom?.quotes ?? [])] : [];
  let plateNumber = 0;

  // Fixed before anything is dealt: the pacing below measures progress against
  // the whole supply, and a shrinking denominator would make it accelerate.
  const supply = pool.length;

  const nextPlates = (count: number): Plate[] =>
    pool.splice(0, count).map(photo => ({ photo, label: `Plate ${roman(++plateNumber)}`, caption: photo.caption }));

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
  // Always asked about the page about to be added, so its index is simply
  // the number of pages set so far.
  const designFor = (id: Template["id"], index = pages.length): CustomPage | undefined => {
    const slot = SLOT_OF[id];
    if (!slot) return undefined;
    const own = leaves?.[index];
    return own && own.slot === slot ? own.page : custom?.[slot];
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

  /**
   * The last page of the story, made up to fit what is left of it.
   *
   * A drawn page is drawn for a full page of copy. On the page where the story
   * ends there is usually a paragraph or two, and poured into boxes sized for
   * twenty, it leaves a column standing empty and a hole under the picture —
   * the white space a designed issue should never have. So when a drawn page
   * with a photograph on it turns out to be the last, it is set again as a
   * closing page: the photograph across the full width, and the last words
   * beneath it in two columns cut to exactly the depth they need, found by
   * measuring rather than guessing.
   *
   * Returns null, with the cursor put back, when the page is full enough as it
   * is — the remainder is most of a page, and the drawn layout holds it well.
   */
  const closingPage = (start: Cursor, dropCap?: boolean): { layout: CustomPage; slices: Slice[] } | null => {
    // Two balanced columns for a real paragraph or more; for the last few
    // lines, one block across the full measure, so a short ending does not
    // sit in one column beside an empty one.
    const shapes = {
      wide: (depth: number) => [{ width: TEXT_WIDTH, height: depth }],
      columns: (depth: number) => [
        { width: COLUMN_WIDTH, height: depth },
        { width: COLUMN_WIDTH, height: depth },
      ],
    };
    const fitsIn = (shape: keyof typeof shapes, depth: number) => {
      cursor = start;
      fill(shapes[shape](depth), dropCap);
      return isSpent(paragraphs, cursor);
    };
    /** The shallowest depth that holds everything left, measured, or null if even a full page will not. */
    const shallowest = (shape: keyof typeof shapes): number | null => {
      let low = 12;
      let high = TEXT_HEIGHT;
      if (!fitsIn(shape, high)) return null;
      while (high - low > 2) {
        const mid = Math.floor((low + high) / 2);
        if (fitsIn(shape, mid)) high = mid;
        else low = mid;
      }
      // A line's grace, so rounding in the browser cannot push the last line off.
      return Math.min(TEXT_HEIGHT, high + 6);
    };

    // Up to about six lines reads well across the full width; past that the
    // measure is too long to follow and the text wants columns.
    const WIDE_LIMIT = 90;
    const wide = shallowest("wide");
    const shape: keyof typeof shapes = wide !== null && wide <= WIDE_LIMIT ? "wide" : "columns";
    const depth = shape === "wide" ? wide : shallowest("columns");
    cursor = start;
    if (depth === null) return null;

    const photo = TEXT_HEIGHT - depth - STACK_GAP;
    // Less than this and the page is mostly text already; leave it be.
    if (photo < 200) return null;

    const { slices } = fill(shapes[shape](depth), dropCap);
    const at = photo + STACK_GAP;
    const box = (kind: "text" | "plate", x: number, y: number, width: number, height: number) => ({
      id: newBoxId(),
      kind,
      x,
      y,
      width,
      height,
    });
    const words =
      shape === "wide"
        ? [box("text", 0, at, TEXT_WIDTH, depth)]
        : [box("text", 0, at, COLUMN_WIDTH, depth), box("text", COLUMN_WIDTH + GUTTER, at, COLUMN_WIDTH, depth)];
    return { layout: { boxes: [box("plate", 0, 0, TEXT_WIDTH, photo), ...words] }, slices };
  };

  /**
   * The last page of a designed issue whose photographs ran out before its
   * words: the remaining copy in two balanced columns, cut to the depth they
   * need, and a block of accent colour filling the rest of the leaf. Returns
   * null, with the cursor put back, when the copy fills most of the page
   * anyway — a full page of reading needs no ending made up for it.
   */
  const endingPage = (start: Cursor, dropCap?: boolean): { layout: CustomPage; slices: Slice[] } | null => {
    const columns = (depth: number) => [
      { width: COLUMN_WIDTH, height: depth },
      { width: COLUMN_WIDTH, height: depth },
    ];
    const fitsIn = (depth: number) => {
      cursor = start;
      fill(columns(depth), dropCap);
      return isSpent(paragraphs, cursor);
    };
    let low = 12;
    let high = TEXT_HEIGHT;
    if (!fitsIn(high)) {
      cursor = start;
      return null;
    }
    while (high - low > 2) {
      const mid = Math.floor((low + high) / 2);
      if (fitsIn(mid)) high = mid;
      else low = mid;
    }
    const depth = Math.min(TEXT_HEIGHT, high + 6);
    const block = TEXT_HEIGHT - depth - STACK_GAP;
    cursor = start;
    if (block < 150) return null;

    const { slices } = fill(columns(depth), dropCap);
    return {
      layout: {
        boxes: [
          { id: newBoxId(), kind: "text", x: 0, y: 0, width: COLUMN_WIDTH, height: depth },
          { id: newBoxId(), kind: "text", x: COLUMN_WIDTH + GUTTER, y: 0, width: COLUMN_WIDTH, height: depth },
          {
            id: newBoxId(),
            kind: "quote",
            x: 0,
            y: depth + STACK_GAP,
            width: TEXT_WIDTH,
            height: block,
            tone: "accent",
            signOff: quotePool.length === 0,
          },
        ],
      },
      slices,
    };
  };

  const add = (template: Template, options: { plates?: Plate[]; dropCap?: boolean } = {}) => {
    const index = pages.length;

    // The plate is settled before the copy is poured, because on these layouts
    // the plate is what decides how much room the copy has.
    const plate = plateSize(template.id, plateSizes?.[index]);
    let design = designFor(template.id);
    // A drawn page wants photographs the pool may no longer have. Rather than
    // print empty frames — grey holes in the middle of a feature — it is set
    // with what there is: a single photograph over two columns when one is
    // left for a page that wanted more; once they are gone, text broken by a
    // pull quote while quotes last, and plain columns after that.
    if (design && !options.plates && plateBoxes(design).length > pool.length) {
      design = {
        boxes: pool.length > 0 ? buildArchetype("hero-top", 0.45) : quotePool.length > 0 ? quoteSplit() : textPage(),
      };
    }
    // More quote boxes than quotes left: the spare boxes are set as text, so
    // a band meant for a pull quote carries the story on rather than printing
    // as an empty block of colour.
    if (design && quoteBoxes(design).length > quotePool.length) {
      const spare = new Set(quoteBoxes(design).slice(quotePool.length).map(b => b.id));
      design = {
        ...design,
        boxes: design.boxes.map(b => (spare.has(b.id) ? { ...b, kind: "text" as const, tone: undefined } : b)),
      };
    }
    // A drawn page brings its own boxes; every other layout derives them.
    const boxes = design ? textBoxes(design) : boxesFor(template.id, plate);
    const start = cursor;
    let { slices } = fill(boxes, options.dropCap);

    // The story ended on a drawn page: make that page up to fit. Not on a page
    // the reader redrew by hand on the proof — that one is theirs as drawn.
    const redrawn = leaves?.[index]?.hand === true;
    // The story ended on a page of plain text in a designed issue — the
    // photographs ran out first. Its last few lines would stand at the head of
    // an otherwise empty leaf, so the page is made up as an ending: the words
    // in balanced columns, and the rest of the leaf a block of the issue's
    // accent carrying one last pull quote, or the title as a sign-off.
    let ending: string | null = null;
    if (design && !redrawn && theme === "custom" && isSpent(paragraphs, cursor) && plateBoxes(design).length === 0) {
      const closing = endingPage(start, options.dropCap);
      if (closing) {
        design = closing.layout;
        slices = closing.slices;
        ending = quotePool.shift() ?? title.trim();
      } else {
        cursor = start;
        ({ slices } = fill(boxes, options.dropCap));
      }
    }
    if (design && !redrawn && isSpent(paragraphs, cursor) && plateBoxes(design).length > 0 && pool.length > 0) {
      const closing = closingPage(start, options.dropCap);
      if (closing) {
        design = closing.layout;
        slices = closing.slices;
      } else {
        cursor = start;
        ({ slices } = fill(boxes, options.dropCap));
      }
    }

    pages.push({
      id: `${template.id}-${index}`,
      index,
      template: template.id,
      // Counted from the boxes actually on the page, which a closing page has
      // fewer of than the design it replaced.
      plates: options.plates ?? nextPlates(design ? plateBoxes(design).length : platesWanted(template)),
      plate,
      slices,
      folio: null,
      dropCap: options.dropCap,
      // Kept on the page so the drawn issue survives the design being edited
      // underneath it.
      layout: design,
      // Dealt from the final layout, so a page made up to close the story —
      // which has no quote box — takes none. A bleed takes one to set over
      // its picture when there is one to spare.
      quotes: ending !== null ? [ending] : design ? quotePool.splice(0, design.bleed ? 1 : quoteBoxes(design).length) : undefined,
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
      const photosBefore = pool.length;
      add(next);
      // A page that took neither copy nor a photograph would repeat for ever.
      // A full-bleed picture takes no copy and is still a page; one with no
      // boxes at all, or boxes too small for a word, is not.
      if (remaining(paragraphs, cursor) === before && pool.length === photosBefore) break;
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
  // Listed by caption where the editor wrote one: "The gull, and my pastry"
  // is a contents line; "Plate IV" is an inventory.
  const entries = pages.flatMap(page =>
    page.folio === null ? [] : page.plates.map(plate => ({ label: plate.caption ?? plate.label, folio: page.folio! })),
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
    palette: theme === "custom" ? custom?.palette : undefined,
  };
}
