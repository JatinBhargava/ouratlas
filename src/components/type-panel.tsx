import { useEffect, useState } from "react";
import { AlignJustify, AlignLeft } from "lucide-react";

import {
  BODY_FACES,
  FACES,
  FACE_IDS,
  LEADING,
  SIZE,
  type Alignment,
  type FaceId,
  type TypeChoice,
} from "@/lib/magazine/typography";
import { cn } from "@/lib/utils";

/**
 * A slider that shows every step but only reports the last one.
 *
 * Body type is measured type: moving this by one notch re-fits every box on
 * every page. Reporting on each frame of a drag would set the whole issue
 * forty times on the way to the value the reader wanted, so the label follows
 * the thumb and the issue follows the release.
 */
function Range({
  value,
  min,
  max,
  step,
  label,
  format,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  format: (value: number) => string;
  onCommit: (value: number) => void;
}) {
  const [live, setLive] = useState(value);
  // Follows the value home when it is changed from anywhere else — another
  // control, a restored draft, a reset.
  useEffect(() => setLive(value), [value]);

  const commit = () => {
    if (live !== value) onCommit(live);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-[11px] text-stone-500">
        {label}
        <span className="tabular-nums">{format(live)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={live}
        onChange={event => setLive(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-emerald-600"
      />
    </label>
  );
}

function Faces({
  value,
  options,
  label,
  onChange,
}: {
  value: FaceId;
  options: FaceId[];
  label: string;
  onChange: (id: FaceId) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] text-stone-500">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={id === value}
            // Each name is set in the face it names, which says more than the
            // name does.
            style={{ fontFamily: FACES[id].stack }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              id === value
                ? "border-emerald-600 bg-emerald-50 text-stone-900 ring-1 ring-emerald-600"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
            )}
          >
            {FACES[id].name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * How the reader's own pages are set.
 *
 * Every control here changes what the fitter measures, so each one sets the
 * issue again — which is why the sliders report on release and the buttons
 * report at once. A face is a single decision; a size is forty on the way past.
 */
export function TypePanel({
  type,
  onChange,
  className,
}: {
  type: TypeChoice;
  onChange: (next: TypeChoice) => void;
  className?: string;
}) {
  const set = <K extends keyof TypeChoice>(key: K, value: TypeChoice[K]) =>
    onChange({ ...type, [key]: value });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[11px] font-medium tracking-[0.28em] text-stone-500 uppercase">Type</span>
        <span className="text-xs text-stone-500">Sets the issue again — the body face decides where lines break.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Faces label="Headlines" value={type.display} options={FACE_IDS} onChange={id => set("display", id)} />
          <Faces label="Body" value={type.body} options={BODY_FACES} onChange={id => set("body", id)} />
        </div>

        <div className="flex flex-col gap-3">
          <Range
            label="Size"
            value={type.size}
            min={SIZE.min}
            max={SIZE.max}
            step={SIZE.step}
            format={v => `${v}px`}
            onCommit={v => set("size", v)}
          />
          <Range
            label="Leading"
            value={type.leading}
            min={LEADING.min}
            max={LEADING.max}
            step={LEADING.step}
            format={v => v.toFixed(2)}
            onCommit={v => set("leading", v)}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-stone-500">Alignment</span>
            <div className="flex gap-1">
              {(
                [
                  ["justify", "Justified", AlignJustify],
                  ["left", "Ragged right", AlignLeft],
                ] as [Alignment, string, typeof AlignLeft][]
              ).map(([id, name, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => set("align", id)}
                  aria-pressed={id === type.align}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    id === type.align
                      ? "border-emerald-600 bg-emerald-50 text-stone-900 ring-1 ring-emerald-600"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
