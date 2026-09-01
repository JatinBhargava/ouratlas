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

/** Space between paragraphs. The first in a box never gets it. */
const PARAGRAPH_CLASS = "mt-[0.75em] first:mt-0";

/**
 * A true drop cap on the opening paragraph of the feature: the letter floats
 * and the copy sets around it.
 */
const DROP_CAP_CLASS =
  "[&::first-letter]:font-editorial [&::first-letter]:float-left [&::first-letter]:mr-[3px] [&::first-letter]:pt-[2px] [&::first-letter]:text-[30px] [&::first-letter]:leading-[0.76] [&::first-letter]:text-stone-900";

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

/** Markup for a slice. Used to measure it and, later, to draw it. */
export function paragraphsHtml(slice: Slice, options: { dropCap?: boolean } = {}): string {
  return slice.lines
    .map((line, i) => {
      const dropCap = i === 0 && options.dropCap && !line.continued;
      const className = dropCap ? `${PARAGRAPH_CLASS} ${DROP_CAP_CLASS}` : PARAGRAPH_CLASS;
      return `<p class="${className}">${escapeHtml(line.text)}</p>`;
    })
    .join("");
}
