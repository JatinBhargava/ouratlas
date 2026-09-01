import type { Slice } from "@/lib/magazine/copy";
import type { TemplateId } from "@/lib/magazine/templates";
import type { Photo } from "@/types";

/** A photograph as it appears in the issue, with the label printed beside it. */
export type Plate = { photo: Photo; label: string };

/** One printed page, with its copy already fitted to its boxes. */
export type Page = {
  id: string;
  template: TemplateId;
  plates: Plate[];
  /** One slice per text box on the template, in reading order. */
  slices: Slice[];
  /** Printed page number, or null on the cover. */
  folio: number | null;
  /** Only the opening page of the feature takes a drop cap. */
  dropCap?: boolean;
  /** Contents entries, filled in once every plate has a folio. */
  entries?: { label: string; folio: number }[];
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
