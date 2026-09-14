import { domToCanvas } from "modern-screenshot";

import { PAGE } from "@/lib/magazine/geometry";
import { writePdf, type JpegLeaf } from "@/lib/magazine/pdf";

/**
 * Pixels drawn per CSS pixel. 3 is 288 dpi at the page's printed size: body
 * type stays crisp when the PDF is zoomed on a phone, and a ten-plate issue is
 * still a file a messaging app will send. Every leaf is one whole canvas in
 * memory while it is drawn, so this is the knob to turn down if long issues fail.
 */
const SCALE = 3;
const QUALITY = 0.9;

/** What `::first-letter` accepts, per CSS Pseudo-Elements. Anything else set on it is ignored anyway. */
const FIRST_LETTER = /^(font|color|background|margin|padding|border|float|line-height|letter-spacing|word-spacing|vertical-align|text-(decoration|transform|shadow))/;

/**
 * Whether the print dialog will make sheets the size the stylesheet asks for.
 *
 * Desktop browsers honour `@page { size }`, so their "Save as PDF" comes out at
 * 1:1. Phones do not. Android hands printing to the system print framework,
 * which picks the paper itself (Letter or A4) and centres the page on it at
 * actual size; iOS prints through its own sheet onto paper of its choosing.
 * There is no feature to test for — the dialog is out of the page's reach — so
 * this goes by platform.
 *
 * Tablets count too: an Android tablet prints through the same framework as a
 * phone, which is why this is not `navigator.userAgentData.mobile`.
 */
export function printHonoursPageSize(): boolean {
  const agent = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/.test(agent)) return false;
  // iPadOS asks for desktop sites and so calls itself a Mac; only a touch screen gives it away.
  return !(/Macintosh/.test(agent) && navigator.maxTouchPoints > 1);
}

/**
 * Draws every leaf to a JPEG and binds them into a PDF at the magazine's size.
 *
 * modern-screenshot has the browser draw each leaf itself, by cloning it into
 * an SVG `foreignObject`, where html2canvas would re-draw the page piece by
 * piece with its own renderer. That matters twice here: html2canvas cannot
 * parse the `oklch()` colours Tailwind 4 emits, and a second renderer would
 * undo the fitter's promise that the text it measured is the text drawn.
 *
 * One leaf at a time, never all at once: a 96-page issue drawn in parallel is
 * 96 full-resolution canvases alive together, which a phone will not survive.
 */
export async function pressPdf(leaves: HTMLElement[], title: string): Promise<Blob> {
  // The display face loads with `font-display: swap`. Drawn before it lands, a
  // headline would be set in the fallback — and a different face measures differently.
  await document.fonts.ready;

  const drawn: JpegLeaf[] = [];
  for (const leaf of leaves) {
    const letters = tagFirstLetters(leaf);
    try {
      const canvas = await domToCanvas(leaf, {
        scale: SCALE,
        backgroundColor: "#ffffff",
        onCreateForeignObjectSvg: svg => {
          if (!letters.css) return;
          const style = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style");
          style.append(letters.css);
          // First, which is where modern-screenshot puts its own `::before` and `::after` rules.
          svg.prepend(style);
        },
      });
      drawn.push({ bytes: await jpegOf(canvas), width: canvas.width, height: canvas.height });
      // Give the backing store back now, not whenever the collector gets round to it.
      canvas.width = 0;
      canvas.height = 0;
    } finally {
      letters.untag();
    }
  }

  // CSS pixels are 1/96 inch and PDF points 1/72, so a point is 4/3 of a pixel:
  // 520 × 693 comes out 390 × 519.75, the same sheet the print stylesheet asks for.
  return writePdf(drawn, { width: PAGE.width * 0.75, height: PAGE.height * 0.75 }, title);
}

/**
 * Carries `::first-letter` into the capture, which does not do it on its own.
 *
 * modern-screenshot rebuilds `::before` and `::after` from their computed
 * style but not `::first-letter`, and the feature's drop cap is one. Losing it
 * loses more than a look: the fitter measured the opening lines set around a
 * floated letter, and drawn without one they break somewhere else.
 *
 * So each paragraph with a styled first letter is tagged on the live page, the
 * letter's computed style is written out as a rule for that tag, and the rule
 * goes into the SVG beside the library's own. The clone keeps the tag because
 * it copies attributes. Computed values rather than the drop cap's Tailwind
 * classes, so a theme that restyles the letter comes through as it was drawn.
 */
function tagFirstLetters(leaf: HTMLElement): { css: string; untag: () => void } {
  const tagged: HTMLElement[] = [];
  const rules: string[] = [];

  for (const paragraph of Array.from(leaf.querySelectorAll<HTMLElement>("p"))) {
    const letter = getComputedStyle(paragraph, "::first-letter");
    if (letter.float === "none" && letter.fontSize === getComputedStyle(paragraph).fontSize) continue;

    const id = String(tagged.length);
    paragraph.dataset.firstLetter = id;
    tagged.push(paragraph);

    const declarations: string[] = [];
    for (let index = 0; index < letter.length; index++) {
      const name = letter.item(index);
      if (FIRST_LETTER.test(name)) declarations.push(`${name}: ${letter.getPropertyValue(name)};`);
    }
    rules.push(`[data-first-letter="${id}"]::first-letter { ${declarations.join(" ")} }`);
  }

  return {
    css: rules.join("\n"),
    untag: () => tagged.forEach(paragraph => delete paragraph.dataset.firstLetter),
  };
}

/**
 * Hands the PDF over as a download.
 *
 * The object URL is kept for a minute rather than revoked on the spot: the
 * download reads the blob after `click()` returns, on its own schedule, and a
 * URL revoked first is a download that fails with nothing to show for it.
 */
export function saveIssue(pdf: Blob, title: string) {
  const url = URL.createObjectURL(pdf);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameOf(title);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * `atlas-kodaikanal.pdf`. Letters and their marks from any script are kept —
 * without `\p{M}` a Tamil or Hindi title would lose every vowel sign to a hyphen.
 */
function fileNameOf(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `atlas-${slug || "issue"}.pdf`;
}

/** `toBlob` hands back null when the canvas is too large to encode — on a phone, the likeliest failure. */
function jpegOf(canvas: HTMLCanvasElement): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error("A page could not be encoded."));
        blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
      },
      "image/jpeg",
      QUALITY,
    );
  });
}
