import type { CSSProperties } from "react";
import { PenLine, WandSparkles } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { DIRECTION_NOTE_MAX, DIRECTIONS, type Direction, type EditorDirection } from "@/types";

type DirectionPickerProps = {
  value: EditorDirection;
  onChange: (next: EditorDirection) => void;
  disabled?: boolean;
};

/**
 * Starting points for "Your own", tapped in rather than typed: a blank box
 * asks the reader to invent a vocabulary for looks, and most people describe
 * a magazine they have seen rather than one they have imagined.
 */
const SPARKS = [
  "A 1970s travel brochure, sun-faded oranges and big friendly type",
  "A wedding album in ivory and sage, very elegant, lots of air",
  "A black-and-white newspaper with punchy headlines",
  "A birthday zine for a six-year-old: bold, bright, silly",
];

/**
 * The looks the editor can be asked for, each as a little cover in its own
 * colours, and a box for the reader's own words.
 *
 * The covers are drawn here in CSS rather than shipped as pictures: they are
 * a hint of each look's palette and attitude, not a promise of a layout, and
 * eight thumbnails would cost more than this whole panel.
 */
export function DirectionPicker({ value, onChange, disabled }: DirectionPickerProps) {
  const own = value.id === "custom";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-medium tracking-wide text-stone-700 uppercase">Art direction</h4>
        <span className="text-xs text-stone-500">{DIRECTIONS.find(d => d.id === value.id)?.tagline}</span>
      </div>

      <div
        role="radiogroup"
        aria-label="Art direction"
        className="-mx-1 grid auto-cols-[7rem] grid-flow-col gap-3 overflow-x-auto px-1 pb-2 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:grid-cols-8"
      >
        {DIRECTIONS.map(direction => {
          const chosen = value.id === direction.id;
          return (
            <button
              key={direction.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={disabled}
              onClick={() => onChange({ id: direction.id, note: direction.id === "custom" ? value.note : "" })}
              className="group flex min-w-0 flex-col gap-1.5 rounded-xl p-1 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-stone-900 disabled:opacity-60"
            >
              <span
                className={`block aspect-[3/4] w-full overflow-hidden rounded-md transition ${
                  chosen
                    ? "shadow-md ring-2 ring-stone-900 ring-offset-2"
                    : "ring-1 ring-stone-200 group-hover:-translate-y-0.5 group-hover:shadow-md"
                }`}
              >
                <Cover direction={direction} />
              </span>
              <span className="truncate text-xs font-medium text-stone-800">{direction.name}</span>
            </button>
          );
        })}
      </div>

      {own && (
        <div className="flex flex-col gap-2">
          <label htmlFor="direction-note" className="sr-only">
            Describe the look you want
          </label>
          <Textarea
            id="direction-note"
            value={value.note}
            maxLength={DIRECTION_NOTE_MAX}
            disabled={disabled}
            rows={3}
            onChange={event => onChange({ id: "custom", note: event.target.value })}
            placeholder="Describe the look: the colours, the mood, a magazine it should feel like. The editor works within Atlas's layouts and typefaces, and says so when it can't match something exactly."
            className="resize-none bg-white text-sm"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {SPARKS.map(spark => (
              <button
                key={spark}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ id: "custom", note: spark })}
                className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-600 transition hover:border-stone-400 hover:text-stone-900 disabled:opacity-60"
              >
                {spark}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-stone-400 tabular-nums">
              {value.note.length} / {DIRECTION_NOTE_MAX}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** A little cover in a direction's colours, with the one detail that gives the look away. */
function Cover({ direction }: { direction: Direction }) {
  const { paper, ink, accent } = direction.swatch;
  const base: CSSProperties = { background: paper, color: ink };

  switch (direction.id) {
    case "riso":
      // Two drums printed slightly out of register, multiplied where they overlap.
      return (
        <span className="relative flex h-full flex-col justify-between p-2" style={base}>
          <span
            className="absolute -right-5 bottom-3 size-20 rounded-full opacity-70"
            style={{ backgroundImage: `radial-gradient(${accent} 34%, transparent 38%)`, backgroundSize: "5px 5px" }}
          />
          <span className="relative block text-[26px] leading-[0.8] font-black tracking-tighter" style={{ color: accent }}>
            ZINE
            <span className="absolute top-[2px] left-[2px] mix-blend-multiply" style={{ color: "#ff3e8a" }} aria-hidden>
              ZINE
            </span>
          </span>
          <span className="relative w-14 bg-[#ff3e8a] px-1 py-0.5 text-[7px] font-bold text-white uppercase">Nº 01</span>
        </span>
      );
    case "ledger":
      // Banknote engraving: concentric rosettes, a serial number, a figure.
      return (
        <span className="relative flex h-full flex-col justify-between p-2" style={base}>
          <span
            className="absolute -right-6 -bottom-6 size-24 rounded-full opacity-30"
            style={{ backgroundImage: `repeating-radial-gradient(circle, ${accent} 0 1px, transparent 1px 4px)` }}
          />
          <span className="relative font-serif text-[15px] leading-none font-bold tracking-tight">LEDGER</span>
          <span className="relative font-mono text-[7px] text-[#e0413b]">JB 2023 0926</span>
          <span className="relative font-serif text-[18px] leading-none italic" style={{ color: accent }}>
            ▼35%
          </span>
        </span>
      );
    case "album":
      // Prints laid on the page at an angle, each with its white border.
      return (
        <span className="relative block h-full" style={base}>
          <span className="absolute top-3 left-2 w-12 -rotate-6 bg-white p-1 pb-3 shadow">
            <span className="block aspect-square" style={{ background: accent }} />
          </span>
          <span className="absolute right-2 bottom-4 w-12 rotate-[5deg] bg-white p-1 pb-3 shadow">
            <span className="block aspect-square" style={{ background: `linear-gradient(160deg, #d9b48f, ${accent})` }} />
          </span>
        </span>
      );
    case "gallery":
      // Mostly paper: one picture, small, and a line of type under it.
      return (
        <span className="flex h-full flex-col items-center justify-center gap-1.5 p-3" style={base}>
          <span className="block aspect-[4/5] w-3/5" style={{ background: `linear-gradient(180deg, #9aa29e, ${accent})` }} />
          <span className="block h-px w-8" style={{ background: ink }} />
          <span className="text-[6px] tracking-[0.3em] uppercase">Plates</span>
        </span>
      );
    case "glossy":
      // A full-bleed photograph with the masthead printed over it.
      return (
        <span
          className="flex h-full flex-col justify-between p-2"
          style={{ background: `linear-gradient(165deg, ${accent} 0%, #6b1424 55%, ${ink} 100%)`, color: paper }}
        >
          <span className="font-serif text-[17px] leading-none font-bold tracking-tight">FEATURE</span>
          <span className="flex flex-col gap-0.5 text-[6.5px] leading-tight font-semibold uppercase">
            <span>The cover story</span>
            <span className="opacity-75">+ 12 pages inside</span>
          </span>
        </span>
      );
    case "nightfall":
      return (
        <span
          className="relative flex h-full flex-col justify-end p-2"
          style={{ background: `linear-gradient(180deg, ${ink} 0%, ${accent} 100%)`, color: paper }}
        >
          <span className="absolute top-3 right-3 size-4 rounded-full" style={{ background: paper, boxShadow: `0 0 12px ${paper}` }} />
          <span className="font-serif text-[13px] leading-tight italic">After the lamps came on</span>
        </span>
      );
    case "custom":
      return (
        <span className="flex h-full flex-col items-center justify-center gap-1 border-2 border-dashed border-stone-300 bg-white text-stone-500">
          <PenLine className="size-5" />
          <span className="text-[9px]">Your words</span>
        </span>
      );
    default:
      // The editor's own judgement: the house cover, with the wand.
      return (
        <span className="flex h-full flex-col justify-between p-2" style={base}>
          <span className="font-serif text-[14px] leading-none tracking-tight">Atlas</span>
          <span className="grid flex-1 place-items-center">
            <span className="grid size-9 place-items-center rounded-full" style={{ background: accent, color: paper }}>
              <WandSparkles className="size-4" />
            </span>
          </span>
          <span className="block h-1 w-10" style={{ background: accent }} />
        </span>
      );
  }
}
