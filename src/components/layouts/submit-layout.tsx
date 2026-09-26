import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Check, ImagePlus, Loader2, LogIn, X } from "lucide-react";

import { LayoutPreview } from "@/components/layouts/layout-preview";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { fileToSample, submitLayout } from "@/lib/layouts";
import { LAYOUT_LIMITS, sanitizeDesign, type LayoutKind } from "@/types";

/**
 * Sends a layout to the directory for review.
 *
 * Two things are published if it is accepted, and the panel shows both before
 * anything is sent: the template (the design with its words replaced and its
 * frames emptied — the same function the server runs), and the sample, a
 * picture of the finished page with the submitter's own photographs and
 * words, which they attach and agree to show.
 */
export function SubmitLayout({
  kind,
  design,
  makeSample,
  sampleHint,
  onSignIn,
  onClose,
}: {
  kind: LayoutKind;
  design: unknown;
  /** Draws the sample from the page being designed; without it, the submitter attaches one. */
  makeSample?: () => Promise<string>;
  /** A line under the sample, when the one drawn is not the best there could be. */
  sampleHint?: string;
  /** Signs in without losing the work on the page. */
  onSignIn: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const template = useMemo(() => sanitizeDesign(kind, design), [kind, design]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sample, setSample] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLInputElement>(null);

  // The page's own picture, drawn once as the panel opens.
  const valid = typeof template !== "string";
  useEffect(() => {
    // Nothing to draw a sample of until the design is one that can be submitted.
    if (!makeSample || !user || !valid) return;
    let cancelled = false;
    setDrawing(true);
    makeSample()
      .then(url => !cancelled && setSample(url))
      .catch(problem => !cancelled && setError((problem as Error).message))
      .finally(() => !cancelled && setDrawing(false));
    return () => {
      cancelled = true;
    };
  }, [makeSample, user, valid]);

  // One listener for the life of the panel, reading the latest `onClose`.
  // Resubscribing whenever the parent re-rendered lost the Escape itself: the
  // studio's own key handler deselects on Escape, that re-render swapped this
  // listener out mid-dispatch, and a listener removed mid-dispatch never runs.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const attach = async (picked: File | undefined) => {
    if (!picked) return;
    setError(null);
    try {
      setSample(await fileToSample(picked));
    } catch (problem) {
      setError((problem as Error).message);
    }
  };

  const send = async () => {
    if (typeof template === "string" || !sample) return;
    setSending(true);
    setError(null);
    try {
      await submitLayout({ kind, title: title.trim(), description: description.trim(), design, sample });
      setSent(true);
    } catch (problem) {
      setError((problem as Error).message);
    } finally {
      setSending(false);
    }
  };

  const ready = typeof template !== "string" && title.trim().length > 0 && sample !== null && consent && !sending;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-950/50 p-4 backdrop-blur-sm" onPointerDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-layout-title"
        onPointerDown={event => event.stopPropagation()}
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 rounded-full p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-900">
          <X className="size-5" />
        </button>

        <div className="flex flex-col gap-1 pr-8">
          <h2 id="submit-layout-title" className="font-editorial text-3xl text-stone-900">
            Submit to the layout directory
          </h2>
          <p className="text-sm text-stone-600">
            The editors look at every layout. If it is accepted it goes in the directory for everyone to start from, and you get an email either way.
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
            <p className="flex items-center gap-2 font-medium text-emerald-900">
              <Check className="size-5" /> Sent for review.
            </p>
            <p className="text-sm text-emerald-900/80">We will email you when it has been decided. You can follow it, or withdraw it, under Your submissions.</p>
            <div className="flex gap-2">
              <Button asChild size="sm" className="rounded-full">
                <Link to="/layouts#mine">Your submissions</Link>
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
                Back to the page
              </Button>
            </div>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <p className="text-sm text-stone-700">Sign in to submit, so we know where to send the decision. Your page is kept exactly as it is while you do.</p>
            <Button className="rounded-full" onClick={onSignIn}>
              <LogIn className="size-4" /> Sign in to submit
            </Button>
          </div>
        ) : typeof template === "string" ? (
          <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{template}</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <figure className="flex flex-col gap-2">
                <figcaption className="text-[11px] font-medium tracking-[0.2em] text-stone-500 uppercase">The template</figcaption>
                <LayoutPreview design={template} width={kind === "poster" ? 220 : 280} />
                <p className="text-[11px] leading-relaxed text-stone-500">What others start from: your design with every word replaced and every frame empty.</p>
              </figure>
              <figure className="flex flex-col gap-2">
                <figcaption className="text-[11px] font-medium tracking-[0.2em] text-stone-500 uppercase">The sample</figcaption>
                <div className="flex aspect-3/4 w-55 items-center justify-center overflow-hidden rounded-sm bg-stone-100 ring-1 ring-stone-200">
                  {drawing ? (
                    <Loader2 className="size-5 animate-spin text-stone-400" />
                  ) : sample ? (
                    <img src={sample} alt="The sample of your finished page" className="h-full w-full object-contain" />
                  ) : (
                    <span className="px-4 text-center text-xs text-stone-500">Attach a picture of the finished {kind === "poster" ? "page" : "magazine page or slide"}</span>
                  )}
                </div>
                {sampleHint && sample && <p className="max-w-[220px] text-[11px] leading-relaxed text-amber-800">{sampleHint}</p>}
                <button type="button" onClick={() => file.current?.click()} className="flex w-fit items-center gap-1.5 text-xs font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900">
                  <ImagePlus className="size-3.5" />
                  {sample ? "Attach a different picture" : "Attach a picture"}
                </button>
                <input ref={file} type="file" accept="image/*" hidden onChange={event => void attach(event.target.files?.[0])} />
              </figure>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-800">Name</span>
              <input
                ref={first}
                value={title}
                maxLength={LAYOUT_LIMITS.title}
                onChange={event => setTitle(event.target.value)}
                placeholder={kind === "poster" ? "Salt & Stone poster" : "Two-column feature with a bleed"}
                className="h-10 rounded-md bg-white px-3 text-sm ring-1 ring-stone-300 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-800">
                What it is good for <span className="font-normal text-stone-500">(optional)</span>
              </span>
              <textarea
                value={description}
                maxLength={LAYOUT_LIMITS.description}
                onChange={event => setDescription(event.target.value)}
                rows={2}
                placeholder="A big photo, a short headline — good for a birthday or a single day out."
                className="resize-y rounded-md bg-white px-3 py-2 text-sm ring-1 ring-stone-300 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
              <span>
                If it is accepted, the sample — with the photos and words in it — may be shown in the directory, credited to my first name. I can withdraw it at any time.
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="rounded-full" onClick={onClose}>
                Cancel
              </Button>
              <Button className="rounded-full" disabled={!ready} onClick={() => void send()}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                Send for review
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
