import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Eye, Loader2, LogIn, Sparkles } from "lucide-react";

import { IssueView } from "@/components/magazine/issue-view";
import { PrintSheet } from "@/components/magazine/print-sheet";
import { MAX_PHOTOS, PhotoPicker } from "@/components/photo-picker";
import { MIN_WORDS, MAX_WORDS, StoryEditor } from "@/components/story-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { isParked, park, take } from "@/lib/draft";
import { composeIssue } from "@/lib/magazine/compose";
import { disposeMeasurer } from "@/lib/magazine/fit";
import type { Axis, PlateBox } from "@/lib/magazine/templates";
import type { Issue } from "@/lib/magazine/types";
import type { Focus, Photo } from "@/types";

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export function Create() {
  const { ready, user, configured, signInWithGoogle } = useAuth();
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [story, setStory] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  /** True from the first paint when a desk is waiting, so none of it flashes empty. */
  const [restoring, setRestoring] = useState(isParked);
  /** Set once a parked desk has actually been recovered, not merely looked for. */
  const returning = useRef(false);

  /**
   * Nothing may go to press without an account.
   *
   * A build with no Supabase keys has nobody to sign in as, so it is not
   * gated — the alternative is a press button that can never be pressed.
   */
  const needsSignIn = configured && !user;

  /**
   * Signed out, an issue is a proof: it can be read, but not marked up and not
   * printed. That is the industry's own arrangement — a proof exists to be
   * looked at and approved, and the press run is a separate act. Here the
   * separation is an account, and it means nobody has to sign in to find out
   * whether their trip makes a good magazine.
   */
  const proofing = needsSignIn;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [composing, setComposing] = useState(false);
  // Recorded so the colophon can say the words were sent away to be edited.
  const [polished, setPolished] = useState(false);
  /**
   * Plate sizes the reader has pulled, by page index and axis.
   *
   * Kept here rather than on the issue because the issue is rebuilt from
   * scratch every time anything changes; these are the decisions that have to
   * survive that.
   */
  const [plateSizes, setPlateSizes] = useState<Record<number, Partial<PlateBox>>>({});
  /**
   * Decides the riddle on the blank leaf, drawn afresh each time the issue is
   * sent to press and then held for that issue's lifetime.
   *
   * Every recomposition below hands the same seed back, so moving a plate
   * about cannot change the riddle underneath you — but pressing again gives a
   * new one.
   */
  const [seed, setSeed] = useState("");

  /**
   * Brings back the desk that was put away before signing in.
   *
   * `take` deletes as it reads, so React's double effect cannot restore the
   * same photographs twice — the second call finds nothing. Object URLs are
   * made fresh here because the old ones died with the previous document.
   */
  useEffect(() => {
    let cancelled = false;

    void take().then(draft => {
      if (cancelled) return;

      if (draft) {
        returning.current = true;
        setTitle(draft.title);
        setStory(draft.story);
        setPolished(draft.polished);
        setPhotos(
          draft.photos.map(photo => ({
            id: photo.id,
            file: photo.file,
            url: URL.createObjectURL(photo.file),
            focus: photo.focus,
          })),
        );
      }

      setRestoring(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Object URLs are a manual resource: release them when the page goes away.
  const photosRef = useRef<Photo[]>([]);
  photosRef.current = photos;
  useEffect(
    () => () => {
      photosRef.current.forEach(photo => URL.revokeObjectURL(photo.url));
      disposeMeasurer();
    },
    [],
  );

  const wordCount = useMemo(() => countWords(story), [story]);

  const addPhotos = (files: File[]) =>
    setPhotos(current => [
      ...current,
      ...files.slice(0, MAX_PHOTOS - current.length).map(file => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      })),
    ]);

  /** Moves one photograph into another's place, carrying the rest along. */
  const reorderPhotos = (from: string, to: string) =>
    setPhotos(current => {
      const fromIndex = current.findIndex(photo => photo.id === from);
      const toIndex = current.findIndex(photo => photo.id === to);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return next;
    });

  /**
   * Exchanges the two photographs a pair of plates is drawn from, and sets the
   * issue again.
   *
   * The composer deals photographs out by position, so swapping two entries
   * swaps exactly those two plates and leaves every other page as it was.
   * Recomposing is cheap here and safe to do synchronously: the fonts were
   * already waited for when the issue was first set.
   */
  const swapPlates = (from: string, to: string) => {
    const fromIndex = photos.findIndex(photo => photo.id === from);
    const toIndex = photos.findIndex(photo => photo.id === to);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

    const next = [...photos];
    next[fromIndex] = photos[toIndex]!;
    next[toIndex] = photos[fromIndex]!;

    setPhotos(next);
    setIssue(composeIssue({ title, photos: next, story, polished, plateSizes, seed }));
  };

  /**
   * Sets one axis of one page's plate and lays the issue out again.
   *
   * The whole issue is recomposed, not just that page: a bigger plate leaves
   * less room for copy, so everything after it moves. Pages before it, and the
   * page itself, stay where they were — which is why an index is a stable
   * enough address to record the choice against.
   *
   * The two axes are merged rather than replaced, so setting a width does not
   * quietly undo a depth set a moment earlier.
   */
  const resizePlate = (index: number, axis: Axis, value: number) => {
    const next = { ...plateSizes, [index]: { ...plateSizes[index], [axis]: value } };
    setPlateSizes(next);
    setIssue(composeIssue({ title, photos, story, polished, plateSizes: next, seed }));
  };

  /**
   * Places a photograph inside its frame, or hands the placing back to the
   * plate when `focus` is null.
   *
   * Kept on the photograph rather than on the page: it is a fact about the
   * picture, not about where the picture happens to be sitting, so it follows
   * the photograph when two plates are swapped. Nothing re-flows — how a
   * picture sits in its frame does not change how much room the copy has — but
   * the issue holds its own references to these objects, so it has to be built
   * again to see the new one.
   */
  const panPhoto = (id: string, focus: Focus | null) => {
    const next = photos.map(photo =>
      photo.id === id ? { ...photo, focus: focus ?? undefined } : photo,
    );
    setPhotos(next);
    setIssue(composeIssue({ title, photos: next, story, polished, plateSizes, seed }));
  };

  const removePhoto = (id: string) =>
    setPhotos(current => {
      const gone = current.find(photo => photo.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter(photo => photo.id !== id);
    });

  const blocker =
    photos.length === 0
      ? "Add at least one photo"
      : wordCount < MIN_WORDS
        ? `Write about ${(MIN_WORDS - wordCount).toLocaleString()} more words`
        : wordCount > MAX_WORDS
          ? "Trim the story to 10,000 words"
          : null;

  /**
   * Opens the print dialog, but not before every photograph has decoded.
   *
   * The print sheet is `display: none` until the print stylesheet applies, so
   * nothing in it has ever been painted and its images may not be decoded when
   * the browser takes its snapshot — and the browser does not wait. What prints
   * instead is whatever sits behind the picture, which on the cover is a
   * near-black panel under a dark scrim, kept by `print-color-adjust: exact`.
   * That is the black first page.
   *
   * Decoding here is cheap: these are object URLs already in memory, and any
   * the reader has looked at are decoded already.
   */
  const exportIssue = async () => {
    await Promise.all(
      photos.map(async photo => {
        const image = new Image();
        image.src = photo.url;
        // A picture that will not decode is one the page will render as best
        // it can. It must not hold up the export.
        await image.decode().catch(() => undefined);
      }),
    );

    window.print();
  };

  /**
   * Parks the whole desk, then hands the reader to Google.
   *
   * Written here rather than on every keystroke: this is the one moment the
   * page is knowingly about to be destroyed, so it is the only moment the
   * write is worth making.
   */
  const signInToPress = async () => {
    setSignInError(null);
    setSigningIn(true);

    // Photographs included: the whole point of parking the desk is that the
    // reader comes back to it, and coming back to an empty photo tray is the
    // same as not coming back at all.
    await park({
      title,
      story,
      polished,
      photos: photos.map(photo => ({ id: photo.id, file: photo.file, focus: photo.focus })),
    });

    try {
      await signInWithGoogle("/create");
    } catch (cause) {
      setSignInError(cause instanceof Error ? cause.message : "Could not open Google sign-in.");
      setSigningIn(false);
    }
  };

  const sendToPress = async () => {
    setComposing(true);
    // Copy is fitted by measuring real type. Measuring before the webfont
    // arrives would fit against the fallback and re-wrap once it loads.
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(resolve));
    // A fresh seed per press, used for this composition and kept in state for
    // every recomposition the reader's dragging causes afterwards.
    const pressing = crypto.randomUUID();
    setSeed(pressing);

    setIssue(composeIssue({ title, photos, story, polished, plateSizes, seed: pressing }));
    setComposing(false);
    window.scrollTo({ top: 0 });
  };

  /**
   * Sends a restored desk straight to press.
   *
   * Someone who signed in from a proof asked for one thing: to mark the issue
   * up. Handing them back a desk and making them press the button again would
   * be asking twice. The ref guards against a second run, which React's double
   * effect would otherwise cause.
   */
  const pressed = useRef(false);
  useEffect(() => {
    if (pressed.current || restoring || !ready || !user || issue) return;
    // Only a desk that came back from a park is pressed unasked; a reader who
    // arrived here normally decides for themselves when it goes.
    if (!returning.current || photos.length === 0) return;

    pressed.current = true;
    void sendToPress();
  }, [restoring, ready, user, issue, photos.length]);

  if (issue) {
    return (
      <>
        <div className="flex flex-col gap-6 print:hidden">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
                <span aria-hidden className="h-px w-6 bg-white/40" />
                {proofing ? "Proof copy" : "Off the press"}
              </span>
              <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md">{issue.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="rounded-full" onClick={() => setIssue(null)}>
                <ArrowLeft className="size-4" />
                Back to the desk
              </Button>
              {/*
                A proof is approved by going to press, so that is the button —
                and pressing it is what asks for the account.
              */}
              {proofing ? (
                <Button className="rounded-full" disabled={signingIn} onClick={() => void signInToPress()}>
                  {signingIn ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  {signingIn ? "Opening Google" : "Send to press"}
                </Button>
              ) : (
                <Button className="rounded-full" onClick={exportIssue}>
                  <Download className="size-4" />
                  Export
                </Button>
              )}
            </div>
          </header>

          {/*
            Withholding the three handlers is what makes this read-only:
            `IssueView` already renders a plain issue when it has none, so a
            proof needs no separate view of its own.
          */}
          <IssueView
            issue={issue}
            onSwapPlates={proofing ? undefined : swapPlates}
            onResizePlate={proofing ? undefined : resizePlate}
            onPanPhoto={proofing ? undefined : panPhoto}
          />

          {signInError && (
            <p className="text-center text-xs text-red-100 drop-shadow-sm" role="alert">
              {signInError}
            </p>
          )}

          {proofing ? (
            <p className="mx-auto max-w-prose text-center text-xs text-white/70 drop-shadow-sm">
              This is a proof — your issue as it stands, set and paginated, but not yet marked up. Send it to press and
              the plates come under your hand: move the pictures about, choose what shows in each one, set how much of a
              page a plate takes, and export the whole issue as a PDF. Signing in is all that takes, and it is free.
            </p>
          ) : (
            <>
              <p className="text-center text-xs text-white/70 drop-shadow-sm">
                Every picture is placed for you until you say otherwise: hover one and press{" "}
                <span className="font-medium text-white">Auto</span> to take the placing over, then drag the picture to
                choose what shows. Press <span className="font-medium text-white">Move</span> to hand it back. The grips on
                a plate's edges set how much of the page it takes — <span className="font-medium text-white">depth</span> on
                the horizontal one, <span className="font-medium text-white">width</span> on the vertical — and the story
                re-flows around whatever you leave it. To swap two photographs, drag one by the{" "}
                <span className="font-medium text-white">Swap</span> badge in its corner and drop it on the other.
              </p>

              <p className="text-center text-xs text-white/70 drop-shadow-sm">
                Export opens your print dialog — choose <span className="font-medium text-white">Save as PDF</span>. The
                pages are already the right size, so leave the scale at 100%.
              </p>
            </>
          )}
        </div>

        {/*
          Only laid out when printing — and never for a proof. Keeping the
          sheet out of the document is what stops Ctrl+P walking straight past
          the press button; hiding the button alone would not.
        */}
        {!proofing && <PrintSheet issue={issue} />}
      </>
    );
  }

  /**
   * The desk is on its way back from storage.
   *
   * Shown instead of the empty desk, not above it: someone returning from
   * Google is looking for their photographs, and a blank photo tray answers
   * that question wrongly for as long as it is on screen.
   */
  if (restoring) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-white/80 drop-shadow-sm">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Bringing your desk back…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
          <span aria-hidden className="h-px w-6 bg-white/40" />
          The desk
        </span>
        <h1 className="font-editorial text-5xl tracking-tight text-white drop-shadow-md">New story</h1>
        <p className="max-w-prose text-white/90 drop-shadow-sm">
          Ten photos and the story behind them, set as a magazine. Everything stays in this tab until you export.
        </p>
      </header>

      <Card className="border-white/50 bg-white/90 backdrop-blur-md">
        <CardContent className="flex flex-col gap-10 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="album-title" className="text-stone-700">
              Working title
            </Label>
            <Input
              id="album-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Three days in the Cairngorms"
              className="max-w-md bg-white/70 text-base"
            />
          </div>

          <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={removePhoto} onReorder={reorderPhotos} />
          <StoryEditor
            story={story}
            onChange={setStory}
            wordCount={wordCount}
            onPolish={value => {
              setStory(value);
              setPolished(true);
            }}
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/50 bg-white/85 py-3 pr-3 pl-6 shadow-lg shadow-black/10 backdrop-blur-md">
        <p className="text-sm text-stone-600">
          {blocker ?? (proofing ? "Ready to proof." : "Ready for press.")}
          <span className="text-stone-400">
            {" "}
            · {photos.length} photos · {wordCount.toLocaleString()} words
          </span>
        </p>
        {/*
          Signed out this pulls a proof rather than going to press. Nobody is
          asked for an account before they have seen what Atlas makes of their
          trip — the account is asked for at the proof, where it buys something.
        */}
        <Button
          className="rounded-full"
          disabled={!ready || restoring || blocker !== null || composing}
          onClick={sendToPress}
        >
          {composing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : proofing ? (
            <Eye className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {composing ? "Setting the type" : proofing ? "Pull a proof" : "Send to press"}
        </Button>
      </div>
    </div>
  );
}
