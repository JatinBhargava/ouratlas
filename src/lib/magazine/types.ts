import type { Slice } from "@/lib/magazine/copy";
import type { Riddle } from "@/lib/magazine/diversions";
import type { PlateBox, TemplateId } from "@/lib/magazine/templates";
import type { Photo } from "@/types";

/** A photograph as it appears in the issue, with the label printed beside it. */
export type Plate = { photo: Photo; label: string };

/** One printed page, with its copy already fitted to its boxes. */
export type Page = {
  id: string;
  /**
   * Where this page sits in the issue.
   *
   * How a resized plate is addressed: the reader pulls the plate on page 9,
   * and the height is recorded against 9 rather than against the page object,
   * which is thrown away and rebuilt on every recomposition.
   */
  index: number;
  template: TemplateId;
  plates: Plate[];
  /** Size this page's plate was fitted and drawn at. Zeroes where it has none. */
  plate: PlateBox;
  /** One slice per text box on the template, in reading order. */
  slices: Slice[];
  /** Printed page number, or null on the cover. */
  folio: number | null;
  /** Only the opening page of the feature takes a drop cap. */
  dropCap?: boolean;
  /** Contents entries, filled in once every plate has a folio. */
  entries?: { label: string; folio: number }[];
  /**
   * The riddle on the blank leaf, chosen when the issue went to press.
   *
   * Held on the page rather than looked up while drawing, so it survives every
   * recomposition the reader's dragging causes and cannot change under them.
   */
  riddle?: Riddle;
};

/** A composed issue, ready to draw. */
export type Issue = {
  title: string;
  dateline: string;
  pages: Page[];
  words: number;
  /** Copy that would not fit in the pages composed. Should be zero. */
  overflowWords: number;
  /** Whether the copy went through the copy desk, which the colophon states. */
  polished: boolean;
};
