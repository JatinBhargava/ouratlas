import { useVisitorCount } from "@/hooks/use-visitor-count";
import { cn } from "@/lib/utils";

/**
 * The small editorial line in the navigation, where a magazine prints its
 * circulation and edition.
 *
 * Two things can go here and the slot is never empty. When the visitor count is
 * known it is stated the way a masthead states one — as circulation, which is
 * what a readership figure is called in print. When it is not, the line falls
 * back to the edition, which needs no data and changes through the day, so the
 * nav still reads as a periodical rather than an app chrome bar.
 */

/** Editions as an evening paper would name them, by the reader's own clock. */
function editionFor(hour: number): string {
  if (hour < 5) return "Late Edition";
  if (hour < 11) return "Morning Edition";
  if (hour < 17) return "Afternoon Edition";
  if (hour < 22) return "Evening Edition";
  return "Late Edition";
}

const circulation = new Intl.NumberFormat("en");

export function MastheadNote({ className }: { className?: string }) {
  const visitors = useVisitorCount();

  // Read once per render rather than kept in state: the line is decoration, and
  // a timer ticking all day to move it between two words would cost more than
  // it is worth. It settles on the right edition at the next navigation.
  const edition = editionFor(new Date().getHours());

  return (
    <span
      className={cn(
        "flex items-center gap-2 rounded-full px-2 text-[10px] font-medium tracking-[0.16em] whitespace-nowrap text-stone-500 uppercase",
        className,
      )}
      title={
        visitors === null
          ? "Every issue is set fresh in your browser"
          : "Readers who have passed through the press"
      }
    >
      {/* The same hairline rule the hero uses either side of its kicker. */}
      <span aria-hidden className="h-px w-4 bg-stone-300" />

      {visitors === null ? (
        <>
          Vol. I
          <span aria-hidden className="text-stone-300">
            ·
          </span>
          {edition}
        </>
      ) : (
        <>
          <span className="font-semibold text-stone-800 tabular-nums">{circulation.format(visitors)}</span>
          in circulation
        </>
      )}
    </span>
  );
}
