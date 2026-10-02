import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CaseUpper, Italic, RotateCcw, Trash2, Underline, X } from "lucide-react";

import { ColorField, Row, Segmented, Slider, Toggle } from "@/components/poster/inspector";
import { Button } from "@/components/ui/button";
import { FONT_IDS, FONTS, type FontId } from "@/lib/poster/model";

/**
 * The poster's font stacks, for a Studio page. One change: the editorial face
 * is named outright, because the poster's stack reaches it through the site's
 * `--font-editorial` variable and a page's frame has no such variable. The
 * frame declares the face itself (`pageDocument`), so the name is enough.
 */
const stackOf = (id: FontId) => (id === "editorial" ? '"Instrument Serif", ui-serif, Georgia, serif' : FONTS[id].stack);

/** The first family a stack names, unquoted: what a block's own `font-family` is matched on. */
const firstFamily = (stack: string) => stack.split(",")[0]!.replace(/["']/g, "").trim().toLowerCase();

/** `rgb(…)` or `rgba(…)` as the `#rrggbb` the colour field speaks; anything fully clear is "transparent". */
function hexOf(value: string, fallback: string): string {
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!value.startsWith("rgb") || !parts || parts.length < 3) return fallback;
  if (parts.length > 3 && parts[3] === 0) return "transparent";
  return `#${parts
    .slice(0, 3)
    .map(part => Math.round(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

type Align = "left" | "center" | "right" | "justify";

/**
 * What a block of words looks like now, read from the page rather than kept
 * alongside it: most of it was set by the design's own stylesheet, and only
 * the browser knows how that resolved. Spacing and leading are read in px and
 * given back relative to the size, the way they are set.
 */
function readType(block: HTMLElement) {
  const css = block.ownerDocument.defaultView!.getComputedStyle(block);
  const size = Number.parseFloat(css.fontSize) || 16;
  const own = block.style.fontFamily ? firstFamily(block.style.fontFamily) : "";
  const align: Align = css.textAlign === "center" || css.textAlign === "justify" ? css.textAlign : css.textAlign === "right" || css.textAlign === "end" ? "right" : "left";
  return {
    font: ((own && FONT_IDS.find(id => firstFamily(stackOf(id)) === own)) || "") as FontId | "",
    size,
    weight: Number.parseInt(css.fontWeight, 10) || 400,
    italic: css.fontStyle !== "normal",
    underline: css.textDecorationLine.includes("underline"),
    capitals: css.textTransform === "uppercase",
    align,
    // Alignment is a property of a block of lines; on a phrase set inline in a
    // larger line it would do nothing, so it is not offered there.
    alignable: !css.display.startsWith("inline"),
    tracking: css.letterSpacing === "normal" ? 0 : Number.parseFloat(css.letterSpacing) / size || 0,
    leading: css.lineHeight === "normal" ? 1.2 : Number.parseFloat(css.lineHeight) / size || 1.2,
    color: hexOf(css.color, "#000000"),
    highlight: hexOf(css.backgroundColor, "transparent"),
  };
}

/** CSS properties to set on the block; `null` takes the reader's setting off and gives the design's back. */
export type TypeChange = Record<string, string | null>;

type Props = {
  block: HTMLElement;
  /** Bumped after every change, so the panel reads the page again. */
  version: number;
  /** The reader has changed how this block looks, so there is something to reset. */
  formatted: boolean;
  onChange: (change: TypeChange) => void;
  onReset: () => void;
  /** Hides the block, and any wrapper round it that holds nothing else, from the page. */
  onDelete: () => void;
  onDone: () => void;
};

/**
 * Formatting for one block of words on a Studio page: the one the reader last
 * typed in. A block is a heading, a paragraph, a caption — the same unit the
 * page is made typeable by — and everything here applies to all of it.
 *
 * Whole blocks rather than a selection inside one, because the blocks are
 * `plaintext-only`: that keeps a paste from another page bringing its styles
 * in, and it also means there is no markup to wrap a selected word in. Off
 * values are written out (`font-style: normal`, not nothing) because the
 * design's own stylesheet may have set the thing being turned off.
 *
 * Sliders have no undo to gather into one step, unlike the poster's, so they
 * apply as they move; Reset takes the block back to the design.
 */
export function TypePanel({ block, version, formatted, onChange, onReset, onDelete, onDone }: Props) {
  void version;
  const type = readType(block);
  const hold = () => {};
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-stone-500 uppercase">Type</h3>
        <div className="flex gap-1">
          {formatted && (
            <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={onReset}>
              <RotateCcw className="size-3.5" />
              As designed
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7 rounded-full text-red-700 hover:text-red-800" title="Delete this box" aria-label="Delete this box" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 rounded-full" aria-label="Close type" onClick={onDone}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <select
        value={type.font}
        aria-label="Font"
        onChange={event => onChange({ "font-family": event.target.value ? stackOf(event.target.value as FontId) : null })}
        className="h-9 w-full rounded-md bg-white px-2 text-sm ring-1 ring-stone-200 outline-none focus:ring-blue-600"
        style={{ fontFamily: type.font ? FONTS[type.font].stack : undefined }}
      >
        <option value="">The design's font</option>
        {FONT_IDS.map(id => (
          <option key={id} value={id} style={{ fontFamily: FONTS[id].stack }}>
            {FONTS[id].name}
          </option>
        ))}
      </select>

      <Slider label="Size" value={type.size} min={6} max={Math.max(240, Math.ceil(type.size))} unit="px" onHold={hold} onPreview={size => onChange({ "font-size": `${size}px` })} />

      <div className="flex flex-wrap gap-1.5">
        <Toggle label="Bold" on={type.weight >= 600} onChange={on => onChange({ "font-weight": on ? "700" : "400" })}>
          <Bold className="size-4" />
        </Toggle>
        <Toggle label="Italic" on={type.italic} onChange={on => onChange({ "font-style": on ? "italic" : "normal" })}>
          <Italic className="size-4" />
        </Toggle>
        <Toggle label="Underline" on={type.underline} onChange={on => onChange({ "text-decoration-line": on ? "underline" : "none" })}>
          <Underline className="size-4" />
        </Toggle>
        <Toggle label="Capitals" on={type.capitals} onChange={on => onChange({ "text-transform": on ? "uppercase" : "none" })}>
          <CaseUpper className="size-4" />
        </Toggle>
      </div>

      <Row label="Weight">
        <Segmented
          label="Weight"
          value={type.weight >= 800 ? 900 : type.weight >= 600 ? 700 : type.weight <= 300 ? 300 : 400}
          onChange={weight => onChange({ "font-weight": String(weight) })}
          options={[
            { value: 300, label: "Light" },
            { value: 400, label: "Regular" },
            { value: 700, label: "Bold" },
            { value: 900, label: "Black" },
          ]}
        />
      </Row>

      {type.alignable ? (
        <Row label="Align">
          <Segmented
            label="Alignment"
            value={type.align}
            onChange={align => onChange({ "text-align": align })}
            options={[
              { value: "left", label: "Left", icon: <AlignLeft className="size-4" /> },
              { value: "center", label: "Centre", icon: <AlignCenter className="size-4" /> },
              { value: "right", label: "Right", icon: <AlignRight className="size-4" /> },
              { value: "justify", label: "Justify", icon: <AlignJustify className="size-4" /> },
            ]}
          />
        </Row>
      ) : (
        <p className="text-[11px] text-stone-500">These words sit inside a longer line, so they follow its alignment.</p>
      )}

      <Slider
        label="Letter spacing"
        value={type.tracking}
        min={-0.1}
        max={0.6}
        step={0.01}
        unit="em"
        onHold={hold}
        onPreview={tracking => onChange({ "letter-spacing": `${tracking}em` })}
      />
      <Slider label="Line height" value={type.leading} min={0.7} max={2.6} step={0.05} onHold={hold} onPreview={leading => onChange({ "line-height": String(leading) })} />

      <ColorField label="Colour" value={type.color} onCommit={color => onChange({ color })} onHold={hold} onPreview={color => onChange({ color })} />
      <ColorField
        label="Highlight"
        value={type.highlight}
        allowNone
        onCommit={fill => onChange({ "background-color": fill })}
        onHold={hold}
        onPreview={fill => onChange({ "background-color": fill })}
      />
    </div>
  );
}
