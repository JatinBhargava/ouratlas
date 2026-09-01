import { COPY_CLASS, paragraphsHtml, remaining, take, type Cursor, type Slice } from "@/lib/magazine/copy";

/**
 * Works out how much of the story fits in a text box by rendering candidates
 * off-screen and reading their height. Guessing from a words-per-column average
 * is close but never exact, and "close" shows up as a line hanging off the
 * bottom of a page.
 */

let host: HTMLDivElement | null = null;

/**
 * The off-screen box copy is measured in. `flow-root` stops the first child's
 * top margin collapsing out of the box, which would under-report the height.
 */
function measurer(): HTMLDivElement {
  if (host?.isConnected) return host;
  host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.className = COPY_CLASS;
  host.style.cssText =
    "position:absolute;left:-10000px;top:0;visibility:hidden;display:flow-root;contain:content;pointer-events:none";
  document.body.appendChild(host);
  return host;
}

/** Releases the measuring node. Safe to call when one was never made. */
export function disposeMeasurer() {
  host?.remove();
  host = null;
}

/** Words per box is well under this even for a full page of small type. */
const CEILING = 700;

/**
 * The largest slice of the story starting at `cursor` that still fits inside
 * `width` × `height`. Binary search over the word count — about ten renders of
 * a small subtree per box, rather than one per word.
 */
export function fitBox(
  paragraphs: string[][],
  cursor: Cursor,
  width: number,
  height: number,
  options: { dropCap?: boolean } = {},
): { slice: Slice; next: Cursor; taken: number } {
  const left = remaining(paragraphs, cursor);
  if (left === 0) return { slice: { lines: [] }, next: cursor, taken: 0 };

  const box = measurer();
  box.style.width = `${width}px`;

  const fits = (count: number) => {
    box.innerHTML = paragraphsHtml(take(paragraphs, cursor, count).slice, options);
    return box.scrollHeight <= height;
  };

  let low = 0;
  let high = Math.min(left, CEILING);

  // The whole remainder fits — the last text page of the issue.
  if (fits(high)) {
    box.innerHTML = "";
    return take(paragraphs, cursor, high);
  }

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) low = middle;
    else high = middle - 1;
  }

  box.innerHTML = "";
  return take(paragraphs, cursor, low);
}
