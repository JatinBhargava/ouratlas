import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** Standfirst above the title, set as a magazine section rubric. */
  kicker?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  /**
   * The heading level. A section is an `h2` under the page's own headline,
   * but where the section is the whole page — the plans at /pricing — its
   * title is the headline, and a page with no `h1` gives search engines and
   * screen readers nothing to take as its subject.
   */
  as?: "h1" | "h2";
};

/** Section masthead: rubric, display headline, standfirst. */
export function SectionHeading({ kicker, title, description, align = "center", as: Heading = "h2" }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center")}>
      {kicker && (
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          {kicker}
          <span aria-hidden className="h-px w-6 bg-white/40" />
        </span>
      )}

      <Heading className="font-editorial text-4xl leading-tight tracking-tight text-white drop-shadow-md sm:text-5xl">
        {title}
      </Heading>

      {description && <p className="max-w-prose text-white/90 drop-shadow-sm">{description}</p>}
    </div>
  );
}
