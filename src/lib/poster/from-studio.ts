import {
  FONTS,
  FONT_IDS,
  newId,
  photoBox,
  shapeBox,
  SHEET,
  textBox,
  type Box,
  type Filter,
  type Folio,
  type FontId,
  type PosterPage,
  type StudioOrigin,
  type TextBox,
} from "@/lib/poster/model";
import { pageDocument, slotOf, type StudioPage } from "@/lib/studio";

/**
 * An Atlas Studio layout, taken apart into Editor in Chief's boxes.
 *
 * The studio's pages are finished HTML; Editor in Chief's are boxes the
 * reader moves by hand. Rather than carry a page of HTML the editor could not
 * move a thing on, the layout is drawn once, off screen, at its own size, and
 * every piece of it is read back from the browser where it actually landed:
 * each run of words a text box in the face, size, spacing and colour it was
 * drawn in, each photograph a photo frame with its crop, each panel, rule and
 * gradient a shape. From then on it is an ordinary page — nothing about it is
 * special, and every box is the reader's to move, restyle or delete.
 *
 * Read, not parsed: the layouts style themselves through stylesheets,
 * inheritance and flexbox, and only the browser knows where any of it ends up.
 *
 * What the boxes cannot say is let go of rather than faked: box shadows,
 * blend modes, a paragraph's first-line indent. The page reads as the same
 * layout without them.
 */

/** The photo store id of a bundled sample photograph: one per picture, shared by every page that shows it. */
export const sampleId = (slot: string) => `studio-${slot}`;

/** Whether a Studio page is the sheet's shape. A two-page spread is not, and is not offered. */
export const fitsSheet = (page: StudioPage) => Math.abs(page.width / page.height - SHEET.width / SHEET.height) < 0.01;

/** A picture the converted page needs that is not a bundled sample: a drawing the layout made in SVG. */
export type Artwork = { id: string; file: File };

export type Converted = {
  page: PosterPage;
  /** Bundled sample pictures the page shows, by slot; the caller loads any it does not hold yet under `sampleId`. */
  samples: string[];
  artwork: Artwork[];
};

/* ---------------------------------------------------------- reading */

type Rgba = [number, number, number, number];

function rgba(value: string): Rgba | null {
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return null;
  const parts = match[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
}

const visible = (value: string) => {
  const parsed = rgba(value);
  return parsed ? parsed[3] > 0 : value !== "transparent" && value !== "";
};

/** A colour as the editor's colour fields write it, `#rrggbb` or `#rrggbbaa`; anything else is kept as the browser gave it. */
function hex(value: string): string {
  const parsed = rgba(value);
  if (!parsed) return value;
  const [r, g, b, a] = parsed;
  const two = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${two(r)}${two(g)}${two(b)}${a < 1 ? two(a * 255) : ""}`;
}

/** The turn in a computed `transform`, in degrees. */
function angleOf(transform: string): number {
  const match = transform.match(/^matrix\(([^)]+)\)$/);
  if (!match) return 0;
  const [a = 1, b = 0] = match[1]!.split(",").map(Number);
  return (Math.atan2(b, a) * 180) / Math.PI;
}

const px = (value: string) => Number.parseFloat(value) || 0;
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The family a stack is drawn in, as one of the editor's typefaces: the one
 * whose stack starts with the same face, or else a face of the same kind.
 */
function fontOf(stack: string): FontId {
  const families = stack.split(",").map(family => family.replace(/["']/g, "").trim().toLowerCase());
  const first = families[0] ?? "";
  const exact = FONT_IDS.find(id => FONTS[id].stack.split(",")[0]!.replace(/["']/g, "").trim().toLowerCase() === first);
  if (exact) return exact;
  const named: Record<string, FontId> = {
    "instrument serif": "editorial",
    "ui-serif": "georgia",
    "ui-sans-serif": "system",
    "system-ui": "system",
    "-apple-system": "system",
    arial: "helvetica",
    helvetica: "helvetica",
    times: "times",
    "ui-monospace": "mono",
    impact: "impact",
  };
  for (const family of families) if (named[family]) return named[family]!;
  if (families.includes("monospace")) return "mono";
  if (families.includes("serif")) return "georgia";
  return "system";
}

const WEIGHTS = [400, 700, 900] as const;
const weightOf = (value: string): TextBox["weight"] => {
  const weight = Number.parseInt(value, 10) || 400;
  return weight >= 800 ? 900 : weight >= 600 ? 700 : WEIGHTS[0];
};

function filterOf(value: string): Filter {
  if (value.includes("grayscale")) return "mono";
  if (value.includes("sepia")) return "sepia";
  return "none";
}

/** `object-position` or `background-position` as percentages; a length is read against the room the picture has to move. */
function focusOf(value: string, spare: { x: number; y: number }): { focusX: number; focusY: number } {
  const [x = "50%", y = "50%"] = value.split(" ");
  const axis = (part: string, room: number) => {
    if (part.endsWith("%")) return Number.parseFloat(part);
    if (part.endsWith("px") && room > 1) return Math.min(100, Math.max(0, (-Number.parseFloat(part) / room) * 100));
    return 50;
  };
  return { focusX: round(axis(x, spare.x)), focusY: round(axis(y, spare.y)) };
}

/**
 * A layout's page number: a short number on its own, or with a word such as
 * "Page" or "Scene" before it, set at the head or foot of the page. Contents
 * lists are numbers too, but they sit in the body of the page; an issue
 * number ("No. 03") is a different thing and keeps its number.
 */
const FOLIO = /^((?:page|p\.|pg\.?|scene|plate|folio)?[\s·—–\-|/.:]*)(\d{1,3})([\s·—–\-|/.:]*)$/i;

function folioOf(box: TextBox, drawnSize: number): Folio | undefined {
  const match = box.text.trim().match(FOLIO);
  if (!match || drawnSize > 24) return undefined;
  const nearEdge = box.y < SHEET.height * 0.13 || box.y + box.height > SHEET.height * 0.87;
  if (!nearEdge) return undefined;
  const digits = match[2]!;
  return { before: match[1]!, after: match[3]!, pad: digits.startsWith("0") ? digits.length : 1 };
}

/* ---------------------------------------------------------- drawing */

/** Draws the layout off screen at its own size and waits for its face and photographs, so what is read is what is drawn. */
async function draw(page: StudioPage): Promise<{ frame: HTMLIFrameElement; doc: Document }> {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${page.width}px`,
    height: `${page.height}px`,
    border: "0",
    pointerEvents: "none",
  });
  const loaded = new Promise<void>(resolve => frame.addEventListener("load", () => resolve(), { once: true }));
  frame.srcdoc = pageDocument(page);
  document.body.append(frame);
  await loaded;
  const doc = frame.contentDocument;
  if (!doc?.body) {
    frame.remove();
    throw new Error("That layout could not be opened.");
  }
  await doc.fonts.ready;
  await Promise.all(Array.from(doc.images).map(image => image.decode().catch(() => undefined)));
  return { frame, doc };
}

/* ------------------------------------------------------- converting */

type Inset = { top: number; right: number; bottom: number; left: number };
const NO_INSET: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Reads one layout into a page of boxes. The caller supplies where the page
 * came from, so the page after it can be the layout's next.
 */
export async function convertStudioPage(source: StudioPage, origin: StudioOrigin): Promise<Converted> {
  const { frame, doc } = await draw(source);
  try {
    const view = doc.defaultView!;
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) throw new Error("That layout is empty.");
    const k = SHEET.width / source.width;
    const origin0 = root.getBoundingClientRect();

    const boxes: Box[] = [];
    const samples = new Set<string>();
    const artwork: Artwork[] = [];

    /**
     * Where an element sits, as a box frame on the sheet. Measured from the
     * middle of what the browser drew and the element's own laid-out size, so
     * a turned element comes back as the same turn about the same centre,
     * which is how a box is turned. An inset takes padding or borders off a
     * side; on a turned element it is turned with it.
     */
    const place = (element: Element, rotation: number, inset: Inset = NO_INSET) => {
      const drawn = element.getBoundingClientRect();
      const width = (element instanceof view.HTMLElement ? element.offsetWidth : drawn.width) - inset.left - inset.right;
      const height = (element instanceof view.HTMLElement ? element.offsetHeight : drawn.height) - inset.top - inset.bottom;
      const turn = (rotation * Math.PI) / 180;
      const dx = (inset.left - inset.right) / 2;
      const dy = (inset.top - inset.bottom) / 2;
      const cx = drawn.left + drawn.width / 2 - origin0.left + dx * Math.cos(turn) - dy * Math.sin(turn);
      const cy = drawn.top + drawn.height / 2 - origin0.top + dx * Math.sin(turn) + dy * Math.cos(turn);
      return { x: round((cx - width / 2) * k), y: round((cy - height / 2) * k), width: round(width * k), height: round(height * k), rotation: round(rotation) };
    };

    const borders = (style: CSSStyleDeclaration) => {
      const side = (name: "Top" | "Right" | "Bottom" | "Left") =>
        style[`border${name}Style`] === "none" || !visible(style[`border${name}Color`]) ? 0 : px(style[`border${name}Width`]);
      return { top: side("Top"), right: side("Right"), bottom: side("Bottom"), left: side("Left") };
    };

    const radiusOf = (style: CSSStyleDeclaration, width: number, height: number) => {
      const value = style.borderTopLeftRadius;
      if (value.endsWith("%")) return { percent: Number.parseFloat(value), px: (Math.min(width, height) * Number.parseFloat(value)) / 100 };
      return { percent: 0, px: px(value) };
    };

    /** Panels, fills, gradients and rules: whatever an element draws behind its content. */
    const shapes = (element: HTMLElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      const color = visible(style.backgroundColor) ? hex(style.backgroundColor) : null;
      const gradient = style.backgroundImage.includes("gradient(") && !style.backgroundImage.includes("url(") ? style.backgroundImage : null;
      const edge = borders(style);
      const widths = [edge.top, edge.right, edge.bottom, edge.left];
      const uniform = widths.every(width => width > 0 && width === edge.top) && style.borderTopColor === style.borderLeftColor;
      const frameBox = place(element, rotation);
      const corner = radiusOf(style, element.offsetWidth, element.offsetHeight);
      const round50 = corner.percent >= 50 && Math.abs(element.offsetWidth - element.offsetHeight) < 2;
      const common = { ...frameBox, opacity, radius: round(corner.px * k), shape: round50 ? ("ellipse" as const) : ("rect" as const) };

      if (color || uniform) {
        boxes.push(
          shapeBox({
            ...common,
            id: newId("b"),
            fill: color ?? "transparent",
            borderWidth: uniform ? round(edge.top * k) : 0,
            borderColor: uniform ? hex(style.borderTopColor) : "#1b1a17",
          }),
        );
      }
      if (gradient) boxes.push(shapeBox({ ...common, id: newId("b"), fill: gradient, borderWidth: 0 }));
      if (!uniform) {
        // A rule: one side drawn on its own, as a thin bar along that edge.
        const w = element.offsetWidth;
        const h = element.offsetHeight;
        const sides: [number, string, Inset][] = [
          [edge.top, style.borderTopColor, { top: 0, right: 0, bottom: h - edge.top, left: 0 }],
          [edge.right, style.borderRightColor, { top: 0, right: 0, bottom: 0, left: w - edge.right }],
          [edge.bottom, style.borderBottomColor, { top: h - edge.bottom, right: 0, bottom: 0, left: 0 }],
          [edge.left, style.borderLeftColor, { top: 0, right: w - edge.left, bottom: 0, left: 0 }],
        ];
        for (const [width, sideColor, inset] of sides) {
          if (width > 0) boxes.push(shapeBox({ ...place(element, rotation, inset), id: newId("b"), opacity, fill: hex(sideColor), radius: 0, borderWidth: 0 }));
        }
      }
    };

    /**
     * A row or grid that mixes words of its own with boxes of its own — a
     * checklist line with its tick box — is not one run of words: each of
     * its pieces is laid out apart. Its words are placed where they fell
     * (`runs`), and its boxes are read like any others.
     */
    const laidOut = (element: HTMLElement, style: CSSStyleDeclaration) => /(flex|grid)/.test(style.display) && element.children.length > 0;

    const ownText = (element: Element) => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());

    /**
     * Whether an element is one run of words: it holds text of its own, or
     * it is a column of paragraphs set alike, which the editor keeps together
     * as one box with a line between each.
     */
    const textSource = (element: HTMLElement, style: CSSStyleDeclaration): HTMLElement | null => {
      if (ownText(element)) return laidOut(element, style) ? null : element;
      const kids = Array.from(element.children) as HTMLElement[];
      if (kids.length < 2 || !kids.every(kid => ownText(kid) && !kid.querySelector("img, svg"))) return null;
      const first = view.getComputedStyle(kids[0]!);
      const alike = kids.every(kid => {
        const style = view.getComputedStyle(kid);
        return (
          !style.display.startsWith("inline") &&
          !visible(style.backgroundColor) &&
          style.fontSize === first.fontSize &&
          style.fontFamily === first.fontFamily &&
          style.fontWeight === first.fontWeight &&
          style.color === first.color
        );
      });
      return alike ? kids[0]! : null;
    };

    /** How a run of words is set, read from the element that sets it. */
    const typeOf = (type: CSSStyleDeclaration, size: number) => {
      const columns = Number.parseInt(type.columnCount, 10);
      return {
        font: fontOf(type.fontFamily),
        size: round(size * k),
        weight: weightOf(type.fontWeight),
        italic: type.fontStyle !== "normal",
        underline: type.textDecorationLine.includes("underline"),
        uppercase: type.textTransform === "uppercase",
        tracking: type.letterSpacing === "normal" ? 0 : round(px(type.letterSpacing) / size),
        leading: type.lineHeight === "normal" ? 1.2 : round(px(type.lineHeight) / size),
        // Outlined letters (a stroke over a clear fill) cannot be drawn by a
        // text box, and clear letters would vanish, so they take the stroke's colour.
        color: !visible(type.color) && px(type.webkitTextStrokeWidth) > 0 ? hex(type.webkitTextStrokeColor) : hex(type.color),
        fill: "transparent",
        padding: 0,
        shadow: type.textShadow !== "none",
        ...(columns > 1 ? { columns, gap: round(px(type.columnGap) * k) } : {}),
      };
    };

    const text = (element: HTMLElement, from: HTMLElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      // A column of paragraphs is joined by hand: `innerText` puts a blank
      // line after every paragraph whatever its margins, and the layouts set
      // theirs close, with an indent, so a blank line each would push the
      // column past its foot. A gap between them is kept where the layout drew one.
      const paragraphs = from === element ? null : (Array.from(element.children) as HTMLElement[]);
      const spaced = paragraphs?.some(paragraph => px(view.getComputedStyle(paragraph).marginBottom) + px(view.getComputedStyle(paragraph).marginTop) > 2);
      const words = (paragraphs ? paragraphs.map(paragraph => paragraph.innerText.trim()).join(spaced ? "\n\n" : "\n") : element.innerText)
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (!words) return;
      const type = view.getComputedStyle(from);
      const size = px(type.fontSize) || 16;
      const edge = borders(style);
      const inset = {
        top: px(style.paddingTop) + edge.top,
        right: px(style.paddingRight) + edge.right,
        bottom: px(style.paddingBottom) + edge.bottom,
        left: px(style.paddingLeft) + edge.left,
      };
      let turn = rotation;
      let at = place(element, rotation, inset);
      // Set on its side: the editor turns a box instead, so the box is laid
      // across and turned a quarter, about the same centre.
      if (style.writingMode.startsWith("vertical") || style.writingMode.startsWith("sideways")) {
        turn = rotation + (style.writingMode === "sideways-lr" ? -90 : 90);
        at = { ...at, x: round(at.x + at.width / 2 - at.height / 2), y: round(at.y + at.height / 2 - at.width / 2), width: at.height, height: at.width, rotation: round(turn) };
      }
      const align: TextBox["align"] =
        type.textAlign === "center" || type.textAlign === "justify" ? type.textAlign : type.textAlign === "right" || type.textAlign === "end" ? "right" : "left";
      const flex = style.display.includes("flex");
      const across = style.flexDirection.startsWith("column") ? style.justifyContent : style.alignItems;
      const valign: TextBox["valign"] = flex && across === "center" ? "middle" : flex && (across === "flex-end" || across === "end") ? "bottom" : "top";

      // A face scaled to the sheet does not always break its lines in quite
      // the same places, and a line pushed over would be cut off. Text the
      // layout let run free gets a hair of room to spare, on the side it grows
      // towards; text it cut off on purpose keeps its exact box. A hair only:
      // three per cent was enough to pull a two-line headline onto one.
      const free = style.overflow === "visible" || style.overflow === "";
      if (free && turn === rotation) {
        const spare = Math.max(1, at.width * 0.005);
        at = {
          ...at,
          x: round(align === "right" ? at.x - spare : align === "center" ? at.x - spare / 2 : at.x),
          width: round(at.width + spare),
          height: valign === "top" ? round(at.height + size * k * 0.25) : at.height,
        };
      }

      // Display type keeps the layout's own line breaks, with room to spare
      // now that the breaks no longer depend on it.
      const lines = from === element && size >= 18 && turn === rotation ? linesOf(element) : null;
      if (lines) {
        const spare = at.width * 0.04;
        at = { ...at, x: round(align === "right" ? at.x - spare : align === "center" ? at.x - spare / 2 : at.x), width: round(at.width + spare) };
      }

      const box = textBox({
        ...at,
        id: newId("b"),
        opacity,
        ...typeOf(type, size),
        text: lines ? lines.join("\n") : words,
        align,
        valign,
      });
      const folio = folioOf(box, size);
      boxes.push(folio ? { ...box, folio } : box);
    };

    /** Words a row holds of its own, each placed where the browser set it. */
    const runs = (element: HTMLElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      for (const node of Array.from(element.childNodes)) {
        const words = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "").replace(/\s+/g, " ").trim() : "";
        if (!words) continue;
        const range = doc.createRange();
        range.selectNodeContents(node);
        const drawn = range.getBoundingClientRect();
        const size = px(style.fontSize) || 16;
        const spare = Math.max(2, drawn.width * 0.03);
        boxes.push(
          textBox({
            id: newId("b"),
            x: round((drawn.left - origin0.left) * k),
            y: round((drawn.top - origin0.top) * k),
            width: round((drawn.width + spare) * k),
            height: round(drawn.height * k + size * k * 0.25),
            rotation: round(rotation),
            opacity,
            ...typeOf(style, size),
            text: words,
          }),
        );
      }
    };

    /**
     * The lines a short run of display type was broken into, as the layout
     * drew them. A headline is set line by line — often balanced across its
     * lines — and a face scaled to the sheet can just fit one line more or
     * less, so the breaks are carried over rather than left to fall again.
     */
    const linesOf = (element: HTMLElement): string[] | null => {
      const walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const lines: string[] = [];
      let line = "";
      let top: number | null = null;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const content = node.textContent ?? "";
        for (const match of content.matchAll(/\S+\s*/g)) {
          const range = doc.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].trimEnd().length);
          const rect = range.getClientRects()[0];
          if (!rect) continue;
          if (top !== null && rect.top > top + rect.height / 2) {
            lines.push(line.trim());
            line = "";
          }
          if (line === "") top = rect.top;
          line += match[0].replace(/\s+/g, " ");
        }
      }
      if (line.trim()) lines.push(line.trim());
      return lines.length >= 2 && lines.length <= 6 ? lines : null;
    };

    const photo = (element: HTMLImageElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      const slot = slotOf(element.getAttribute("src"));
      if (!slot) return;
      samples.add(slot);
      const edge = borders(style);
      const uniform = edge.top > 0 && edge.top === edge.left && edge.top === edge.right && edge.top === edge.bottom;
      const scale = element.naturalWidth ? Math.max(element.clientWidth / element.naturalWidth, element.clientHeight / element.naturalHeight) : 1;
      const spare = { x: element.naturalWidth * scale - element.clientWidth, y: element.naturalHeight * scale - element.clientHeight };
      boxes.push(
        photoBox({
          ...place(element, rotation),
          id: newId("b"),
          opacity,
          photo: sampleId(slot),
          fit: style.objectFit === "contain" ? "contain" : "cover",
          ...focusOf(style.objectPosition, spare),
          radius: round(radiusOf(style, element.offsetWidth, element.offsetHeight).px * k),
          borderWidth: uniform ? round(edge.top * k) : 0,
          borderColor: uniform ? hex(style.borderTopColor) : "#ffffff",
          filter: filterOf(style.filter),
          flip: (style.transform.match(/^matrix\(([^,]+)/)?.[1] ?? "1").trim().startsWith("-"),
        }),
      );
    };

    /** A photograph a layout draws as a background (a type mask, a halftone): a frame like any other. */
    const backgroundPhoto = (element: HTMLElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      const url = style.backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
      const slot = url ? slotOf(new URL(url, doc.baseURI).pathname) ?? slotOf(url) : undefined;
      if (!slot) return;
      samples.add(slot);
      boxes.push(
        photoBox({
          ...place(element, rotation),
          id: newId("b"),
          opacity,
          photo: sampleId(slot),
          fit: style.backgroundSize === "contain" ? "contain" : "cover",
          ...focusOf(style.backgroundPosition, { x: 0, y: 0 }),
        }),
      );
    };

    /** A drawing in SVG — an ornament, a map, a stamp — made a picture, coloured as it was drawn. */
    const drawing = (element: SVGSVGElement, style: CSSStyleDeclaration, rotation: number, opacity: number) => {
      const drawn = element.getBoundingClientRect();
      if (drawn.width < 1 || drawn.height < 1) return;
      const copy = element.cloneNode(true) as SVGSVGElement;
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.setAttribute("width", String(drawn.width));
      copy.setAttribute("height", String(drawn.height));
      copy.style.color = style.color;
      copy.style.fontFamily = style.fontFamily;
      const id = newId("art");
      artwork.push({ id, file: new File([new XMLSerializer().serializeToString(copy)], "drawing.svg", { type: "image/svg+xml" }) });
      boxes.push(photoBox({ ...place(element, rotation), id: newId("b"), opacity, photo: id, fit: "contain" }));
    };

    const walk = (element: Element, rotation: number, opacity: number) => {
      const style = view.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return;
      const turn = rotation + angleOf(style.transform);
      const seen = opacity * Number(style.opacity);
      if (seen < 0.01) return;
      const tag = element.tagName.toLowerCase();
      if (tag === "style" || tag === "script" || tag === "br") return;
      if (tag === "svg") return drawing(element as SVGSVGElement, style, turn, seen);
      if (!(element instanceof view.HTMLElement)) return;
      if (tag === "img") return photo(element as HTMLImageElement, style, turn, seen);

      shapes(element, style, turn, seen);
      if (style.backgroundImage.includes("url(")) backgroundPhoto(element, style, turn, seen);
      const source = textSource(element, style);
      if (source) return text(element, source, style, turn, seen);
      if (ownText(element)) runs(element, style, turn, seen);
      for (const child of Array.from(element.children)) walk(child, turn, seen);
    };

    const rootStyle = view.getComputedStyle(root);
    const paper = visible(rootStyle.backgroundColor) ? hex(rootStyle.backgroundColor) : hex(view.getComputedStyle(doc.body).backgroundColor);
    const background = rootStyle.backgroundImage.includes("gradient(") ? `${rootStyle.backgroundImage}, ${paper}` : paper;
    for (const child of Array.from(root.children)) walk(child, 0, Number(rootStyle.opacity) || 1);

    return {
      page: { id: newId("p"), background: visible(background) ? background : "#ffffff", boxes, studio: origin },
      samples: [...samples],
      artwork,
    };
  } finally {
    frame.remove();
  }
}
