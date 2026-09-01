/**
 * The page grid, in CSS pixels at scale 1.
 *
 * Every number here is shared by the fitter and the renderer. Text is measured
 * against these boxes before it is drawn, so if the two ever disagreed a page
 * would silently overflow — hence one module, imported by both.
 */
export const PAGE = { width: 520, height: 693 } as const;

/** Trim margin on all four sides. */
export const MARGIN = 40;

/** Space between the two text columns. */
export const GUTTER = 18;

/** Strip at the foot of the page reserved for the folio. */
export const FOLIO = 22;

export const TEXT_WIDTH = PAGE.width - MARGIN * 2;
export const TEXT_HEIGHT = PAGE.height - MARGIN * 2 - FOLIO;
export const COLUMN_WIDTH = (TEXT_WIDTH - GUTTER) / 2;

/** Height of a caption line under a plate, so plates can leave room for one. */
export const CAPTION = 16;
