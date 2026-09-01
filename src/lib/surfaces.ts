/**
 * Shared card treatment. Every panel that floats over the scene uses these so
 * the page reads as one surface system rather than a pile of one-off cards.
 */

/** Frosted panel sitting on the illustrated background. */
export const SURFACE = "border-white/50 bg-white/85 backdrop-blur-md";

/** Adds a lift on pointer hover, held back for reduced-motion readers. */
export const SURFACE_LIFT =
  "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Tinted tile behind a section icon. */
export const ICON_TILE = "flex size-10 items-center justify-center rounded-xl bg-emerald-700/10 text-emerald-800";
