import {
  COPY_CLASS,
  COPY_STYLE_KEYS,
  paragraphsHtml,
  remaining,
  take,
  type CopyStyle,
  type Cursor,
  type Slice,
} from "@/lib/magazine/copy";

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

/**
 * Dresses the measuring box in the theme's type.
 *
 * Every key is written on every call, blank where the theme says nothing, so
 * the node cannot carry a previous theme's face into this measurement.
 *
 * `--display-font` is set alongside the body overrides because of the drop
 * cap: it is the one piece of display type that sits *inside* a measured box
 * and pushes the copy around it. The measuring box lives on `document.body`,
 * outside the leaf that declares the variable, so without this line the cap
 * would be measured in the house serif and drawn in the theme's face — and
 * the opener would wrap a line short or a line long.
 */
function wear(box: HTMLDivElement, style: CopyStyle | undefined, display: string | undefined) {
  for (const key of COPY_STYLE_KEYS) box.style[key] = style?.[key] ?? "";
  if (display) box.style.setProperty("--display-font", display);
  else box.style.removeProperty("--display-font");
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
  options: { dropCap?: boolean; punctuation?: boolean; copy?: CopyStyle; display?: string } = {},
): { slice: Slice; next: Cursor; taken: number } {
  const left = remaining(paragraphs, cursor);
  if (left === 0) return { slice: { lines: [] }, next: cursor, taken: 0 };

  const box = measurer();
  box.style.width = `${width}px`;
  wear(box, options.copy, options.display);

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
