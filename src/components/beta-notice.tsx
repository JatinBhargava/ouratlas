import { PenLine } from "lucide-react";

/**
 * The site-wide beta strip, between the nav and whatever the page opens with.
 *
 * Atlas is usable but unfinished — subscriptions cannot take a card yet, and
 * the layout engine is still moving. Saying so once, at the top, is cheaper
 * than having a reader discover it at the point where it costs them something.
 *
 * It sits inside `<main>` rather than under the fixed nav, so it scrolls away
 * with the page: a permanent second bar would eat the top of every screen.
 * Delete the element from `RootLayout` when the beta ends.
 */
export function BetaNotice() {
  return (
    <div className="mb-8 flex justify-center sm:mb-10 print:hidden">
      <p
        role="status"
        className="flex items-center gap-2 rounded-full border border-red-200/70 bg-red-50/85 px-4 py-1.5 text-xs text-red-900 shadow-sm backdrop-blur-md sm:text-sm"
      >
        <PenLine className="size-3.5 shrink-0 text-red-500" aria-hidden />
        <span>
          <span className="font-medium">Working proof</span> — Atlas is in beta, so expect the odd rough edge while the
          type is still being set.
        </span>
      </p>
    </div>
  );
}
