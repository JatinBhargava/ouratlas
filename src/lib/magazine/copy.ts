/**
 * The typography of body copy, and the one function that turns a slice of the
 * story into markup.
 *
 * The fitter and the page renderer both go through `paragraphsHtml`, so the
 * text that was measured is byte-for-byte the text that gets drawn. Splitting
 * these into two code paths is how pages start overflowing by a line.
 */

/** Type styling for a column of body copy. */
export const COPY_CLASS = "hyphens-auto text-justify text-[10px] leading-[1.62] text-stone-700";

/**
 * What a theme may change about the body face.
 *
 * Applied to the column that is drawn *and* to the off-screen box the fitter
 * measures in — they have to be the same values in both places, or the
 * measurement is of one typeface and the page is set in another, which shows
 * up as a line hanging off the foot of a page.
 *
 * Everything is optional and absent means "leave the house style alone", so a
 * theme that only rearranges rectangles carries none of this.
 */
export type CopyStyle = {
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
  textAlign?: "left" | "right" | "center" | "justify";
};

/**
 * Every property `CopyStyle` can set.
 *
 * The fitter measures in one long-lived node, so each call has to clear what
 * the last theme put there. Iterating this list is what makes "unset" a state
 * the measuring box can actually return to.
 */
export const COPY_STYLE_KEYS = [
  "fontFamily",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "color",
] as const;

/** Space between paragraphs. The first in a box never gets it. */
const PARAGRAPH_CLASS = "mt-[0.75em] first:mt-0";

/**
 * A true drop cap on the opening paragraph of the feature: the letter floats
 * and the copy sets around it.
 */
const DROP_CAP_CLASS =
  "[&::first-letter]:[font-family:var(--display-font,var(--font-editorial))] [&::first-letter]:float-left [&::first-letter]:mr-[3px] [&::first-letter]:pt-[2px] [&::first-letter]:text-[30px] [&::first-letter]:leading-[0.76] [&::first-letter]:text-[color:var(--ink,var(--color-stone-900))]";

/** One paragraph, or the tail of one carried over from the previous box. */
export type Line = { text: string; continued: boolean };

/** The run of copy that fills a single text box. */
export type Slice = { lines: Line[] };

/** A position in the story: which paragraph, and how far into it. */
export type Cursor = { paragraph: number; word: number };

export const START: Cursor = { paragraph: 0, word: 0 };

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, char => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

/** Splits the story on blank lines, then on whitespace. */
export function toParagraphs(story: string): string[][] {
  return story
    .split(/\n\s*\n/)
    .map(block => block.trim().split(/\s+/).filter(Boolean))
    .filter(words => words.length > 0);
}

export const wordCount = (paragraphs: string[][]) => paragraphs.reduce((n, words) => n + words.length, 0);

/** True once the cursor has walked off the end of the story. */
export const isSpent = (paragraphs: string[][], cursor: Cursor) => cursor.paragraph >= paragraphs.length;

/**
 * Takes `count` words from `cursor`, stopping at the end of the story. Returns
 * the slice, where the cursor lands, and how many words were actually taken —
 * which is less than `count` at the very end.
 */
export function take(
  paragraphs: string[][],
  cursor: Cursor,
  count: number,
): { slice: Slice; next: Cursor; taken: number } {
  const lines: Line[] = [];
  let { paragraph, word } = cursor;
  let taken = 0;

  while (taken < count && paragraph < paragraphs.length) {
    const source = paragraphs[paragraph]!;
    const end = Math.min(source.length, word + (count - taken));
    lines.push({ text: source.slice(word, end).join(" "), continued: word > 0 });
    taken += end - word;

    if (end < source.length) {
      word = end;
      break;
    }
    paragraph += 1;
    word = 0;
  }

  return { slice: { lines }, next: { paragraph, word }, taken };
}

/** How many words are left from here to the end. */
export function remaining(paragraphs: string[][], cursor: Cursor): number {
  if (cursor.paragraph >= paragraphs.length) return 0;
  let total = paragraphs[cursor.paragraph]!.length - cursor.word;
  for (let i = cursor.paragraph + 1; i < paragraphs.length; i++) total += paragraphs[i]!.length;
  return total;
}

/**
 * Full stops and ampersands lifted into the accent colour.
 *
 * A whole magazine of black type with one warm mark at the end of every
 * sentence — the device is small enough to be missed on one line and
 * unmistakable down a column.
 *
 * A `<span>` carrying nothing but a colour occupies exactly the space the
 * character did, so this cannot move a line, and the fitter is free to
 * measure the same markup without caring what is inside it. It has to *be*
 * the same markup, though, which is why this is an option on the shared
 * function rather than something the renderer does afterwards.
 */
const inkPunctuation = (html: string) =>
  html.replace(/[.&]/g, char => `<span style="color:var(--ink-accent)">${char}</span>`);

/** Markup for a slice. Used to measure it and, later, to draw it. */
export function paragraphsHtml(
  slice: Slice,
  options: { dropCap?: boolean; punctuation?: boolean } = {},
): string {
  return slice.lines
    .map((line, i) => {
      const dropCap = i === 0 && options.dropCap && !line.continued;
      const className = dropCap ? `${PARAGRAPH_CLASS} ${DROP_CAP_CLASS}` : PARAGRAPH_CLASS;
      // Escaped first, so the spans are wrapped around real punctuation and
      // never around the `&` of an entity this just produced.
      const text = escapeHtml(line.text);
      return `<p class="${className}">${options.punctuation ? inkPunctuation(text) : text}</p>`;
    })
    .join("");
}
