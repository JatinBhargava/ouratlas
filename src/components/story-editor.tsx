import { Mic, PenLine } from "lucide-react";

import { CopyDesk } from "@/components/copy-desk";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const MIN_WORDS = 500;
export const MAX_WORDS = 10000;

type StoryEditorProps = {
  story: string;
  onChange: (value: string) => void;
  wordCount: number;
  /** Called when an edited version is kept, so the colophon can say so. */
  onPolish: (value: string) => void;
};

export function StoryEditor({ story, onChange, wordCount, onPolish }: StoryEditorProps) {
  const over = wordCount > MAX_WORDS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-editorial text-2xl text-stone-900">The copy</h2>
        <p className={`text-sm tabular-nums ${over ? "text-red-600" : "text-stone-500"}`}>
          {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
        </p>
      </div>

      <Tabs defaultValue="write">
        <TabsList className="rounded-full">
          <TabsTrigger value="write" className="rounded-full">
            <PenLine className="size-4" />
            Write
          </TabsTrigger>
          <TabsTrigger value="speak" className="rounded-full">
            <Mic className="size-4" />
            Speak
          </TabsTrigger>
        </TabsList>

        <TabsContent value="write" className="mt-4 flex flex-col gap-3">
          <Textarea
            value={story}
            onChange={event => onChange(event.target.value)}
            placeholder="Where did you go, who were you with, and what do you want to remember about it?"
            className="min-h-64 resize-y bg-white/70 text-base leading-relaxed"
          />
          <Progress value={Math.min(100, (wordCount / MIN_WORDS) * 100)} className="h-1.5" />
          <p className="text-sm text-stone-500">
            {wordCount >= MIN_WORDS
              ? "Plenty to work with. Keep going if there's more."
              : `About ${(MIN_WORDS - wordCount).toLocaleString()} more words for a full feature.`}
          </p>

          <CopyDesk story={story} onAccept={onPolish} />
        </TabsContent>

        <TabsContent value="speak" className="mt-4">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-700 text-white">
              <Mic className="size-6" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="font-medium text-stone-800">Talk it through</p>
              <p className="max-w-sm text-sm text-stone-500">
                Say it out loud and we'll turn it into prose you can edit. Recording isn't wired up yet.
              </p>
            </div>
            <Button disabled className="rounded-full">
              Start recording
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
