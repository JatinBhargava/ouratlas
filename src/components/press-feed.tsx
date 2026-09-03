/**
 * The moment an issue goes out: a sheet drawn into the press.
 *
 * Exporting is a claim on the server, then every photograph decoded, then the
 * browser's own print dialog — a second or two in which the page looks like it
 * ignored the button. This covers it with the thing that is actually
 * happening, and gives the wait a shape rather than a spinner.
 *
 * Held for one full cycle at least, so the sheet is never caught halfway.
 */
export const FEED_MS = 1_400;

export function PressFeed() {
  return (
    // Fixed and non-interactive: it sits over the issue without taking the
    // clicks, and never prints — a print dialog opens while this is on screen,
    // and an overlay in the PDF would be the first page of the magazine.
    <div
      role="status"
      aria-label="Sending your issue to the press"
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm print:hidden"
    >
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-white/50 bg-white/90 px-12 py-9 shadow-lg shadow-black/10 backdrop-blur-md">
        <div className="relative flex h-20 w-24 items-end justify-center">
          {/* The sheet, behind the press so it disappears into the slot. */}
          <span
            aria-hidden
            className="animate-feed absolute top-0 z-0 h-11 w-14 rounded-[3px] border border-stone-200 bg-white shadow-sm"
          />
          <span aria-hidden className="relative z-10 h-9 w-24 rounded-lg bg-stone-800" />
          <span aria-hidden className="absolute bottom-8 z-20 h-[3px] w-16 rounded-full bg-stone-600" />
        </div>

        <p className="text-sm text-stone-700">Taking the paper in…</p>
      </div>
    </div>
  );
}
