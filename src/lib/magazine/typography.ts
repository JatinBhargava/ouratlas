import type { CopyStyle } from "@/lib/magazine/copy";

/**
 * The type a reader may choose for their own pages.
 *
 * Nothing here is downloaded. The site serves one face from its own origin and
 * asks nothing of a third party, so these are stacks of what the machine
 * already has — which is also why each one lists a fallback for macOS, Windows
 * and Linux in turn. A face that is absent on one of them would not merely
 * look different; it would measure differently, and the pages would break in
 * other places.
 */

export type FaceId =
  | "editorial"
  | "oldstyle"
  | "transitional"
  | "grotesque"
  | "system"
  | "typewriter"
  | "condensed";

export type Face = {
  name: string;
  stack: string;
  /** Weight display type is set at. Body copy always takes the face as it comes. */
  weight: string;
  /** Tracking on display type. Large grotesques need pulling in; a serif does not. */
  tracking: string;
  /** False where the face is only fit for headlines. */
  body: boolean;
};

export const FACES: Record<FaceId, Face> = {
  editorial: {
    name: "Editorial serif",
    stack: "var(--font-editorial), ui-serif, Georgia, serif",
    weight: "400",
    tracking: "normal",
    // The house display face has one weight and a high contrast; a page of it
    // at nine pixels is a headline repeated, not a text.
    body: false,
  },
  oldstyle: {
    name: "Old-style serif",
    stack: 'Georgia, ui-serif, "Times New Roman", serif',
    weight: "700",
    tracking: "-0.01em",
    body: true,
  },
  transitional: {
    name: "Transitional serif",
    stack: '"Times New Roman", ui-serif, Georgia, serif',
    weight: "700",
    tracking: "-0.015em",
    body: true,
  },
  grotesque: {
    name: "Grotesque",
    stack: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
    weight: "700",
    tracking: "-0.03em",
    body: true,
  },
  system: {
    name: "Humanist sans",
    stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    weight: "600",
    tracking: "-0.01em",
    body: true,
  },
  typewriter: {
    name: "Typewriter",
    stack: '"Courier New", ui-monospace, "DejaVu Sans Mono", monospace',
    weight: "700",
    tracking: "normal",
    body: true,
  },
  condensed: {
    name: "Condensed display",
    stack: '"Haettenschweiler", "Impact", "Arial Narrow Bold", "Liberation Sans Narrow", sans-serif',
    weight: "400",
    tracking: "-0.02em",
    body: false,
  },
};

export const FACE_IDS = Object.keys(FACES) as FaceId[];
export const BODY_FACES = FACE_IDS.filter(id => FACES[id].body);

export type Alignment = "justify" | "left";

export type TypeChoice = {
  /** Headlines, kickers, folios and the drop cap. */
  display: FaceId;
  /** Body copy. */
  body: FaceId;
  /** Body size in page pixels. */
  size: number;
  /** Body leading, as a multiple of the size. */
  leading: number;
  align: Alignment;
};

/** What the sliders will allow. */
export const SIZE = { min: 7, max: 12, step: 0.5 } as const;
export const LEADING = { min: 1.15, max: 2, step: 0.05 } as const;

export const DEFAULT_TYPE: TypeChoice = {
  display: "editorial",
  body: "oldstyle",
  size: 10,
  leading: 1.62,
  align: "justify",
};

/** A choice held inside what the controls allow, whatever it arrived as. */
export function clampType(type: TypeChoice): TypeChoice {
  const hold = (value: number, { min, max }: { min: number; max: number }) =>
    Math.min(max, Math.max(min, value));
  return {
    display: FACES[type.display] ? type.display : DEFAULT_TYPE.display,
    body: FACES[type.body]?.body ? type.body : DEFAULT_TYPE.body,
    size: hold(type.size, SIZE),
    leading: hold(type.leading, LEADING),
    align: type.align === "left" ? "left" : "justify",
  };
}

/**
 * The choice as the parts of a surface it replaces.
 *
 * Deliberately shaped as the fields it overrides rather than as a whole
 * Surface, so it can be spread over any theme's surface — the reader's own
 * theme today, and any other that wanted to offer this later — without
 * carrying paper and ink it has no opinion about.
 *
 * `copy` is the half of this that the fitter must also be given. Everything
 * else is colour and headline type, which changes no measurement.
 */
export function surfaceOf(type: TypeChoice): {
  display: string;
  displayWeight: string;
  displayTracking: string;
  copy: CopyStyle;
} {
  const held = clampType(type);
  return {
    display: FACES[held.display].stack,
    displayWeight: FACES[held.display].weight,
    displayTracking: FACES[held.display].tracking,
    copy: {
      fontFamily: FACES[held.body].stack,
      fontSize: `${held.size}px`,
      lineHeight: String(held.leading),
      textAlign: held.align,
    },
  };
}
