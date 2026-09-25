import { useState } from "react";
import { Loader2, Undo2, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { askEditor, type EditorResult } from "@/lib/editor";
import type { Photo } from "@/types";

type EditorPanelProps = {
  title: string;
  story: string;
  photos: Photo[];
  /** Applies the plan to the desk. Returns how to put the desk back as it was. */
  onApply: (plan: EditorResult) => () => void;
  /** Takes the suggested title when the reader had already written one. */
  onUseTitle: (title: string) => void;
};

/**
 * The editor: one button that makes up the issue, and the notes saying why.
 *
 * It changes the desk in one go — style, order, framing, and the title if
 * there was none — rather than proposing changes one at a time, because the
 * choices lean on each other: the cover it picks is the cover for the style it
 * picks. Undo puts every one of them back.
 */
export function EditorPanel({ title, story, photos, onApply, onUseTitle }: EditorPanelProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [undo, setUndo] = useState<(() => void) | null>(null);

  const run = async () => {
    setWorking(true);
    setError(null);

    try {
      const plan = await askEditor({ title, story, photos });
      const restore = onApply(plan);
      // Stored as a value, so wrapped: a bare function handed to a state
      // setter would be called as an updater.
      setUndo(() => restore);
      setNotes(plan.notes);
      // A title the reader wrote is theirs; the editor's is offered, not set.
      setSuggested(title.trim() && plan.title && plan.title !== title.trim() ? plan.title : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The editor could not be reached.");
    } finally {
      setWorking(false);
    }
  };

  const putBack = () => {
    undo?.();
    setUndo(null);
    setNotes([]);
    setSuggested(null);
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-md flex-col gap-1">
          <h3 className="text-sm font-medium text-stone-800">The editor</h3>
          <p className="text-xs text-stone-500">
            An art director looks at your photographs and reads your story, then makes up the issue: the cover, the
            order of the trip, a layout for every page, the framing of each shot and a caption under it.{" "}
            <span className="text-stone-600">
              Small previews of your photographs and your words are sent to an AI provider for this, and not kept.
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => void run()}
          disabled={working || photos.length === 0}
        >
          {working ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
          {working ? "Making up your issue…" : notes.length > 0 ? "Ask again" : "Lay it out for me"}
        </Button>
      </div>

      {photos.length === 0 && <p className="text-xs text-stone-500">Add a photograph first — the editor starts from those.</p>}
      {working && (
        <p className="text-xs text-stone-500">
          Looking at every photograph and reading the story — this takes about half a minute.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {notes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed text-stone-700">
            {notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2">
            {suggested && (
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onClick={() => {
                  onUseTitle(suggested);
                  setSuggested(null);
                }}
              >
                Use the title “{suggested}”
              </Button>
            )}
            {undo && (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={putBack}>
                <Undo2 className="size-4" />
                Put it back as it was
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
