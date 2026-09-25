/**
 * The issue as a carousel: every chosen page drawn as one image, in order,
 * ready to post.
 *
 * Made in the browser from the same leaves the PDF is drawn from, so nothing
 * leaves the reader's device until they choose where to send it — the share
 * sheet hands the files straight to the app they pick.
 */

import { PAGE } from "@/lib/magazine/geometry";
import type { Page } from "@/lib/magazine/types";
import { drawLeaf, jpegOf, releaseCanvas, slugOf } from "@/lib/magazine/press";

/**
 * Instagram's portrait size. It is 3:4, which is the page's own shape to
 * within a pixel (520 × 693), so a slide is the whole page with nothing
 * cropped off and no bars added.
 */
export const SLIDE = { width: 1080, height: 1440 };

/** The most pictures one Instagram carousel takes. */
const INSTAGRAM_MAX = 20;

/**
 * How many files Chrome (and every Chromium browser) lets one share carry.
 *
 * Asking does not find it out: `canShare` says yes to thirty, and then
 * `share` refuses anything past ten with a bare "Permission denied". So it is
 * written down here, and applies only where `userAgentData` says the browser
 * is Chromium — Safari takes a whole carousel in one go.
 */
const CHROMIUM_SHARE_MAX = 10;

/**
 * The most slides one carousel may have in this browser.
 *
 * The whole carousel goes out in a single share, never in batches, so it can
 * be no longer than the share sheet will carry: ten in Chromium, Instagram's
 * own twenty everywhere else.
 */
export function slidesMax(): number {
  return "userAgentData" in navigator ? CHROMIUM_SHARE_MAX : INSTAGRAM_MAX;
}

const QUALITY = 0.92;

/**
 * The pages a carousel starts with, when the issue has more than will fit.
 *
 * The cover always, then pages with a photograph or a pull quote on them,
 * then text, each group in the order it was printed, until the carousel is
 * full. A reader scrolling a feed stops for pictures, not for columns of
 * body copy. Handed back in issue order, which is the order the slides post in.
 */
export function defaultSlides(pages: Page[], max: number): Set<number> {
  if (pages.length <= max) return new Set(pages.map(page => page.index));
  const rank = (page: Page) => (page.folio === null ? 0 : page.plates.length > 0 || (page.quotes?.length ?? 0) > 0 ? 1 : 2);
  const picked = [...pages].sort((a, b) => rank(a) - rank(b) || a.index - b.index).slice(0, max);
  return new Set(picked.map(page => page.index));
}

/**
 * Draws each leaf to a JPEG at slide size, one at a time — the same reason
 * the PDF does, a phone will not hold twenty full canvases at once.
 */
export async function pressSlides(
  leaves: HTMLElement[],
  title: string,
  onSlide?: (done: number) => void,
): Promise<File[]> {
  await document.fonts.ready;
  // Freshly mounted leaves may still be decoding their photographs.
  await Promise.all(
    leaves.flatMap(leaf => [...leaf.querySelectorAll("img")].map(image => image.decode().catch(() => undefined))),
  );

  const stem = slugOf(title);
  const width = String(leaves.length).length < 2 ? 2 : String(leaves.length).length;
  const files: File[] = [];

  for (const [n, leaf] of leaves.entries()) {
    const drawn = await drawLeaf(leaf, SLIDE.width / PAGE.width);
    // Drawn at the page's 520 × 693 it comes out a pixel short of 1440 high;
    // laid on an exact canvas so every slide is the size the app expects.
    const slide = document.createElement("canvas");
    slide.width = SLIDE.width;
    slide.height = SLIDE.height;
    slide.getContext("2d")!.drawImage(drawn, 0, 0, SLIDE.width, SLIDE.height);
    releaseCanvas(drawn);

    const blob = await jpegOf(slide, QUALITY);
    releaseCanvas(slide);
    files.push(new File([blob], `${stem}-${String(n + 1).padStart(width, "0")}.jpg`, { type: "image/jpeg" }));
    onSlide?.(n + 1);
  }

  return files;
}

/**
 * Whether this browser can hand all the slides to the share sheet at once.
 * False means files cannot be shared here at all, and the download is the way out.
 */
export function canShareSlides(files: File[]): boolean {
  return files.length > 0 && typeof navigator.canShare === "function" && navigator.canShare({ files });
}

/**
 * Opens the share sheet with `files`, and nothing else.
 *
 * No title or text alongside: several apps given text and files together take
 * the text and drop the pictures. True when shared, false when the reader
 * closed the sheet, which is a choice and not a failure.
 */
export async function shareSlides(files: File[]): Promise<boolean> {
  try {
    await navigator.share({ files });
    return true;
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") return false;
    throw cause;
  }
}
