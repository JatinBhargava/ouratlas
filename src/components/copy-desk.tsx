import { useRef, useState } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { streamPolish } from "@/lib/polish";

type CopyDeskProps = {
  story: string;
  onAccept: (story: string) => void;
};

/**
 * An optional copy-editing pass.
 *
 * Everything else in Atlas happens in this tab. This does not, and says so
 * plainly rather than burying it: the words are sent away to be edited, the
 * edit comes back, and you choose whether to keep it. Photographs are never
 * part of it.
 */
export function CopyDesk({ story, onAccept }: CopyDeskProps) {
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async () => {
    setWorking(true);
    setDraft("");
    setError(null);
    abort.current = new AbortController();

    try {
      for await (const piece of streamPolish(story, abort.current.signal)) {
        setDraft(current => current + piece);
      }
    } catch (problem) {
      if ((problem as Error).name !== "AbortError") {
        setError((problem as Error).message);
        setDraft("");
      }
    } finally {
      setWorking(false);
      abort.current = null;
    }
  };

  const stop = () => abort.current?.abort();

  const accept = () => {
    onAccept(draft.trim());
    setDraft("");
  };

  const ready = draft.length > 0 && !working;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium text-stone-800">The copy desk</h3>
          <p className="max-w-md text-xs text-stone-500">
            An editor's pass for rhythm and grammar, keeping your voice and your facts.{" "}
            <span className="text-stone-600">
              This is the one part of Atlas that sends anything out of your browser — your words go away to be edited
              and are not kept. Your photos never leave this tab.
            </span>
          </p>
        </div>

        {working ? (
          <Button variant="outline" size="sm" className="rounded-full" onClick={stop}>
            <Loader2 className="size-4 animate-spin" />
            Stop
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="rounded-full" onClick={run} disabled={story.trim().length === 0}>
            <Sparkles className="size-4" />
            {draft ? "Try again" : "Polish the writing"}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {(working || draft) && (
        <div className="flex flex-col gap-3">
          <div className="max-h-64 overflow-y-auto rounded-xl bg-white p-3 ring-1 ring-stone-200">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-stone-700">
              {draft}
              {working && <span className="animate-caret ml-px inline-block h-4 w-px translate-y-0.5 bg-stone-500" />}
            </p>
          </div>

          {ready && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="rounded-full" onClick={accept}>
                Keep this version
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setDraft("")}>
                <Undo2 className="size-4" />
                Discard
              </Button>
              <p className="text-xs text-stone-500">Keeping it replaces the text above. Your original is not saved.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
