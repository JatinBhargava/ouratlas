import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { Loader2, LogIn, Undo2, WandSparkles } from "lucide-react";

import { DirectionPicker } from "@/components/direction-picker";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { readAiAllowance } from "@/lib/ai";
import { askEditor, type EditorResult, type EditorStep } from "@/lib/editor";
import { directionOf, PLAN_LIMITS, type AiAllowance, type EditorDirection, type Photo } from "@/types";

type EditorPanelProps = {
  title: string;
  story: string;
  photos: Photo[];
  /** The look to ask for, kept on the desk so it survives the sign-in redirect. */
  direction: EditorDirection;
  onDirection: (next: EditorDirection) => void;
  /** Applies the plan to the desk. Returns how to put the desk back as it was. */
  onApply: (plan: EditorResult) => () => void;
  /** Takes the suggested title when the reader had already written one. */
  onUseTitle: (title: string) => void;
  /** The editor wants an account and there is none yet. */
  needsSignIn: boolean;
  /** There is an account, so there is an allowance to show. */
  signedIn: boolean;
  /** Signs in from here, putting the desk away first so it comes back. */
  onSignIn: () => void;
};

/**
 * The editor: one button that makes up the issue, and the notes saying why.
 *
 * It changes the desk in one go — style, order, framing, and the title if
 * there was none — rather than proposing changes one at a time, because the
 * choices lean on each other: the cover it picks is the cover for the style it
 * picks. Undo puts every one of them back.
 */
export function EditorPanel({
  title,
  story,
  photos,
  direction,
  onDirection,
  onApply,
  onUseTitle,
  needsSignIn,
  signedIn,
  onSignIn,
}: EditorPanelProps) {
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState<EditorStep | null>(null);
  /** This month's designs, as the server counts them; null until asked or when it cannot say. */
  const [allowance, setAllowance] = useState<AiAllowance | null>(null);

  const refresh = useCallback(() => {
    readAiAllowance()
      .then(setAllowance)
      // An older server, or accounts switched off: the button still works and
      // the server still refuses when it must, so the count is simply not shown.
      .catch(() => setAllowance(null));
  }, []);

  useEffect(() => {
    if (signedIn) refresh();
    else setAllowance(null);
  }, [signedIn, refresh]);

  const spent = allowance !== null && allowance.editor.remaining === 0;
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [undo, setUndo] = useState<(() => void) | null>(null);

  const run = async () => {
    setWorking(true);
    setError(null);

    try {
      const plan = await askEditor({ title, story, photos, direction }, setStep);
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
      setStep(null);
      // After a failure too: a design that failed upstream is given back.
      if (signedIn) refresh();
    }
  };

  // "Your own" with nothing written goes out as the editor's own judgement
  // (`askEditor`), so the button says what will actually happen.
  const named = direction.id !== "editor" && (direction.id !== "custom" || direction.note.trim().length > 0);
  const actionLabel = named
    ? `Lay it out${direction.id === "custom" ? " to my brief" : ` as ${directionOf(direction.id).name}`}`
    : "Lay it out for me";

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
            order of the story, a layout for every page, the framing of each shot and a caption under it. Pick a look
            below, or describe your own.{" "}
            <span className="text-stone-600">
              Small previews of your photographs and your words are sent to an AI provider for this, and not kept.
            </span>
          </p>
        </div>

        {needsSignIn ? (
          <Button variant="outline" size="sm" className="rounded-full" onClick={onSignIn}>
            <LogIn className="size-4" />
            Sign in to use the editor
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void run()}
            disabled={working || photos.length === 0 || spent}
          >
            {working ? <Loader2 className="size-4 animate-spin" /> : <WandSparkles className="size-4" />}
            {working ? "Making up your issue…" : notes.length > 0 ? "Ask again" : actionLabel}
          </Button>
        )}
      </div>

      <DirectionPicker value={direction} onChange={onDirection} disabled={working} />

      {needsSignIn && (
        <p className="text-xs text-stone-500">
          Free with an account: {PLAN_LIMITS.free.editor} designs a month on Wanderer, and your desk is kept exactly as
          it is while you sign in.
        </p>
      )}
      {allowance && (
        <p className={`text-xs tabular-nums ${spent ? "text-red-600" : "text-stone-500"}`}>
          {spent ? "This month's designs are used" : `${allowance.editor.remaining} of ${allowance.editor.limit} designs left this month`}
          {allowance.plan !== "cartographer" && (
            <>
              {" · "}
              <Link to="/pricing" className="underline underline-offset-2">
                {allowance.plan === "free" ? `Traveller includes ${PLAN_LIMITS.traveller.editor}` : `Cartographer includes ${PLAN_LIMITS.cartographer.editor}`}
              </Link>
            </>
          )}
        </p>
      )}

      {photos.length === 0 && <p className="text-xs text-stone-500">Add a photograph first — the editor starts from those.</p>}
      {working && step && <EditorProgress step={step} />}
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

/** How long the editor usually takes to answer, from sending to the plan arriving. */
const USUAL_S = 40;

/**
 * What the editor does while the reader waits, in the order it does it. Its
 * call sends nothing back until it answers, so these are paced by the clock
 * against how long it usually takes — what it is doing, not a report of where
 * it has got to.
 */
const THINKING = [
  { from: 0, label: "Looking at every photograph" },
  { from: 6, label: "Reading the story" },
  { from: 13, label: "Choosing the cover and the order" },
  { from: 20, label: "Drawing every page" },
  { from: 32, label: "Writing the captions" },
  { from: 44, label: "Finishing — a long story takes a little longer" },
];

/**
 * The wait for the editor, shown as it goes. The previews are counted, and the
 * pages are set the moment the plan lands; between the two the bar eases
 * towards nine tenths on the clock and never claims to be done before it is.
 */
function EditorProgress({ step }: { step: EditorStep }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (step.stage !== "thinking") return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [step]);

  let value: number;
  let label: string;
  let detail = "";
  if (step.stage === "previews") {
    value = step.total ? (step.done / step.total) * 8 : 8;
    label = "Making small previews of your photographs";
    detail = `${step.done} of ${step.total}`;
  } else if (step.stage === "thinking") {
    const seconds = Math.max(0, (now - step.since) / 1000);
    value = 8 + 84 * (1 - Math.exp(-seconds / (USUAL_S * 0.55)));
    label = [...THINKING].reverse().find(entry => seconds >= entry.from)!.label;
    detail = `${Math.floor(seconds)}s · usually about ${USUAL_S}s`;
  } else {
    value = 97;
    label = "Setting your pages";
  }

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-stone-700">{label}…</span>
        <span className="shrink-0 text-stone-400 tabular-nums">{detail}</span>
      </div>
      <Progress value={value} aria-label="The editor's progress" className="h-1.5" />
    </div>
  );
}
