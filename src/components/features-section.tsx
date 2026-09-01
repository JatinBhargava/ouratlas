import { FileDown, LayoutTemplate, Palette, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

import { SectionHeading } from "@/components/section-heading";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SURFACE, SURFACE_LIFT } from "@/lib/surfaces";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Nothing kept",
    description: "Your photos and words are never written to our database. The finished magazine is yours alone.",
    tile: "bg-emerald-700/10 text-emerald-800",
  },
  {
    icon: LayoutTemplate,
    title: "Editorial spreads",
    description: "Real magazine layouts — plates, columns and pull quotes — chosen to suit each story.",
    tile: "bg-sky-700/10 text-sky-800",
  },
  {
    icon: Sparkles,
    title: "Voice to page",
    description: "Talk through the trip and have it transcribed and shaped into readable prose.",
    tile: "bg-amber-600/15 text-amber-800",
  },
  {
    icon: FileDown,
    title: "Print-quality export",
    description: "Download as PDF at a resolution that holds up on paper, not just on screen.",
    tile: "bg-stone-700/10 text-stone-800",
  },
  {
    icon: Palette,
    title: "Your palette",
    description: "Set the type and colours so the finished magazine reads as yours, not ours.",
    tile: "bg-rose-700/10 text-rose-800",
  },
  {
    icon: WifiOff,
    title: "Works in the browser",
    description: "Assembly happens on your machine, so a patchy connection is not a problem.",
    tile: "bg-indigo-700/10 text-indigo-800",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="flex flex-col gap-8">
      <SectionHeading
        kicker="Contents"
        title="Built around the trip, not the tool"
        description="Everything here exists to get a finished magazine into your hands."
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(feature => (
          <Card key={feature.title} className={cn("group h-full", SURFACE, SURFACE_LIFT)}>
            <CardHeader className="gap-3">
              <span
                className={cn(
                  "flex size-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                  feature.tile,
                )}
              >
                <feature.icon className="size-5" />
              </span>
              <CardTitle className="font-editorial text-2xl font-normal text-stone-900">{feature.title}</CardTitle>
              <CardDescription className="text-stone-600">{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
