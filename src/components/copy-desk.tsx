import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Loader2, Lock, LogIn, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { readAiAllowance } from "@/lib/ai";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { streamPolish, type PolishMode } from "@/lib/polish";
import { hasCopyDesk, PLAN_LIMITS, type AiAllowance } from "@/types";

type CopyDeskProps = {
  story: string;
  onAccept: (story: string) => void;
  /** Signs in from here, putting the desk away first so it comes back as it was. */
  onSignIn: () => void;
};

/**
 * What each mode is called and what it promises, kept in one place so the
 * heading, the button and the warning cannot drift apart.
 *
 * The difference the copy matters most about is what happens to the facts:
 * one pass keeps them, the other is allowed to make things up.
 */
const MODES: { id: PolishMode; label: string; action: string; blurb: string }[] = [
  {
    id: "edit",
    label: "Copy edit",
    action: "Polish the writing",
    blurb: "An editor's pass for rhythm and grammar, keeping your voice and your facts.",
  },
  {
    id: "story",
    label: "Travel story",
    action: "Write the story",
    blurb:
      "A travel writer's retelling: your notes become a short piece of fiction with a character and an arc. It invents people, dialogue and events, so treat what comes back as a story rather than a record of the trip.",
  },
];

/**
 * An optional pass over the writing.
 *
 * Everything else in Atlas happens in this tab. This does not, and says so
 * plainly rather than burying it: the words are sent away, the reply comes
 * back, and you choose whether to keep it. Photographs are never part of it.
 */
export function CopyDesk({ story, onAccept, onSignIn }: CopyDeskProps) {
  // The server decides this too, and its answer is the one that counts. This
  // is only so a plan that does not include the desk says so before somebody
  // writes 2,000 words and then hits a 402. Every plan has passes now, so the
  // lock is kept for a plan set back to none; the usual gate is signing in,
  // because the passes are counted against an account.
  const { user, billing, loadingBilling } = useAuth();
  const signedOut = !user;
  const locked = !signedOut && !loadingBilling && !hasCopyDesk(billing.plan);

  /** This month's passes, as the server counts them; null until asked or when it cannot say. */
  const [allowance, setAllowance] = useState<AiAllowance | null>(null);
  const refresh = useCallback(() => {
    readAiAllowance()
      .then(setAllowance)
      // An older server: the button still works and the server still refuses
      // when it must, so the count is simply not shown.
      .catch(() => setAllowance(null));
  }, []);
  useEffect(() => {
    if (user) refresh();
    else setAllowance(null);
  }, [user, refresh]);
  const spent = allowance !== null && allowance.polish.remaining === 0;

  const [mode, setMode] = useState<PolishMode>("edit");
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const chosen = MODES.find(option => option.id === mode)!;

  const run = async () => {
    setWorking(true);
    setDraft("");
    setError(null);
    abort.current = new AbortController();

    try {
      for await (const piece of streamPolish(story, mode, abort.current.signal)) {
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
      // After a failure too: a pass that failed before any text arrived is given back.
      refresh();
    }
  };

  const stop = () => abort.current?.abort();

  /** Switching mode discards the previous reply — it answered a different question. */
  const choose = (next: PolishMode) => {
    if (next === mode || working) return;
    setMode(next);
    setDraft("");
    setError(null);
  };

  const accept = () => {
    onAccept(draft.trim());
    setDraft("");
  };

  const ready = draft.length > 0 && !working;

  /**
   * The button, or the reason there isn't one.
   *
   * A disabled button swallows its own hover events, so the locked version is
   * a span the tooltip can hang off — and the reason is worth reading, since
   * nothing else in the magazine is behind a plan.
   */
  const action = signedOut ? (
    <Button variant="outline" size="sm" className="rounded-full" onClick={onSignIn}>
      <LogIn className="size-4" />
      Sign in to use the copy desk
    </Button>
  ) : locked ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="inline-flex cursor-default items-center gap-2 rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-500"
        >
          <Lock className="size-4" />
          {chosen.action}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        The copy desk is the one page of the magazine you cannot set yourself. It comes with{" "}
        <span className="font-medium">Traveller</span> and <span className="font-medium">Cartographer</span> — your
        photographs, your pages and the export stay yours on all plans.{" "}
        <Link to="/pricing" className="underline underline-offset-2">
          See the plans
        </Link>
        .
      </TooltipContent>
    </Tooltip>
  ) : working ? (
    <Button variant="outline" size="sm" className="rounded-full" onClick={stop}>
      <Loader2 className="size-4 animate-spin" />
      Stop
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={run}
      disabled={loadingBilling || spent || story.trim().length === 0}
    >
      <Sparkles className="size-4" />
      {draft ? "Try again" : chosen.action}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-stone-800">The copy desk</h3>

          <div className="flex w-fit rounded-full bg-stone-100 p-0.5 ring-1 ring-stone-200">
            {MODES.map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                disabled={working || locked || signedOut}
                aria-pressed={option.id === mode}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50",
                  option.id === mode
                    ? "bg-white text-stone-800 shadow-sm"
                    : "text-stone-500 hover:text-stone-700",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="max-w-md text-xs text-stone-500">
            {chosen.blurb}{" "}
            <span className="text-stone-600">
              This is the one part of Atlas that sends anything out of your browser — your words go away and are not
              kept. The copy desk never sends your photos.
            </span>
          </p>
        </div>

        {action}
      </div>

      {signedOut && (
        <p className="text-xs text-stone-500">
          Free with an account: {PLAN_LIMITS.free.polish} passes a month on Wanderer, and your desk is kept exactly as it
          is while you sign in.
        </p>
      )}
      {allowance && allowance.polish.limit > 0 && (
        <p className={`text-xs tabular-nums ${spent ? "text-red-600" : "text-stone-500"}`}>
          {spent ? "This month's passes are used" : `${allowance.polish.remaining} of ${allowance.polish.limit} passes left this month`}
          {allowance.plan !== "cartographer" && (
            <>
              {" · "}
              <Link to="/pricing" className="underline underline-offset-2">
                {allowance.plan === "free" ? `Traveller includes ${PLAN_LIMITS.traveller.polish}` : `Cartographer includes ${PLAN_LIMITS.cartographer.polish}`}
              </Link>
            </>
          )}
        </p>
      )}

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
