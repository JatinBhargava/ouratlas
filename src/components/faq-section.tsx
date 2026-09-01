import { SectionHeading } from "@/components/section-heading";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SURFACE } from "@/lib/surfaces";

const FAQS = [
  {
    question: "Where are my photos and writing stored?",
    answer:
      "Nowhere on our side. Everything stays in your browser while you work, and the export is the copy you keep. We do not write your photos or text to a database.",
  },
  {
    question: "Why only ten photos?",
    answer:
      "A tight limit makes for a better magazine. Ten pictures is enough to carry a feature, and it keeps the spreads from turning into a contact sheet.",
  },
  {
    question: "How long can the story be?",
    answer:
      "Between roughly five and ten thousand words, whether you type it or speak it. That is a long magazine feature — more than most trips need.",
  },
  {
    question: "What do I get when I export?",
    answer:
      "A self-contained magazine you can open in any browser, and on paid plans a press-ready PDF imposed for a real printer.",
  },
  {
    question: "Do I need an account?",
    answer: "Only to keep a subscription and pick up where you left off across devices. You can go to press without one.",
  },
  {
    question: "Can I cancel whenever I want?",
    answer: "Yes. Plans are monthly and stop at the end of the period. Albums you have already exported stay yours.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="flex flex-col gap-8">
      <SectionHeading
        kicker="Letters to the editor"
        title="Questions worth asking"
        description="The things people want to know before they start."
      />

      <Card className={cn("px-2 py-2 sm:px-4", SURFACE)}>
        <Accordion type="single" collapsible>
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={faq.question}
              value={faq.question}
              className={cn("px-3 transition-colors hover:bg-stone-900/3", i === FAQS.length - 1 && "border-b-0")}
            >
              <AccordionTrigger className="gap-4 text-left text-base font-medium text-stone-900">
                <span className="flex items-baseline gap-3">
                  <span className="text-xs text-stone-400 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {faq.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pl-9 text-stone-600">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>
    </section>
  );
}
