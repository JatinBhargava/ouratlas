import { Check } from "lucide-react";

import { THEME_LIST, type PreviewRow, type Surface, type Theme, type ThemeId } from "@/lib/magazine/themes";
import { cn } from "@/lib/utils";

/**
 * The theme drawn as a page of blocks.
 *
 * A name and a sentence cannot say what a layout looks like, and a real
 * rendering would need photographs and copy that do not exist yet. Blocks in
 * the proportions of the actual leaf are the middle of it: filled for a
 * photograph, ruled for text, on the stock the theme actually prints on — so
 * the shape and the colour of the page are both readable at a glance and
 * nothing is claimed that the composer will not deliver.
 */
function Preview({ rows, surface }: { rows: PreviewRow[]; surface: Surface }) {
  return (
    <div
      className="flex h-full w-full flex-col gap-[3px] rounded-[2px] p-[5px]"
      style={{ backgroundColor: surface.paper }}
    >
      {rows.map((row, index) => (
        <div key={index} className="flex gap-[3px]" style={{ flex: row.span }}>
          {row.cells.map((cell, cellIndex) => (
            <div
              key={cellIndex}
              style={{
                flex: cell.span,
                ...(cell.kind === "head" ? { backgroundColor: surface.accent } : null),
              }}
              className={cn(
                "rounded-[1px]",
                cell.kind === "plate" && "bg-stone-400",
                cell.kind === "copy" &&
                  "bg-[repeating-linear-gradient(to_bottom,var(--color-stone-400)_0_1px,transparent_1px_3px)] opacity-70",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ThemeCard({ theme, chosen, onChoose }: { theme: Theme; chosen: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={chosen}
      className={cn(
        "flex w-40 shrink-0 flex-col gap-3 rounded-xl border p-3 text-left transition-colors",
        chosen
          ? "border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600"
          : "border-stone-200 bg-white/70 hover:border-stone-400",
      )}
    >
      {/* The proportions of a real leaf, so the diagram is not lying about shape. */}
      <div className="aspect-[520/693] w-full overflow-hidden rounded-[3px] border border-stone-200">
        <Preview rows={theme.preview} surface={theme.surface} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
          {theme.name}
          {chosen && <Check className="size-3.5 text-emerald-600" aria-hidden />}
        </span>
        <span className="text-[11px] leading-[1.45] text-stone-500">{theme.blurb}</span>
      </div>
    </button>
  );
}

/** The widest lean worth offering. Past this the prints stop reading as pasted and start reading as fallen. */
export const MAX_TILT = 6;

/**
 * How far the pasted-up photographs lean.
 *
 * Offered only by the themes that paste anything up, because on a squared-off
 * grid there is nothing for it to do. It redraws rather than recomposes — the
 * lean sits on a wrapper and moves no box the fitter measured — so this can be
 * a slider rather than something applied on release.
 */
export function TiltControl({
  tilt,
  onChange,
  className,
}: {
  tilt: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-medium tracking-[0.28em] text-stone-500 uppercase">Tilt</span>
        <span className="text-xs text-stone-500">
          How far the photographs lean — <span className="tabular-nums">{tilt.toFixed(1)}°</span>
          {tilt === 0 && " (flat)"}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_TILT}
        step={0.5}
        value={tilt}
        onChange={event => onChange(Number(event.target.value))}
        aria-label="How far the pasted photographs lean, in degrees"
        className="h-1.5 w-full max-w-xs cursor-pointer appearance-none rounded-full bg-stone-200 accent-emerald-600"
      />
    </div>
  );
}

/**
 * Which style the issue is set in.
 *
 * Choosing one lays the magazine out again from the beginning, so this is not
 * a preference to be set once at the desk — it is offered again over the
 * finished issue, where the reader can see what they are choosing between.
 */
export function ThemePicker({
  theme,
  onChoose,
  className,
}: {
  theme: ThemeId;
  onChoose: (id: ThemeId) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-medium tracking-[0.28em] text-stone-500 uppercase">Layout</span>
        <span className="text-xs text-stone-500">Sets every picture page in the issue.</span>
      </div>

      {/* Scrolls rather than wraps, so adding a theme later cannot turn one
          row into a grid of two-then-one that reads as two separate groups. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {THEME_LIST.map(entry => (
          <ThemeCard key={entry.id} theme={entry} chosen={entry.id === theme} onChoose={() => onChoose(entry.id)} />
        ))}
      </div>
    </div>
  );
}
