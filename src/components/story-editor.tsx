import { useEffect, useRef, useState } from "react";
import { Mic, PenLine } from "lucide-react";

import { CopyDesk } from "@/components/copy-desk";
import { RecordingBar, SpeakPanel, UploadBar, useDictation, useFileTranscription } from "@/components/dictation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

export const MIN_WORDS = 500;

type StoryEditorProps = {
  story: string;
  onChange: (value: string) => void;
  wordCount: number;
  /** The longest story the reader's plan allows (`PLAN_LIMITS`). */
  maxWords: number;
  /** Called when an edited version is kept, so the colophon can say so. */
  onPolish: (value: string) => void;
  /** Signs in from the Speak tab, putting the desk away first so it comes back. */
  onSignIn: () => void;
  /** Which tab to show; the page sets "speak" when a reader returns from signing in to record. */
  openOn?: StoryTab;
};

export type StoryTab = "write" | "speak";


export function StoryEditor({ story, onChange, wordCount, maxWords, onPolish, onSignIn, openOn }: StoryEditorProps) {
  const over = wordCount > maxWords;

  const [tab, setTab] = useState<StoryTab>(openOn ?? "write");
  useEffect(() => {
    if (openOn) setTab(openOn);
  }, [openOn]);

  const latest = useRef(story);
  latest.current = story;

  /**
   * The copy as it stood when the recording began. Each update from the
   * microphone is the whole recording so far, set after this as a new
   * paragraph — so a phrase whose wording is corrected as it completes simply
   * replaces its draft, with nothing to stitch. The copy is read-only while
   * recording, which is what makes that safe: nothing typed can be lost under it.
   */
  const base = useRef("");
  const setAfterBase = (text: string) => {
    if (!text) return;
    onChange(base.current ? `${base.current}\n\n${text}` : text);
  };
  const dictation = useDictation(setAfterBase);
  const upload = useFileTranscription(setAfterBase);
  const startDictation = () => {
    base.current = latest.current.trimEnd();
    return dictation.start();
  };
  const startUpload = (file: File) => {
    base.current = latest.current.trimEnd();
    return upload.start(file);
  };
  const transcribing = upload.name !== null;
  const listening = dictation.recording || dictation.finishing || transcribing;

  // Recording and uploads start from Speak and are watched from Write.
  useEffect(() => {
    if (dictation.recording || transcribing) setTab("write");
  }, [dictation.recording, transcribing]);

  // Keep the newest words in view as they arrive.
  const copy = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (listening && copy.current) copy.current.scrollTop = copy.current.scrollHeight;
  }, [story, listening]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-editorial text-2xl text-stone-900">The copy</h2>
        <p className={`text-sm tabular-nums ${over ? "text-red-600" : "text-stone-500"}`}>
          {wordCount.toLocaleString()} / {maxWords.toLocaleString()} words
        </p>
      </div>

      <Tabs value={tab} onValueChange={value => setTab(value as StoryTab)}>
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
          {(dictation.recording || dictation.finishing) && <RecordingBar dictation={dictation} />}
          {transcribing && <UploadBar upload={upload} />}
          {/* The editor has moved here by the time a recording or upload fails, so the reason is shown here too. */}
          {!listening && (upload.error ?? dictation.error) && (
            <p className="text-sm text-red-600">{upload.error ?? dictation.error}</p>
          )}
          <Textarea
            ref={copy}
            value={story}
            readOnly={listening}
            aria-busy={listening}
            onChange={event => onChange(event.target.value)}
            placeholder="Where did you go, who were you with, and what do you want to remember about it?"
            className="min-h-64 resize-y bg-white/70 text-base leading-relaxed"
          />
          <Progress
            value={Math.min(100, (wordCount / MIN_WORDS) * 100)}
            aria-label={`Story length: ${wordCount.toLocaleString()} of ${MIN_WORDS.toLocaleString()} words`}
            className="h-1.5"
          />
          <p className="text-sm text-stone-500">
            {wordCount >= MIN_WORDS
              ? "Plenty to work with. Keep going if there's more."
              : `About ${(MIN_WORDS - wordCount).toLocaleString()} more words for a full feature.`}
          </p>

          {/* Out of the way while recording: an edit kept now would be written over by the next phrase. */}
          {!listening && <CopyDesk story={story} onAccept={onPolish} />}
        </TabsContent>

        <TabsContent value="speak" className="mt-4">
          <SpeakPanel
            dictation={{ ...dictation, start: startDictation }}
            upload={{ ...upload, start: startUpload }}
            onSignIn={onSignIn}
            full={wordCount >= maxWords}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
