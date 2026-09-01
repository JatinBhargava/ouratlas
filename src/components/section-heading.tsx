import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** Standfirst above the title, set as a magazine section rubric. */
  kicker?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

/** Section masthead: rubric, display headline, standfirst. */
export function SectionHeading({ kicker, title, description, align = "center" }: SectionHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", align === "center" && "items-center text-center")}>
      {kicker && (
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          {kicker}
          <span aria-hidden className="h-px w-6 bg-white/40" />
        </span>
      )}

      <h2 className="font-editorial text-4xl leading-tight tracking-tight text-white drop-shadow-md sm:text-5xl">
        {title}
      </h2>

      {description && <p className="max-w-prose text-white/90 drop-shadow-sm">{description}</p>}
    </div>
  );
}
