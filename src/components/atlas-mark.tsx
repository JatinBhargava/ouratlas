import { cn } from "@/lib/utils";

/**
 * The brand mark: a capital A cut out of a black tile. It turns a full
 * revolution when the logo is hovered, landing back upright.
 *
 * Lives inside a `group`, so the turn also fires when the wordmark beside it
 * is hovered rather than only the tile itself.
 */
export function AtlasMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "motion-safe:group-hover:animate-turn flex size-7 shrink-0 items-center justify-center rounded-md bg-stone-950 shadow-sm",
        className,
      )}
    >
      <span className="font-editorial text-[17px] leading-none text-white">A</span>
    </span>
  );
}
