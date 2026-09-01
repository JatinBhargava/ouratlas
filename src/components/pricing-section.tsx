import { Check, Compass, Map, Tent } from "lucide-react";
import { Link } from "react-router";

import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Plan = {
  name: string;
  icon: typeof Compass;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Wanderer",
    icon: Tent,
    price: "Free",
    cadence: "one story at a time",
    description: "A keepsake from a single trip.",
    features: ["10 photos per story", "Up to 5,000 words", "Web export", "Two layout themes"],
    cta: "Start your first story",
  },
  {
    name: "Traveller",
    icon: Compass,
    price: "$6",
    cadence: "per month",
    description: "For more than one story a year.",
    features: [
      "Unlimited stories",
      "Up to 10,000 words",
      "Print-quality PDF export",
      "All layout themes",
      "Voice transcription",
    ],
    cta: "Choose Traveller",
    featured: true,
  },
  {
    name: "Cartographer",
    icon: Map,
    price: "$14",
    cadence: "per month",
    description: "Full control of how it looks.",
    features: [
      "Everything in Traveller",
      "Custom fonts and palettes",
      "Editable page layouts",
      "Bulk export",
      "Priority support",
    ],
    cta: "Choose Cartographer",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="flex flex-col gap-8">
      <SectionHeading
        kicker="Subscriptions"
        title="Keep the whole journey"
        description="Your photos and words never touch our database — every plan sends the finished magazine straight to you."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map(plan => (
          <Card
            key={plan.name}
            className={cn(
              "flex h-full flex-col gap-0 rounded-2xl p-7 shadow-sm transition-colors duration-200",
              plan.featured
                ? "border-stone-900 bg-stone-900 text-white"
                : "border-white/60 bg-white/85 backdrop-blur-md hover:border-stone-300",
            )}
          >
            <header className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span
                  className={cn(
                    "text-[11px] font-medium tracking-[0.18em] uppercase",
                    plan.featured ? "text-white/55" : "text-stone-500",
                  )}
                >
                  {plan.name}
                </span>
                <span className={cn("text-sm", plan.featured ? "text-white/70" : "text-stone-500")}>
                  {plan.description}
                </span>
              </div>
              <plan.icon className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-white/30" : "text-stone-300")} />
            </header>

            <p className="mt-7 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-5xl font-medium tracking-tight",
                  plan.featured ? "text-white" : "text-stone-900",
                )}
              >
                {plan.price}
              </span>
              <span className={cn("text-sm", plan.featured ? "text-white/50" : "text-stone-400")}>{plan.cadence}</span>
            </p>

            <hr className={cn("mt-7", plan.featured ? "border-white/15" : "border-stone-200")} />

            <ul className="mt-6 flex grow flex-col gap-3 text-sm">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check
                    className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-white/45" : "text-stone-400")}
                    strokeWidth={2.5}
                  />
                  <span className={plan.featured ? "text-white/85" : "text-stone-700"}>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={plan.featured ? "secondary" : "outline"}
              className={cn(
                "mt-8 w-full rounded-full",
                plan.featured
                  ? "bg-white text-stone-900 hover:bg-white/90"
                  : "border-stone-300 bg-transparent text-stone-800 hover:bg-stone-900 hover:text-white",
              )}
            >
              <Link to="/create">{plan.cta}</Link>
            </Button>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-white/75 drop-shadow-sm">
        Monthly, cancel whenever. Anything you have sent to press stays yours.
      </p>
    </section>
  );
}
