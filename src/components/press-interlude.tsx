import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * The screen between signing in and the press.
 *
 * Coming back from Google means reading the desk out of storage, waiting for
 * the webfont and setting the copy against it — real work, and long enough
 * that a bare spinner reads as a stall. So it is narrated instead: the stages
 * below are the ones actually happening, in the order they happen, and the
 * reader is told what is being done with their trip rather than asked to
 * wait and hope.
 *
 * It also gives the work a floor to finish in. `onFinished` fires when the
 * last stage lands, and the desk waits for both that and the composed issue
 * before moving — so nobody sees this flash past in 200ms on a fast machine
 * and nobody is dropped into a half-set magazine on a slow one.
 */

/** Long enough to read, short enough not to be a toll. */
const STAGE_MS = 600;

const STAGES = [
  "Gathering your photographs",
  "Fitting the copy",
  "Setting the type",
  "Making up the pages",
] as const;

/** The whole interlude, so callers can reason about the floor it imposes. */
export const INTERLUDE_MS = STAGES.length * STAGE_MS;

export function PressInterlude({ onFinished }: { onFinished: () => void }) {
  /** How many stages are behind us. Equal to the length means finished. */
  const [done, setDone] = useState(0);

  useEffect(() => {
    const timers = STAGES.map((_, index) =>
      setTimeout(() => {
        setDone(index + 1);
        if (index === STAGES.length - 1) onFinished();
      }, STAGE_MS * (index + 1)),
    );

    return () => timers.forEach(clearTimeout);
  }, [onFinished]);

  return (
    <div className="flex flex-col items-center py-16 sm:py-24">
      <div className="w-full max-w-sm rounded-2xl border border-white/50 bg-white/85 p-7 shadow-lg shadow-black/10 backdrop-blur-md">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-stone-500 uppercase">
          <span aria-hidden className="h-px w-6 bg-stone-300" />
          To press
        </span>

        {/*
          One live region for the lot: a screen reader should hear the stage
          that is running, not four separate announcements racing each other.
        */}
        <ul className="mt-6 flex flex-col gap-3" aria-live="polite" aria-busy={done < STAGES.length}>
          {STAGES.map((stage, index) => {
            const finished = index < done;
            const running = index === done;

            return (
              <li
                key={stage}
                className={`flex items-center gap-3 text-sm transition-opacity duration-300 motion-reduce:transition-none ${
                  finished || running ? "text-stone-800 opacity-100" : "text-stone-500 opacity-40"
                }`}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {finished ? (
                    <Check className="size-4 text-emerald-600" strokeWidth={2.5} />
                  ) : running ? (
                    <Loader2 className="size-4 animate-spin text-stone-400" />
                  ) : (
                    <span aria-hidden className="size-1.5 rounded-full bg-stone-300" />
                  )}
                </span>
                {stage}
              </li>
            );
          })}
        </ul>

        <div className="mt-7 h-0.5 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full rounded-full bg-linear-to-r from-sky-500 to-emerald-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${(done / STAGES.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
