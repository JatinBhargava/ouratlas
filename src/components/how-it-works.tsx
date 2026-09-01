import { SectionHeading } from "@/components/section-heading";
import { AlbumScene, PhotoStackScene, StoryScene } from "@/components/step-scenes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SURFACE, SURFACE_LIFT } from "@/lib/surfaces";

const STEPS = [
  {
    scene: PhotoStackScene,
    title: "Add your photos",
    description: "Pick up to ten pictures from the trip. They stay in your browser — nothing is uploaded to a database.",
    note: "10 max",
  },
  {
    scene: StoryScene,
    title: "Tell the story",
    description: "Speak it or type it, up to ten thousand words. Ramble; the layout will find the shape of it.",
    note: "Voice or text",
  },
  {
    scene: AlbumScene,
    title: "Go to press",
    description: "Photos and words imposed as spreads — plates, captions, folios — then exported for keeps.",
    note: "Yours to keep",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="flex flex-col gap-8">
      <SectionHeading
        kicker="Production"
        title="From camera roll to cover story"
        description="Three steps between getting home and holding the finished thing."
      />

      <ol className="grid gap-5 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative">
            {/* Dashed leg to the next stop, echoing the route in the nav. */}
            {i < STEPS.length - 1 && (
              <span
                aria-hidden
                className="absolute top-20 -right-3.5 z-10 hidden w-7 border-t-2 border-dashed border-white/60 md:block"
              />
            )}

            <Card className={cn("group h-full gap-0 pt-0", SURFACE, SURFACE_LIFT)}>
              {/* A look at what the step actually produces. */}
              <div className="relative rounded-t-xl border-b border-stone-200/70 bg-stone-900/4 px-5 pt-8 pb-4">
                <span className="absolute top-3 left-4 text-xs font-semibold text-stone-400 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <step.scene />
              </div>

              <CardHeader className="pt-5">
                <CardTitle className="font-editorial text-2xl font-normal text-stone-900">{step.title}</CardTitle>
                <CardDescription className="text-stone-600">{step.description}</CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                <span className="inline-flex rounded-full bg-stone-900/5 px-2.5 py-1 text-xs font-medium tracking-wide text-stone-600 uppercase">
                  {step.note}
                </span>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
