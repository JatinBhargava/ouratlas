import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  CaseUpper,
  Circle,
  Copy,
  FlipHorizontal2,
  ImagePlus,
  Italic,
  Lock,
  LockOpen,
  SendToBack,
  Square,
  Trash2,
  Underline,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FILTERS,
  FONT_IDS,
  FONTS,
  SHEET,
  STARTER_IDS,
  STARTERS,
  SWATCHES,
  type Box,
  type Filter,
  type PhotoBox,
  type PosterPage,
  type ShapeBox,
  type StarterId,
  type TextBox,
} from "@/lib/poster/model";
import { cn } from "@/lib/utils";

/**
 * Three ways to change a value, because controls come in two kinds.
 *
 * A button or a menu is one decision: `commit`, one undo step. A slider, a
 * colour picker or a field being typed in is a stream of values on the way
 * to one: it calls `hold` as it starts and `preview` as it goes, so undo
 * takes the whole gesture back at once instead of one pixel at a time.
 */
export type Edits<T> = {
  commit: (patch: Partial<T>) => void;
  preview: (patch: Partial<T>) => void;
  hold: () => void;
};

export type Layer = "front" | "forward" | "backward" | "back";
export type PageAlign = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/* ------------------------------------------------------------------ fields */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-stone-200 pb-4 last:border-b-0">
      <h3 className="text-[11px] font-medium tracking-[0.2em] text-stone-500 uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-xs text-stone-600">{label}</span>
      {children}
    </div>
  );
}

/** A row of mutually exclusive buttons: alignment, weight, fit. */
function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: V;
  options: { value: V; label: string; icon?: ReactNode }[];
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg bg-stone-100 p-0.5 ring-1 ring-stone-200">
      {options.map(option => (
        <button
          key={String(option.value)}
          type="button"
          title={option.label}
          aria-label={option.icon ? option.label : undefined}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-7 min-w-8 flex-1 items-center justify-center rounded-md px-2 text-xs transition-colors",
            option.value === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
          )}
        >
          {option.icon ?? option.label}
        </button>
      ))}
    </div>
  );
}

/** An on/off button with an icon, for bold, italic and the like. */
function Toggle({ on, onChange, label, children }: { on: boolean; onChange: (on: boolean) => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(
        "flex size-8 items-center justify-center rounded-md ring-1 transition-colors",
        on ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-600 ring-stone-200 hover:text-stone-900",
      )}
    >
      {children}
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onHold,
  onPreview,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onHold: () => void;
  onPreview: (value: number) => void;
}) {
  const shown = Number.isInteger(step) ? Math.round(value) : Number(value.toFixed(2));
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between text-xs text-stone-600">
        {label}
        <span className="text-stone-500 tabular-nums">
          {shown}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onHold}
        onKeyDown={onHold}
        onChange={event => onPreview(Number(event.target.value))}
        className="w-full accent-emerald-600"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onHold,
  onPreview,
}: {
  label: string;
  value: number;
  onHold: () => void;
  onPreview: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1 ring-1 ring-stone-200 focus-within:ring-emerald-500">
      <span className="text-[11px] text-stone-500">{label}</span>
      <input
        type="number"
        value={Math.round(value)}
        onFocus={onHold}
        onChange={event => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onPreview(next);
        }}
        className="w-full min-w-0 bg-transparent text-xs text-stone-800 tabular-nums outline-none"
      />
    </label>
  );
}

/**
 * Swatches for the common case, the system picker for any colour, and the
 * hex for someone matching a brand. `allowNone` adds a clear swatch for fills
 * that may be left empty.
 */
function ColorField({
  label,
  value,
  allowNone,
  onCommit,
  onHold,
  onPreview,
}: {
  label: string;
  value: string;
  allowNone?: boolean;
  onCommit: (value: string) => void;
  onHold: () => void;
  onPreview: (value: string) => void;
}) {
  const none = value === "transparent";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-600">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            aria-label={`${label}: any colour`}
            value={none ? "#ffffff" : value}
            onClick={onHold}
            onChange={event => onPreview(event.target.value)}
            className="size-7 cursor-pointer rounded border border-stone-300 bg-white p-0.5"
          />
          <input
            aria-label={`${label}: hex`}
            value={none ? "none" : value}
            onFocus={onHold}
            onChange={event => {
              const text = event.target.value.trim();
              if (/^#[0-9a-f]{6}$/i.test(text)) onPreview(text.toLowerCase());
            }}
            className="w-20 rounded-md bg-white px-2 py-1 text-xs text-stone-700 uppercase ring-1 ring-stone-200 outline-none focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {allowNone && (
          <button
            type="button"
            title="None"
            aria-label="No colour"
            aria-pressed={none}
            onClick={() => onCommit("transparent")}
            className={cn(
              "size-5 rounded-full border border-stone-300 bg-[linear-gradient(135deg,transparent_45%,#dc2626_45%,#dc2626_55%,transparent_55%)] bg-white",
              none && "ring-2 ring-emerald-600 ring-offset-1",
            )}
          />
        )}
        {SWATCHES.map(swatch => (
          <button
            key={swatch}
            type="button"
            title={swatch}
            aria-label={`Colour ${swatch}`}
            aria-pressed={swatch === value}
            onClick={() => onCommit(swatch)}
            className={cn("size-5 rounded-full border border-stone-300", swatch === value && "ring-2 ring-emerald-600 ring-offset-1")}
            style={{ background: swatch }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ per kind */

function TextPanel({ box, edits }: { box: TextBox; edits: Edits<TextBox> }) {
  return (
    <>
      <Section title="Words">
        <textarea
          value={box.text}
          onFocus={edits.hold}
          onChange={event => edits.preview({ text: event.target.value })}
          rows={4}
          aria-label="Text"
          className="w-full resize-y rounded-md bg-white px-2.5 py-2 text-sm text-stone-800 ring-1 ring-stone-200 outline-none focus:ring-emerald-500"
        />
        <p className="text-[11px] text-stone-500">Or double-click the box on the page and type there.</p>
      </Section>

      <Section title="Type">
        <select
          value={box.font}
          aria-label="Font"
          onChange={event => edits.commit({ font: event.target.value as TextBox["font"] })}
          className="h-9 w-full rounded-md bg-white px-2 text-sm ring-1 ring-stone-200 outline-none focus:ring-emerald-500"
          style={{ fontFamily: FONTS[box.font].stack }}
        >
          {FONT_IDS.map(id => (
            <option key={id} value={id} style={{ fontFamily: FONTS[id].stack }}>
              {FONTS[id].name}
            </option>
          ))}
        </select>
        <Slider label="Size" value={box.size} min={6} max={220} unit="px" onHold={edits.hold} onPreview={size => edits.preview({ size })} />
        <div className="flex flex-wrap gap-1.5">
          <Toggle label="Bold" on={box.weight >= 700} onChange={on => edits.commit({ weight: on ? 700 : 400 })}>
            <Bold className="size-4" />
          </Toggle>
          <Toggle label="Italic" on={box.italic} onChange={italic => edits.commit({ italic })}>
            <Italic className="size-4" />
          </Toggle>
          <Toggle label="Underline" on={box.underline} onChange={underline => edits.commit({ underline })}>
            <Underline className="size-4" />
          </Toggle>
          <Toggle label="Capitals" on={box.uppercase} onChange={uppercase => edits.commit({ uppercase })}>
            <CaseUpper className="size-4" />
          </Toggle>
          <Toggle label="Shadow" on={box.shadow} onChange={shadow => edits.commit({ shadow })}>
            <span className="text-xs font-bold [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">S</span>
          </Toggle>
        </div>
        <Row label="Weight">
          <Segmented
            label="Weight"
            value={box.weight}
            onChange={weight => edits.commit({ weight })}
            options={[
              { value: 400, label: "Regular" },
              { value: 700, label: "Bold" },
              { value: 900, label: "Black" },
            ]}
          />
        </Row>
      </Section>

      <Section title="Alignment">
        <Row label="Across">
          <Segmented
            label="Horizontal alignment"
            value={box.align}
            onChange={align => edits.commit({ align })}
            options={[
              { value: "left", label: "Left", icon: <AlignLeft className="size-4" /> },
              { value: "center", label: "Centre", icon: <AlignCenter className="size-4" /> },
              { value: "right", label: "Right", icon: <AlignRight className="size-4" /> },
              { value: "justify", label: "Justify", icon: <AlignJustify className="size-4" /> },
            ]}
          />
        </Row>
        <Row label="Down">
          <Segmented
            label="Vertical alignment"
            value={box.valign}
            onChange={valign => edits.commit({ valign })}
            options={[
              { value: "top", label: "Top", icon: <AlignVerticalJustifyStart className="size-4" /> },
              { value: "middle", label: "Middle", icon: <AlignVerticalJustifyCenter className="size-4" /> },
              { value: "bottom", label: "Bottom", icon: <AlignVerticalJustifyEnd className="size-4" /> },
            ]}
          />
        </Row>
        <Slider label="Letter spacing" value={box.tracking} min={-0.1} max={0.6} step={0.01} unit="em" onHold={edits.hold} onPreview={tracking => edits.preview({ tracking })} />
        <Slider label="Line height" value={box.leading} min={0.7} max={2.6} step={0.05} onHold={edits.hold} onPreview={leading => edits.preview({ leading })} />
        <Slider label="Padding" value={box.padding} min={0} max={60} unit="px" onHold={edits.hold} onPreview={padding => edits.preview({ padding })} />
      </Section>

      <Section title="Colour">
        <ColorField label="Text" value={box.color} onCommit={color => edits.commit({ color })} onHold={edits.hold} onPreview={color => edits.preview({ color })} />
        <ColorField
          label="Background"
          value={box.fill}
          allowNone
          onCommit={fill => edits.commit({ fill })}
          onHold={edits.hold}
          onPreview={fill => edits.preview({ fill })}
        />
      </Section>
    </>
  );
}

function PhotoPanel({ box, edits, onPick }: { box: PhotoBox; edits: Edits<PhotoBox>; onPick: () => void }) {
  const shorter = Math.min(box.width, box.height);
  return (
    <>
      <Section title="Photo">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPick}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-stone-900 text-sm text-white hover:bg-stone-800"
          >
            <ImagePlus className="size-4" />
            {box.photo ? "Replace photo" : "Choose photo"}
          </button>
          {box.photo && (
            <button
              type="button"
              onClick={() => edits.commit({ photo: null })}
              className="h-9 rounded-md px-3 text-sm text-stone-600 ring-1 ring-stone-200 hover:text-stone-900"
            >
              Empty
            </button>
          )}
        </div>
        <Row label="Fit">
          <Segmented
            label="Fit"
            value={box.fit}
            onChange={fit => edits.commit({ fit })}
            options={[
              { value: "cover", label: "Fill frame" },
              { value: "contain", label: "Whole photo" },
            ]}
          />
        </Row>
        <Slider label="Zoom" value={box.zoom} min={1} max={3} step={0.05} unit="×" onHold={edits.hold} onPreview={zoom => edits.preview({ zoom })} />
        <Slider label="Focus left – right" value={box.focusX} min={0} max={100} unit="%" onHold={edits.hold} onPreview={focusX => edits.preview({ focusX })} />
        <Slider label="Focus top – bottom" value={box.focusY} min={0} max={100} unit="%" onHold={edits.hold} onPreview={focusY => edits.preview({ focusY })} />
        <Row label="Mirror">
          <Toggle label="Flip horizontally" on={box.flip} onChange={flip => edits.commit({ flip })}>
            <FlipHorizontal2 className="size-4" />
          </Toggle>
        </Row>
      </Section>

      <Section title="Filter">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(FILTERS) as Filter[]).map(filter => (
            <button
              key={filter}
              type="button"
              aria-pressed={box.filter === filter}
              onClick={() => edits.commit({ filter })}
              className={cn(
                "h-8 rounded-md text-xs ring-1 transition-colors",
                box.filter === filter ? "bg-stone-900 text-white ring-stone-900" : "bg-white text-stone-600 ring-stone-200 hover:text-stone-900",
              )}
            >
              {FILTERS[filter].name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Frame">
        <Slider label="Corners" value={box.radius} min={0} max={Math.round(shorter / 2)} unit="px" onHold={edits.hold} onPreview={radius => edits.preview({ radius })} />
        <div className="flex gap-1.5">
          <button type="button" onClick={() => edits.commit({ radius: 0, arch: false })} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs ring-1 ring-stone-200 hover:bg-stone-50">
            <Square className="size-3.5" /> Square
          </button>
          <button type="button" onClick={() => edits.commit({ radius: Math.round(box.width / 2), arch: true })} className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs ring-1 ring-stone-200 hover:bg-stone-50">
            <span className="h-3.5 w-3 rounded-t-full border border-current" /> Arch
          </button>
          <button
            type="button"
            onClick={() => edits.commit({ radius: Math.round(shorter / 2), arch: false, height: shorter, width: shorter })}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-xs ring-1 ring-stone-200 hover:bg-stone-50"
          >
            <Circle className="size-3.5" /> Circle
          </button>
        </div>
        <Slider label="Border" value={box.borderWidth} min={0} max={30} unit="px" onHold={edits.hold} onPreview={borderWidth => edits.preview({ borderWidth })} />
        {box.borderWidth > 0 && (
          <ColorField
            label="Border colour"
            value={box.borderColor}
            onCommit={borderColor => edits.commit({ borderColor })}
            onHold={edits.hold}
            onPreview={borderColor => edits.preview({ borderColor })}
          />
        )}
      </Section>
    </>
  );
}

function ShapePanel({ box, edits }: { box: ShapeBox; edits: Edits<ShapeBox> }) {
  return (
    <>
      <Section title="Shape">
        <Row label="Form">
          <Segmented
            label="Shape"
            value={box.shape}
            onChange={shape => edits.commit({ shape })}
            options={[
              { value: "rect", label: "Rectangle", icon: <Square className="size-4" /> },
              { value: "ellipse", label: "Ellipse", icon: <Circle className="size-4" /> },
            ]}
          />
        </Row>
        <ColorField label="Fill" value={box.fill} allowNone onCommit={fill => edits.commit({ fill })} onHold={edits.hold} onPreview={fill => edits.preview({ fill })} />
        {box.shape === "rect" && (
          <Slider
            label="Corners"
            value={box.radius}
            min={0}
            max={Math.round(Math.min(box.width, box.height) / 2)}
            unit="px"
            onHold={edits.hold}
            onPreview={radius => edits.preview({ radius })}
          />
        )}
        <Slider label="Border" value={box.borderWidth} min={0} max={30} unit="px" onHold={edits.hold} onPreview={borderWidth => edits.preview({ borderWidth })} />
        {box.borderWidth > 0 && (
          <ColorField
            label="Border colour"
            value={box.borderColor}
            onCommit={borderColor => edits.commit({ borderColor })}
            onHold={edits.hold}
            onPreview={borderColor => edits.preview({ borderColor })}
          />
        )}
      </Section>
    </>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md bg-white ring-1 ring-stone-200 transition-colors",
        danger ? "text-red-600 hover:bg-red-50" : "text-stone-600 hover:text-stone-900",
      )}
    >
      {children}
    </button>
  );
}

function ArrangePanel({
  box,
  edits,
  onLayer,
  onAlign,
  onDuplicate,
  onRemove,
}: {
  box: Box;
  edits: Edits<Box>;
  onLayer: (layer: Layer) => void;
  onAlign: (align: PageAlign) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <Section title="Position and size">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={box.x} onHold={edits.hold} onPreview={x => edits.preview({ x })} />
          <NumberField label="Y" value={box.y} onHold={edits.hold} onPreview={y => edits.preview({ y })} />
          <NumberField label="W" value={box.width} onHold={edits.hold} onPreview={width => edits.preview({ width: Math.max(1, width) })} />
          <NumberField label="H" value={box.height} onHold={edits.hold} onPreview={height => edits.preview({ height: Math.max(1, height) })} />
        </div>
        <p className="text-[11px] text-stone-500">
          In page pixels. The page is {SHEET.width} × {SHEET.height}.
        </p>
        <Slider label="Rotate" value={box.rotation} min={-180} max={180} unit="°" onHold={edits.hold} onPreview={rotation => edits.preview({ rotation })} />
        <Slider label="Opacity" value={Math.round(box.opacity * 100)} min={5} max={100} unit="%" onHold={edits.hold} onPreview={opacity => edits.preview({ opacity: opacity / 100 })} />
      </Section>

      <Section title="Align to page">
        <div className="grid grid-cols-6 gap-1">
          <IconButton label="Align left" onClick={() => onAlign("left")}>
            <AlignStartVertical className="size-4" />
          </IconButton>
          <IconButton label="Centre across" onClick={() => onAlign("hcenter")}>
            <AlignCenterVertical className="size-4" />
          </IconButton>
          <IconButton label="Align right" onClick={() => onAlign("right")}>
            <AlignEndVertical className="size-4" />
          </IconButton>
          <IconButton label="Align top" onClick={() => onAlign("top")}>
            <AlignStartHorizontal className="size-4" />
          </IconButton>
          <IconButton label="Centre down" onClick={() => onAlign("vcenter")}>
            <AlignCenterHorizontal className="size-4" />
          </IconButton>
          <IconButton label="Align bottom" onClick={() => onAlign("bottom")}>
            <AlignEndHorizontal className="size-4" />
          </IconButton>
        </div>
      </Section>

      <Section title="Layer">
        <div className="flex gap-1">
          <IconButton label="Bring to front" onClick={() => onLayer("front")}>
            <BringToFront className="size-4" />
          </IconButton>
          <IconButton label="Bring forward" onClick={() => onLayer("forward")}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Send backward" onClick={() => onLayer("backward")}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label="Send to back" onClick={() => onLayer("back")}>
            <SendToBack className="size-4" />
          </IconButton>
          <span className="mx-1 w-px bg-stone-200" />
          <IconButton label={box.locked ? "Unlock" : "Lock in place"} onClick={() => edits.commit({ locked: !box.locked })}>
            {box.locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
          </IconButton>
          <IconButton label="Duplicate (⌘D)" onClick={onDuplicate}>
            <Copy className="size-4" />
          </IconButton>
          <IconButton label="Delete (Del)" onClick={onRemove} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </Section>
    </>
  );
}

/* --------------------------------------------------------------- page */

function PagePanel({
  page,
  edits,
  showGuides,
  onGuides,
  onStarter,
}: {
  page: PosterPage;
  edits: Edits<PosterPage>;
  showGuides: boolean;
  onGuides: (on: boolean) => void;
  /** Absent where a product has no starter layouts (the one-page poster, for now). */
  onStarter?: (id: StarterId) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Section title="This page">
        <ColorField
          label="Background"
          value={page.background}
          onCommit={background => edits.commit({ background })}
          onHold={edits.hold}
          onPreview={background => edits.preview({ background })}
        />
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input type="checkbox" checked={showGuides} onChange={event => onGuides(event.target.checked)} className="size-4 accent-emerald-600" />
          Show margin guides (they never print)
        </label>
      </Section>

      {onStarter && (
        <Section title="Start from a layout">
          <p className="text-[11px] leading-relaxed text-stone-500">Replaces what is on this page. Every box stays yours to move, restyle or delete.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {STARTER_IDS.map(id => (
              <button
                key={id}
                type="button"
                onClick={() => onStarter(id)}
                className="h-9 rounded-md bg-white text-xs text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 hover:text-stone-900"
              >
                {STARTERS[id].name}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="Layout directory">
        <p className="text-[11px] leading-relaxed text-stone-500">
          Pages other Atlas readers designed, reviewed by the editors. Open one to start from it, or submit your own from the toolbar.
        </p>
        <Link to="/layouts?kind=poster" className="text-xs font-medium text-stone-800 underline underline-offset-2 hover:text-stone-950">
          Browse layouts →
        </Link>
      </Section>

      <Section title="Shortcuts">
        <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-stone-500">
          <li>Double-click text to type · double-click a frame for a photo</li>
          <li>Drop photos anywhere on the page</li>
          <li>Arrows nudge · Shift + arrows nudge by 10</li>
          <li>⌘Z undo · ⇧⌘Z redo · ⌘D duplicate · Del delete</li>
          <li>Shift while resizing keeps the shape · Alt while moving turns off snapping</li>
        </ul>
      </Section>
    </div>
  );
}

/* --------------------------------------------------------------- entry */

export function Inspector({
  page,
  box,
  pageEdits,
  boxEdits,
  showGuides,
  onGuides,
  onStarter,
  onPickPhoto,
  onLayer,
  onAlign,
  onDuplicate,
  onRemove,
}: {
  page: PosterPage;
  box: Box | null;
  pageEdits: Edits<PosterPage>;
  boxEdits: Edits<Box>;
  showGuides: boolean;
  onGuides: (on: boolean) => void;
  onStarter?: (id: StarterId) => void;
  onPickPhoto: () => void;
  onLayer: (layer: Layer) => void;
  onAlign: (align: PageAlign) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  if (!box) return <PagePanel page={page} edits={pageEdits} showGuides={showGuides} onGuides={onGuides} onStarter={onStarter} />;

  const title = box.kind === "text" ? "Text box" : box.kind === "photo" ? "Photo box" : "Shape";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-stone-900">{title}</p>
      <Tabs defaultValue="style">
        <TabsList className="w-full">
          <TabsTrigger value="style" className="flex-1">
            Style
          </TabsTrigger>
          <TabsTrigger value="arrange" className="flex-1">
            Arrange
          </TabsTrigger>
        </TabsList>
        <TabsContent value="style" className="mt-3 flex flex-col gap-4">
          {box.kind === "text" && <TextPanel box={box} edits={boxEdits as Edits<TextBox>} />}
          {box.kind === "photo" && <PhotoPanel box={box} edits={boxEdits as Edits<PhotoBox>} onPick={onPickPhoto} />}
          {box.kind === "shape" && <ShapePanel box={box} edits={boxEdits as Edits<ShapeBox>} />}
        </TabsContent>
        <TabsContent value="arrange" className="mt-3 flex flex-col gap-4">
          <ArrangePanel box={box} edits={boxEdits} onLayer={onLayer} onAlign={onAlign} onDuplicate={onDuplicate} onRemove={onRemove} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
