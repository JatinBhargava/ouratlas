import { buildPage } from "@/lib/magazine/archetypes";
import { newBoxId, type CustomBox, type CustomKind, type CustomPage } from "@/lib/magazine/custom";
import { GUTTER, TEXT_HEIGHT, TEXT_WIDTH } from "@/lib/magazine/geometry";
import { STACK_GAP } from "@/lib/magazine/templates";
import { cleanGrid, type EditorGrid, type EditorPage, type GridBand, type GridCell, type GridCellKind } from "@/types";

/**
 * Pages the editor draws itself, as grids.
 *
 * The editor once chose every page from fourteen fixed layouts, and every issue
 * it made looked like the last. Now it draws each page: a first cut into bands
 * (rows or columns), each band cut the other way into cells. Proportions are
 * the editor's; edges are the magazine's. Every column edge lands on a six-
 * column grid over the text area, every gap is the house gutter or stack gap,
 * and every cell keeps the size its job needs, so whatever shape is asked for
 * fills the page edge to edge, with straight margins and nothing overlapping —
 * the promise the fixed layouts kept, without their sameness.
 */

const COLUMNS = 6;
const UNIT = (TEXT_WIDTH - (COLUMNS - 1) * GUTTER) / COLUMNS;
const spanWidth = (span: number) => span * UNIT + (span - 1) * GUTTER;
const columnX = (start: number) => start * (UNIT + GUTTER);

/**
 * The fewest grid columns a cell may have. Text half the page wide is a house
 * column; narrower, a line holds three or four words and reads as a list.
 */
const MIN_SPAN: Record<GridCellKind, number> = { text: 3, photo: 2, quote: 2, color: 1 };
/**
 * The least depth a cell may have: a few lines of text, a picture that is
 * still a picture, a quote's two lines. A field of colour may be a bar.
 */
const MIN_DEPTH: Record<GridCellKind, number> = { text: 90, photo: 80, quote: 72, color: 14 };

const KIND: Record<GridCellKind, CustomKind> = { photo: "plate", text: "text", quote: "quote", color: "block" };

/**
 * Whole shares of `total` for `weights`, each at least its minimum: the
 * minimums first, the rest by weight, rounding by largest remainder so the
 * shares always add up exactly. Null when the minimums alone do not fit.
 */
function apportion(weights: number[], minimums: number[], total: number): number[] | null {
  const floor = minimums.reduce((sum, value) => sum + value, 0);
  if (floor > total) return null;
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const wanted = weights.map((weight, i) => Math.max(0, (weight / sum) * total - minimums[i]!));
  const wantedSum = wanted.reduce((acc, value) => acc + value, 0);
  const spare = total - floor;
  const exact = wanted.map(value => (wantedSum > 0 ? (value / wantedSum) * spare : spare / weights.length));
  const shares = exact.map(Math.floor);
  let left = spare - shares.reduce((acc, value) => acc + value, 0);
  const byRemainder = exact.map((value, i) => [value - Math.floor(value), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (left <= 0) break;
    shares[i]! += 1;
    left -= 1;
  }
  return shares.map((share, i) => share + minimums[i]!);
}

/**
 * Column spans for cells side by side. When text cells at a full house column
 * cannot all fit, they are let down to a third of the page before anything is
 * dropped; past that, cells are dropped from the end of the band.
 */
function spans(cells: GridCell[]): { cells: GridCell[]; spans: number[] } {
  let kept = cells;
  while (kept.length > 0) {
    for (const textMin of [MIN_SPAN.text, 2]) {
      const minimums = kept.map(cell => (cell.kind === "text" ? textMin : MIN_SPAN[cell.kind]));
      const shares = apportion(
        kept.map(cell => cell.size),
        minimums,
        COLUMNS,
      );
      if (shares) return { cells: kept, spans: shares };
    }
    kept = kept.slice(0, -1);
  }
  return { cells: [], spans: [] };
}

/** Depths for cells or bands stacked one above another, with the stack gap between them. */
function depths(sizes: number[], minimums: number[]): number[] {
  const total = TEXT_HEIGHT - (sizes.length - 1) * STACK_GAP;
  return apportion(sizes, minimums, total) ?? sizes.map(() => Math.floor(total / sizes.length));
}

const box = (cell: GridCell, x: number, y: number, width: number, height: number): CustomBox => ({
  id: newBoxId(),
  kind: KIND[cell.kind],
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
  ...(cell.kind === "quote" || cell.kind === "color" ? { tone: cell.tone } : {}),
});

/** A grid's boxes, in reading order: band by band, and through each band. */
export function buildGrid(grid: EditorGrid): CustomBox[] {
  const boxes: CustomBox[] = [];
  if (grid.split === "rows") {
    const bandDepths = depths(
      grid.bands.map(band => band.size),
      grid.bands.map(band => Math.max(...band.cells.map(cell => MIN_DEPTH[cell.kind]))),
    );
    let y = 0;
    grid.bands.forEach((band, b) => {
      const laid = spans(band.cells);
      let start = 0;
      laid.cells.forEach((cell, c) => {
        boxes.push(box(cell, columnX(start), y, spanWidth(laid.spans[c]!), bandDepths[b]!));
        start += laid.spans[c]!;
      });
      y += bandDepths[b]! + STACK_GAP;
    });
    return boxes;
  }

  // Columns: each band a vertical strip of whole grid columns, its cells stacked down it.
  const bandMinimums = grid.bands.map(band => Math.max(...band.cells.map(cell => MIN_SPAN[cell.kind])));
  let kept = grid.bands;
  let bandSpans = apportion(
    kept.map(band => band.size),
    bandMinimums,
    COLUMNS,
  );
  while (!bandSpans && kept.length > 1) {
    kept = kept.slice(0, -1);
    bandSpans = apportion(
      kept.map(band => band.size),
      bandMinimums.slice(0, kept.length),
      COLUMNS,
    );
  }
  if (!bandSpans) return boxes;
  let start = 0;
  kept.forEach((band, b) => {
    const cellDepths = depths(
      band.cells.map(cell => cell.size),
      band.cells.map(cell => MIN_DEPTH[cell.kind]),
    );
    let y = 0;
    band.cells.forEach((cell, c) => {
      boxes.push(box(cell, columnX(start), y, spanWidth(bandSpans![b]!), cellDepths[c]!));
      y += cellDepths[c]! + STACK_GAP;
    });
    start += bandSpans![b]!;
  });
  return boxes;
}

/**
 * A page the editor planned, as the desk draws it: its grid, the full-bleed
 * page, or — from a server that still sends the older form — a fixed layout.
 * Null for anything that cannot be drawn, which leaves that page to the
 * shared design rather than drawing it broken.
 */
export function editorPage(page: EditorPage): CustomPage | null {
  if (page.bleed) return buildPage("bleed", 1);
  const grid = cleanGrid(page.grid);
  if (!grid) return null;
  // On a dark page "paper" is the page itself, so a paper field would vanish; it takes the accent instead.
  const shaded = grid.stock === "ink"
    ? { ...grid, bands: grid.bands.map(band => ({ ...band, cells: band.cells.map(cell => (cell.kind === "color" && cell.tone === "paper" ? { ...cell, tone: "accent" as const } : cell)) })) }
    : grid;
  const boxes = buildGrid(shaded);
  return boxes.length > 0 ? { boxes, ...(grid.stock === "ink" ? { stock: "ink" as const } : {}) } : null;
}

/**
 * A page no one drew, invented: what fills an issue past the end of the
 * editor's own plan, so a long story never settles into the same few pages.
 *
 * Text-led, because by this point the photographs are mostly placed — but a
 * photograph cell turns up now and then (one with no picture left carries the
 * story on), and so do pull quotes, fields and bars of the issue's colours and
 * the odd page printed on ink. Every edge still comes from `buildGrid`, so an
 * invented page is held to the same grid as a drawn one. `previous` keeps two
 * pages in a row from being the same shape.
 */
export function inventGrid(random: () => number = Math.random, previous?: EditorGrid): EditorGrid {
  const pick = <T,>(options: readonly T[]) => options[Math.floor(random() * options.length)]!;
  const between = (low: number, high: number) => Math.round((low + random() * (high - low)) * 10) / 10;
  const tone = () => pick(["accent", "accent", "ink", "paper"] as const);
  const shape = (grid: EditorGrid) => `${grid.split}:${grid.bands.map(band => band.cells.map(cell => cell.kind).join("+")).join("/")}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const split = random() < 0.55 ? "rows" : ("columns" as const);
    const count = pick([1, 2, 2, 3, 3, 4]);
    const bands: GridBand[] = Array.from({ length: count }, () => {
      const cells: GridCell[] = Array.from({ length: pick([1, 2, 2, 3]) }, () => {
        const roll = random();
        const kind: GridCellKind = roll < 0.52 ? "text" : roll < 0.68 ? "quote" : roll < 0.84 ? "color" : "photo";
        // A field of colour is as often a stripe as a panel.
        const size = kind === "color" && random() < 0.5 ? between(0.06, 0.18) : between(0.6, 2.4);
        return { kind, size, tone: tone() };
      });
      return { size: between(0.5, 2.5), cells };
    });
    // The story has to go somewhere on every page.
    if (!bands.some(band => band.cells.some(cell => cell.kind === "text"))) bands[0]!.cells[0] = { kind: "text", size: 2, tone: "accent" };
    const grid = cleanGrid({ split, bands, ...(random() < 0.1 && previous?.stock !== "ink" ? { stock: "ink" } : {}) });
    if (grid && (!previous || shape(grid) !== shape(previous))) return grid;
  }
  return { split: "rows", bands: [{ size: 1, cells: [{ kind: "text", size: 1, tone: "accent" }, { kind: "text", size: 1, tone: "accent" }] }] };
}
