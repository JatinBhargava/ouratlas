import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft, Download, Images, Link2, Loader2, LogIn, PenLine, Sparkles } from "lucide-react";

import { CarouselPanel } from "@/components/carousel-panel";
import { IssueView } from "@/components/magazine/issue-view";
import { PrintSheet } from "@/components/magazine/print-sheet";
import { FEED_MS, PressFeed } from "@/components/press-feed";
import { PressInterlude } from "@/components/press-interlude";
import { SavePanel } from "@/components/save-panel";
import { MAX_PHOTOS, PhotoPicker } from "@/components/photo-picker";
import { MIN_WORDS, MAX_WORDS, StoryEditor, type StoryTab } from "@/components/story-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSignInReturn, settleSignInReturn, useAuth } from "@/lib/auth";
import { isParked, park, take } from "@/lib/draft";
import { HttpError } from "@/lib/api";
import { claimExport, readAllowance } from "@/lib/exports";
import { composeIssue } from "@/lib/magazine/compose";
import { spliceStory, toParagraphs, type Cursor } from "@/lib/magazine/copy";
import { disposeMeasurer } from "@/lib/magazine/fit";
import { pressPdf, printHonoursPageSize, saveIssue } from "@/lib/magazine/press";
import type { Axis, PlateBox } from "@/lib/magazine/templates";
import { DEFAULT_THEME, themeOf, type ThemeId } from "@/lib/magazine/themes";
import { ThemePicker, TiltControl } from "@/components/theme-picker";
import { THEMES } from "@/lib/magazine/themes";
import { LayoutDesigner } from "@/components/layout-designer";
import { EditorPanel } from "@/components/editor-panel";
import type { EditorResult } from "@/lib/editor";
import { TypePanel } from "@/components/type-panel";
import { clampType, DEFAULT_TYPE, type TypeChoice } from "@/lib/magazine/typography";
import { defaultDesign, type CustomBox, type CustomDesign, type CustomLeaves, type CustomSlot } from "@/lib/magazine/custom";
import type { Issue } from "@/lib/magazine/types";
import type { ExportAllowance, Focus, Photo } from "@/types";

const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The story's first sentence, cut to fit under a title: the reader's dek, and a saved issue's. */
function dekOf(story: string): string {
  const opening = story.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  return opening.length > 180 ? `${opening.slice(0, 177).trimEnd()}…` : opening;
}

export function Create() {
  const { ready, user, configured, signInWithGoogle } = useAuth();
  /**
   * Which view of a pressed issue is showing: the finished issue to read
   * ("issue"), or the proof with its tools ("proof"). In the address rather
   * than in state, so the browser's back button walks proof → issue → desk,
   * and in a query rather than a path, so the page is never unmounted — the
   * issue, its photographs and every choice made on it live here and nowhere
   * else. A reload serves the desk, as it always has.
   */
  const [params, setParams] = useSearchParams();
  const view = params.get("view");
  const showView = (next: "issue" | "proof" | null) => {
    setParams(next ? { view: next } : {});
    window.scrollTo({ top: 0 });
  };
  const [title, setTitle] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [story, setStory] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  /**
   * Whether the interlude is up — the one screen that covers every wait
   * between the desk and the press.
   *
   * Setting an issue means reading the desk out of storage, waiting for the
   * webfont and fitting the copy against it. Left alone the desk sits there
   * throughout, spinner on the button, looking like nothing is happening; and
   * on the way back from Google it looks worse than that, like the return
   * failed and then changed its mind. So nothing shows the desk mid-work: the
   * interlude goes up, and the press view takes over when there is an issue.
   *
   * It starts true two ways, because one of them can fail. The marker says a
   * desk was put away; the `code` in the address says the browser is on the
   * return leg of a sign-in whatever storage did or did not manage to record.
   * Photographs are large and a write can be refused, and a refused write
   * must not be the difference between a considered return and being dropped
   * on the desk.
   */
  const [staging, setStaging] = useState(() => isParked() || isSignInReturn());
  // The answer has been read into `staging`; a later visit in the same page
  // load is not a return. After the initialiser, so React's double render of
  // it in development still sees the same answer twice.
  useEffect(() => settleSignInReturn(), []);
  /** Whether the read has settled, however it settled. */
  const [draftLoaded, setDraftLoaded] = useState(false);
  /** The interlude has played out; set by the component when its last stage lands. */
  const [interludeDone, setInterludeDone] = useState(false);
  /*
   * Stable, and it has to be: the interlude keys its timers off this, so a
   * fresh function each render would restart the animation for ever.
   */
  const finishInterlude = useCallback(() => setInterludeDone(true), []);
  /** The press run has settled, whether it produced an issue or threw. */
  const [pressReady, setPressReady] = useState(false);
  /** Set once a parked desk has actually been recovered, not merely looked for. */
  const returning = useRef(false);
  /** The seed the parked issue was composed with; reused so it comes back the same. */
  const restoredSeed = useRef<string | null>(null);

  /**
   * Nothing may go to press without an account.
   *
   * A build with no Supabase keys has nobody to sign in as, so it is not
   * gated — the alternative is a press button that can never be pressed.
   */
  /**
   * Whether an account is still needed before this issue can go out.
   *
   * The gate is at the export and nowhere earlier: composing, pressing and
   * marking up all work signed out, so nobody is asked for an account before
   * they know whether their trip makes a good magazine. What an account buys
   * is the PDF.
   *
   * A build with no Supabase keys has nobody to sign in as, so it is not
   * gated — the alternative is an export that can never happen.
   */
  const needsSignIn = configured && !user;

  const [issue, setIssue] = useState<Issue | null>(null);
  const [composing, setComposing] = useState(false);
  // Recorded so the colophon can say the words were sent away to be edited.
  const [polished, setPolished] = useState(false);
  /** The story tab to open on; "speak" after signing in from it, so the reader lands where they left. */
  const [storyTab, setStoryTab] = useState<StoryTab | undefined>(undefined);
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
   * The style the issue is set in.
   *
   * Lives here beside the title and the story because it is one of the things
   * the reader decides, not something the composer works out — and like them
   * it has to survive the sign-in redirect.
   */
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  /**
   * How far the pasted-up photographs lean, or null while the reader has not
   * said and the theme's own angle stands.
   *
   * Null rather than the theme's number, so switching theme picks up the new
   * theme's lean instead of carrying the last one across — but once the
   * reader has touched the slider, their answer follows them.
   */
  const [tilt, setTilt] = useState<number | null>(null);
  /**
   * The three pages the reader has drawn.
   *
   * Started from a working default rather than three empty leaves, and kept
   * whatever theme is showing, so switching away and back does not throw the
   * drawing away.
   */
  const [design, setDesign] = useState<CustomDesign>(defaultDesign);
  /**
   * Single pages redrawn on the proof. The design above is what every left,
   * right and special page is drawn from; a box dragged on one page of the
   * proof changes that page only, and is kept here by its page number. Kept
   * across recompositions like the plate sizes, but not across a change of
   * theme, which lays out every page afresh.
   */
  const [leaves, setLeaves] = useState<CustomLeaves>({});
  /**
   * The type the reader has chosen for their own pages.
   *
   * Only handed to the composer on their own theme: every other theme is a
   * set of typographic decisions already made, and overriding them from here
   * would leave the picker naming a style the pages are not set in.
   */
  const [type, setType] = useState<TypeChoice>(DEFAULT_TYPE);
  /** Whether the issue carries a leaf to draw on, and what is on it. */
  const [wantsSketch, setWantsSketch] = useState(false);
  /**
   * What has been drawn, by the id of the surface it was drawn on.
   *
   * Keyed rather than single, because a reader may put drawing boxes on their
   * own pages as well as taking the blank leaf, and each surface keeps its own
   * marks. Nothing here is ever poured into or dealt to; it is only kept.
   */
  const [sketches, setSketches] = useState<Record<string, string>>({});
  const keepSketch = (id: string, dataUrl: string) =>
    setSketches(current => ({ ...current, [id]: dataUrl }));
  const ownType = theme === "custom" ? type : undefined;
  const themeTilt = THEMES[theme].surface.tilt;
  const leaning = themeTilt !== undefined;
  const tiltNow = tilt ?? themeTilt ?? 0;

  /**
   * What the server says this account may still export, or null while it has
   * not been asked and when nothing is counted at all.
   */
  const [allowance, setAllowance] = useState<ExportAllowance | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  /** The press-feed overlay, up from the click until the print dialog closes. */
  const [exporting, setExporting] = useState(false);
  /**
   * Whether export goes through the print dialog or makes the PDF itself.
   * Asked once: the platform does not change under a mounted page.
   */
  const [printsToSize] = useState(printHonoursPageSize);
  /** The print sheet, whose leaves a phone export draws one at a time. */
  const sheet = useRef<HTMLDivElement>(null);
  /**
   * Set only when an export is actually refused, never merely when the last
   * one is spent.
   *
   * This is what unmounts the print sheet, and it must not happen while a
   * print dialog is open — pulling the sheet out from under `window.print()`
   * would print a blank document. Re-printing an issue already paid for is
   * the same magazine anyway; the limit is on issues sent out, and the next
   * one composed asks again.
   */
  const [blocked, setBlocked] = useState(false);
  /** The carousel panel, over whichever view of the issue is showing. */
  const [carouselOpen, setCarouselOpen] = useState(false);
  /** The save panel, likewise. */
  const [saveOpen, setSaveOpen] = useState(false);
  /**
   * The issue an export was last granted for. Sending the same magazine out
   * again — as a carousel after the PDF, or the PDF twice — spends nothing
   * more; any change recomposes a new issue, and that one asks again.
   */
  const claimedFor = useRef<Issue | null>(null);

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
        // A reader who signed in to record wanted the microphone, not the
        // press: they go back to the Speak tab with the desk as they left it.
        if (draft.resume === "speak") {
          setStoryTab("speak");
          setStaging(false);
        } else {
          returning.current = true;
        }
        restoredSeed.current = draft.seed;
        setTitle(draft.title);
        setStory(draft.story);
        setPolished(draft.polished);
        setPlateSizes(draft.plateSizes);
        setSeed(draft.seed);
        // A desk parked before themes existed has none; that is the house style.
        setTheme(themeOf(draft.theme).id);
        setTilt(draft.tilt ?? null);
        if (draft.design) setDesign(draft.design);
        if (draft.type) setType(clampType(draft.type));
        setWantsSketch(draft.wantsSketch ?? false);
        setSketches(draft.sketches ?? {});
        setLeaves(draft.leaves ?? {});
        setPhotos(
          draft.photos.map(photo => ({
            id: photo.id,
            file: photo.file,
            url: URL.createObjectURL(photo.file),
            focus: photo.focus,
            caption: photo.caption,
          })),
        );
      }

      // Only a fruitless read ends the wait here. A recovered desk stays behind
      // the same screen until it has been set, which the effect below does.
      if (!draft) setStaging(false);
      setDraftLoaded(true);
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
    setIssue(composeIssue({ title, photos: next, story, polished, plateSizes, seed, theme, custom: design, type: ownType, sketch: wantsSketch, leaves }));
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
    setIssue(composeIssue({ title, photos, story, polished, plateSizes: next, seed, theme, custom: design, type: ownType, sketch: wantsSketch, leaves }));
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
    setIssue(composeIssue({ title, photos: next, story, polished, plateSizes, seed, theme, custom: design, type: ownType, sketch: wantsSketch, leaves }));
  };

  /**
   * Makes the desk up the way the editor decided, and returns how to undo it.
   *
   * Only the desk changes — style, order, framing, lean, and the title when
   * the reader has not written one. The issue itself is set when the reader
   * sends it to press, like any other change made at the desk. Plate sizes go,
   * as they do on any change of style: they belong to page numbers, and the
   * pages are about to be different ones.
   *
   * A photograph added while the editor was looking was never shown to it, so
   * it keeps its place at the end rather than being dropped.
   */
  const applyEditor = (plan: EditorResult): (() => void) => {
    const before = { title, theme, tilt, photos, plateSizes, design, type, leaves };

    const byId = new Map(photos.map(photo => [photo.id, photo]));
    const placed = plan.order.flatMap(id => (byId.has(id) ? [byId.get(id)!] : []));
    const unseen = photos.filter(photo => !plan.order.includes(photo.id));
    setPhotos(
      [...placed, ...unseen].map(photo => ({
        ...photo,
        focus: plan.focus[photo.id] ?? photo.focus,
        caption: plan.captions[photo.id] ?? photo.caption,
      })),
    );
    setTheme(plan.theme);
    // A drawn issue arrives with its pages and its type; they land in the
    // layout designer, where the reader can pull them about like their own.
    if (plan.design) setDesign(plan.design);
    // Its page-by-page plan, which varies the issue past the three shared
    // pages; each can still be pulled about on the proof like any other.
    setLeaves(plan.leaves);
    if (plan.type) setType(plan.type);
    setPlateSizes({});
    // The lean only means anything on a theme that leans; elsewhere the
    // theme's own (none) stands.
    setTilt(THEMES[plan.theme].surface.tilt ? plan.tilt : null);
    if (!title.trim() && plan.title) setTitle(plan.title);

    return () => {
      // Photographs removed since are not brought back, and ones added since
      // are kept: undo restores the editor's changes, not the desk's history.
      setPhotos(current => {
        const present = new Map(current.map(photo => [photo.id, photo]));
        const restored = before.photos.flatMap(photo =>
          present.has(photo.id) ? [{ ...present.get(photo.id)!, focus: photo.focus, caption: photo.caption }] : [],
        );
        const added = current.filter(photo => !before.photos.some(old => old.id === photo.id));
        return [...restored, ...added];
      });
      setTheme(before.theme);
      setTilt(before.tilt);
      setPlateSizes(before.plateSizes);
      setDesign(before.design);
      setLeaves(before.leaves);
      setType(before.type);
      setTitle(before.title);
    };
  };

  /**
   * Sets the issue in another style.
   *
   * The plate sizes go with it, and have to. They are recorded against page
   * numbers, and a theme that lays pages out differently paginates
   * differently — carried across, a depth pulled on page nine would land on
   * whatever the new theme happens to put there, which is not the picture the
   * reader pulled.
   *
   * Recomposing here is safe to do synchronously: the fonts were waited for
   * when the issue was first sent to press, and nothing since has changed them.
   */
  const chooseTheme = (next: ThemeId) => {
    if (next === theme) return;
    setTheme(next);
    setPlateSizes({});
    setLeaves({});
    // The lean belongs to the style it was chosen against.
    setTilt(null);
    if (issue) setIssue(composeIssue({ title, photos, story, polished, plateSizes: {}, seed, theme: next, custom: design, type: next === "custom" ? type : undefined, sketch: wantsSketch, leaves: {} }));
  };

  /**
   * Takes the reader's drawing and sets the issue again from it.
   *
   * Recomposed on every change rather than on some "apply": moving a box is
   * exactly as much of an editorial decision as pulling a plate, and the two
   * should not behave differently. Nothing here is expensive enough to earn a
   * button — the fonts were waited for when the issue first went to press.
   */
  const changeDesign = (next: CustomDesign) => {
    setDesign(next);
    if (issue && theme === "custom") {
      setIssue(
        composeIssue({
          title,
          photos,
          story,
          polished,
          plateSizes: {},
          seed,
          theme,
          custom: next,
          type: ownType,
          sketch: wantsSketch,
          leaves,
        }),
      );
      setPlateSizes({});
    }
  };

  /**
   * Moves or sizes one box on a drawn page, from the page itself.
   *
   * The same act as dragging it in the designer, reached from the other end:
   * what is edited is the design, so every leaf set from that slot changes
   * with it. Anything else would mean the issue and the design disagreeing
   * about what a page is.
   */
  const editBox = (index: number, slot: CustomSlot, box: CustomBox) => {
    // The page as it is now — its own boxes if it already has them, else the
    // boxes it was drawn with (the shared design's, or the closing page the
    // composer made up where the story ends) — with the one box changed.
    const current =
      leaves[index]?.slot === slot ? leaves[index]!.page : (issue?.pages[index]?.layout ?? design[slot]);
    const next: CustomLeaves = {
      ...leaves,
      [index]: { slot, page: { boxes: current.boxes.map(b => (b.id === box.id ? box : b)) }, hand: true },
    };
    setLeaves(next);
    if (issue) {
      setIssue(
        composeIssue({ title, photos, story, polished, plateSizes, seed, theme, custom: design, type: ownType, sketch: wantsSketch, leaves: next }),
      );
    }
  };

  /** Hands every redrawn page back to the shared design. */
  const resetLeaves = () => {
    setLeaves({});
    if (issue) {
      setIssue(
        composeIssue({ title, photos, story, polished, plateSizes, seed, theme, custom: design, type: ownType, sketch: wantsSketch, leaves: {} }),
      );
    }
  };

  /**
   * Sets the issue again in new type.
   *
   * Unlike the lean, this cannot be a redraw: the body face and its size are
   * what every box on every page was measured against, so a change here means
   * the whole magazine is composed afresh. The panel's sliders report on
   * release for exactly this reason.
   */
  const changeType = (next: TypeChoice) => {
    setType(next);
    if (issue && theme === "custom") {
      setIssue(
        composeIssue({ title, photos, story, polished, plateSizes: {}, seed, theme, custom: design, type: next, sketch: wantsSketch, leaves }),
      );
      setPlateSizes({});
    }
  };

  /**
   * Puts back what was typed into a box on a printed page.
   *
   * The words on a page are a run of the story, not a thing of their own, so
   * this edits the story and lets the issue be set again from it — which is
   * also why an edit can push a page's worth of copy onto the next leaf, and
   * should. Anything else would leave the magazine saying one thing and the
   * desk another.
   *
   * The plate sizes go, for the reason they always go: they are recorded
   * against page numbers, and the pages after an edit are no longer the pages
   * they were recorded against.
   */
  const editCopy = (from: Cursor, to: Cursor, text: string) => {
    const next = spliceStory(toParagraphs(story), from, to, text);
    if (next === story) return;
    setStory(next);
    setPlateSizes({});
    setIssue(
      composeIssue({
        title,
        photos,
        story: next,
        polished,
        plateSizes: {},
        seed,
        theme,
        custom: design,
        type: ownType,
        sketch: wantsSketch,
        leaves,
      }),
    );
  };

  /**
   * Adds or removes the leaf given over to drawing, and sets the issue again.
   *
   * A page appearing or disappearing changes the pagination, so this cannot
   * be a redraw — which is the whole reason the checkbox alone did nothing
   * before: it recorded the wish and never asked for the magazine to be made
   * again.
   */
  const chooseSketch = (next: boolean) => {
    setWantsSketch(next);
    if (!issue) return;
    setPlateSizes({});
    setIssue(
      composeIssue({
        title,
        photos,
        story,
        polished,
        plateSizes: {},
        seed,
        theme,
        custom: design,
        type: ownType,
        sketch: next,
        leaves,
      }),
    );
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
   * Spends one export on the issue about to go out, or says it may not.
   *
   * Claimed before anything is printed. A print dialog gives no reliable
   * signal that a file was saved, so waiting for one would mean either never
   * counting or counting things that never happened.
   *
   * Only a refusal stops the export. Every other failure — an older server
   * with no such route, a timeout, an API that is simply down — lets it
   * through: the limit exists to hold back people who have had their share,
   * not to make the export depend on a second service being reachable.
   */
  const claim = async (): Promise<boolean> => {
    if (issue && claimedFor.current === issue) return true;
    if (allowance === null || allowance.limit !== null) {
      try {
        setAllowance(await claimExport());
      } catch (cause) {
        if (cause instanceof HttpError && cause.status === 402) {
          setExportError(cause.message);
          setBlocked(true);
          return false;
        }
      }
    }
    claimedFor.current = issue;
    return true;
  };

  /** The carousel's and the save panel's turn at the same question; a refusal closes the panel so the reason shows. */
  const claimCarousel = async () => {
    setExportError(null);
    const granted = await claim();
    if (!granted) setCarouselOpen(false);
    return granted;
  };
  const claimSave = async () => {
    setExportError(null);
    const granted = await claim();
    if (!granted) setSaveOpen(false);
    return granted;
  };

  /**
   * Opens the print dialog — or, on a phone, makes the PDF itself — but not
   * before every photograph has decoded.
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
    setExportError(null);
    setExporting(true);
    const started = Date.now();

    try {
      if (!(await claim())) return;

      await Promise.all(
        photos.map(async photo => {
          const image = new Image();
          image.src = photo.url;
          // A picture that will not decode is one the page will render as best
          // it can. It must not hold up the export.
          await image.decode().catch(() => undefined);
        }),
      );

      // One whole cycle of the sheet at least, so it is never caught halfway
      // when the print dialog takes the screen. Everything above is already
      // done by now; this is the only part that is a wait for its own sake.
      const held = Date.now() - started;
      if (held < FEED_MS) await new Promise(resolve => setTimeout(resolve, FEED_MS - held));

      if (printsToSize) {
        window.print();
      } else {
        // A phone's print dialog would put the page on Letter or A4 at actual
        // size, so the PDF is made here instead, from the sheet laid out off-screen.
        const name = issue?.title ?? title;
        try {
          saveIssue(await pressPdf([...(sheet.current?.children ?? [])] as HTMLElement[], name), name);
        } catch {
          setExportError("The PDF could not be made on this phone. Try again, or export from a computer.");
        }
      }
    } finally {
      // Reached when the dialog closes or the PDF is handed over, and on the
      // refusal above. Chrome and Safari both return from `print()` once it
      // is dismissed.
      setExporting(false);
    }
  };

  /**
   * Parks the whole desk, marked-up issue and all, then hands the reader to
   * Google. `resume` says where they come back to: the press, when they
   * signed in to export, or the Speak tab, when they signed in to record.
   *
   * Written here rather than on every keystroke: this is the one moment the
   * page is knowingly about to be destroyed, so it is the only moment the
   * write is worth making.
   */
  const signIn = async (resume: "press" | "speak") => {
    setSignInError(null);
    setSigningIn(true);

    // Photographs, plate sizes and the seed included. Someone signing in at
    // the export has already made the magazine they want; coming back to a
    // different one is the same as not coming back at all.
    await park({
      title,
      story,
      polished,
      plateSizes,
      seed,
      theme,
      tilt,
      design,
      type,
      wantsSketch,
      sketches,
      leaves,
      photos: photos.map(photo => ({ id: photo.id, file: photo.file, focus: photo.focus, caption: photo.caption })),
      resume,
    });

    try {
      await signInWithGoogle("/create");
    } catch (cause) {
      setSignInError(cause instanceof Error ? cause.message : "Could not open Google sign-in.");
      setSigningIn(false);
    }
  };

  const sendToPress = async (reuseSeed?: string) => {
    // Off the press, the issue opens to read. Set first, so there is never a
    // moment with an issue and no view to show it in.
    setParams({ view: "issue" });
    // Every route to the press goes behind the interlude — pressed from the
    // desk, or resumed after signing in. The desk is never left on screen
    // doing visible nothing while the type is set.
    setInterludeDone(false);
    setPressReady(false);
    setStaging(true);
    setComposing(true);

    try {
      // Copy is fitted by measuring real type. Measuring before the webfont
      // arrives would fit against the fallback and re-wrap once it loads.
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(resolve));
      // A fresh seed per press, used for this composition and kept in state for
      // every recomposition the reader's dragging causes afterwards. A resumed
      // press hands back the seed it was parked with instead, so the riddle on
      // the blank leaf is the one the reader already saw.
      const pressing = reuseSeed ?? crypto.randomUUID();
      setSeed(pressing);

      setIssue(composeIssue({ title, photos, story, polished, plateSizes, seed: pressing, theme, custom: design, type: ownType, sketch: wantsSketch, leaves }));
      window.scrollTo({ top: 0 });
    } finally {
      setComposing(false);
      // Settled either way. A composition that threw must still release the
      // interlude, or it would play for ever over a page that is never coming.
      setPressReady(true);
    }
  };

  /**
   * Asks what is left, each time a new issue reaches the press.
   *
   * Not on mount: someone still writing has nothing to export, and asking
   * then would spend a round trip to answer a question nobody has asked.
   */
  useEffect(() => {
    if (!issue || needsSignIn) return;

    let cancelled = false;

    void readAllowance()
      .then(next => {
        if (cancelled) return;
        setAllowance(next);
        setBlocked(next.remaining !== null && next.remaining <= 0);
      })
      .catch(() => {
        // A tally that cannot be read is not a reason to withhold an export
        // the reader may well be entitled to. The claim below is the one that
        // actually decides, and it fails closed.
      });

    return () => {
      cancelled = true;
    };
  }, [issue, needsSignIn]);

  /**
   * Sends a restored desk straight to press.
   *
   * Someone who signed in from the press asked for one thing: their PDF.
   * Handing them the desk back and making them press the button again would
   * be asking twice. The parked seed and plate sizes go in with it, so what
   * returns is the issue they left, not a fresh arrangement of it. The ref
   * guards against a second run, which React's double effect would otherwise
   * cause.
   */
  const pressed = useRef(false);
  useEffect(() => {
    // Only a desk that came back from a park is pressed unasked; a reader who
    // arrived here normally decides for themselves when it goes.
    if (!returning.current || pressed.current || issue) return;
    // `ready` is the auth session resolving, which lands after the redirect
    // rather than with it. Waiting is the difference between resuming and
    // deciding the sign-in failed.
    if (!draftLoaded || !ready) return;

    if (!user || photos.length === 0) {
      // The sign-in did not take, or there was nothing to press. Either way
      // the desk itself is the honest thing to show.
      setStaging(false);
      return;
    }

    pressed.current = true;
    void sendToPress(restoredSeed.current ?? undefined);
  }, [draftLoaded, ready, user, issue, photos.length]);

  /**
   * Moves on only when both the work and the telling of it are done.
   *
   * Whichever finishes second decides. A fast machine waits out the
   * interlude rather than flashing it; a slow one holds the last stage until
   * the pages exist, so the reader never arrives at a half-set magazine.
   */
  useEffect(() => {
    if (staging && pressReady && interludeDone) setStaging(false);
  }, [staging, pressReady, interludeDone]);

  /**
   * The way back from Google, narrated.
   *
   * Deliberately ahead of the press view below: the issue is composed behind
   * this screen and waits there until the interlude finishes, so the reader
   * arrives at a page that is already made up rather than watching it being
   * made up.
   */
  if (staging) {
    return <PressInterlude onFinished={finishInterlude} />;
  }

  // The proof: the issue with every tool for changing it.
  if (issue && view === "proof") {
    return (
      <>
        <div className="flex flex-col gap-6 print:hidden">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-3 text-[11px] font-medium tracking-[0.28em] text-white/70 uppercase drop-shadow-sm">
                <span aria-hidden className="h-px w-6 bg-white/40" />
                The proof
              </span>
              <h1 className="font-editorial text-4xl tracking-tight text-white drop-shadow-md">{issue.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="rounded-full" onClick={() => showView("issue")}>
                <ArrowLeft className="size-4" />
                Back to the issue
              </Button>
              {/*
                The one thing an account is needed for. Everything else on this
                page — the plates, the placing, the sizes — works without one.
              */}
              {needsSignIn ? (
                <Button className="rounded-full" disabled={signingIn} onClick={() => void signIn("press")}>
                  {signingIn ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  {signingIn ? "Opening Google" : "Sign in to export"}
                </Button>
              ) : blocked ? (
                <Button asChild className="rounded-full">
                  <Link to="/pricing">See the plans</Link>
                </Button>
              ) : (
                <>
                  <Button variant="secondary" className="rounded-full" onClick={() => setSaveOpen(true)}>
                    <Link2 className="size-4" />
                    Save &amp; share
                  </Button>
                  <Button variant="secondary" className="rounded-full" onClick={() => setCarouselOpen(true)}>
                    <Images className="size-4" />
                    Carousel
                  </Button>
                  <Button className="rounded-full" disabled={exporting} onClick={exportIssue}>
                    <Download className="size-4" />
                    Export
                  </Button>
                </>
              )}
            </div>
          </header>

          {/* Offered again over the finished issue, because this is the only
              place the choice can actually be judged. Picking here re-lays the
              magazine under the reader rather than sending them back a step. */}
          <div className="flex flex-col gap-4 rounded-2xl border border-white/50 bg-white/85 p-4 backdrop-blur-md">
            <ThemePicker theme={theme} onChoose={chooseTheme} />
            {leaning && <TiltControl tilt={tiltNow} onChange={setTilt} />}
            {theme === "custom" && (
              <>
                <LayoutDesigner design={design} onChange={changeDesign} />
                {/* The designer and the proof edit different things, and the
                    difference is easy to miss: say which is which, and count
                    the pages that have gone their own way. */}
                <p className="text-xs text-stone-500">
                  Changes here apply to every page of that kind. To change one page only, drag its boxes on the
                  proof below.
                  {Object.keys(leaves).length > 0 && (
                    <>
                      {" "}
                      {Object.keys(leaves).length === 1
                        ? "One page has a layout of its own."
                        : `${Object.keys(leaves).length} pages have layouts of their own.`}{" "}
                      <button type="button" onClick={resetLeaves} className="underline underline-offset-2">
                        Use the shared design everywhere
                      </button>
                    </>
                  )}
                </p>
                <TypePanel type={type} onChange={changeType} />
              </>
            )}
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={wantsSketch}
                onChange={event => chooseSketch(event.target.checked)}
                className="size-4 accent-emerald-600"
              />
              Add a page to draw on
            </label>
          </div>

          <IssueView
            issue={issue}
            tilt={tiltNow}
            onSwapPlates={swapPlates}
            onResizePlate={resizePlate}
            onPanPhoto={panPhoto}
            onEditBox={theme === "custom" ? editBox : undefined}
            onEditCopy={editCopy}
            sketches={sketches}
            onSketch={keepSketch}
          />

          {(signInError ?? exportError) && (
            <p className="text-center text-xs text-red-100 drop-shadow-sm" role="alert">
              {signInError ?? exportError}
            </p>
          )}

          {/* Shown only when there is an allowance to show; a paid plan has none. */}
          {allowance?.remaining !== null && allowance !== null && !blocked && (
            <p className="text-center text-xs text-white/70 drop-shadow-sm">
              {allowance.remaining} of {allowance.limit} exports left this month on Wanderer.
            </p>
          )}

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
            {needsSignIn
              ? "Exporting needs an account — it is free, and your issue is kept exactly as you have it here while you sign in."
              : printsToSize
                ? "Export opens your print dialog — choose Save as PDF. The pages are already the right size, so leave the scale at 100%."
                : "Export saves the issue as a PDF to your downloads. A long issue takes a little while to set."}
          </p>
        </div>

        {/*
          Only laid out when printing, and never before there is an account to
          print for. Keeping the sheet out of the document is what stops Ctrl+P
          walking straight past the sign-in; hiding the button alone would not.
        */}
        {exporting && <PressFeed />}

        {!needsSignIn && !blocked && (
          <>
            <PrintSheet
              ref={sheet}
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              offscreen={exporting && !printsToSize}
            />
            <CarouselPanel
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              open={carouselOpen}
              onOpenChange={setCarouselOpen}
              onPress={claimCarousel}
            />
            <SavePanel
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              photographs={photos.length}
              dek={dekOf(story)}
              open={saveOpen}
              onOpenChange={setSaveOpen}
              onPress={claimSave}
            />
          </>
        )}
      </>
    );
  }

  /**
   * Off the press: the issue on a page of its own, to read before anything
   * else — the way the portfolio shows a finished trip. A kicker, the title
   * and the story's first line over the flip book, with the two things to do
   * next (change it, or keep it) above it and nothing else in the way. Read
   * only: the tools live one click away on the proof.
   */
  if (issue && view !== null) {
    const dek = dekOf(story);
    return (
      <>
        <div className="flex flex-col gap-8 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" className="rounded-full" onClick={() => {
              setIssue(null);
              showView(null);
            }}>
              <ArrowLeft className="size-4" />
              Back to the desk
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" className="rounded-full" onClick={() => showView("proof")}>
                <PenLine className="size-4" />
                Edit the layout
              </Button>
              {needsSignIn ? (
                <Button className="rounded-full" disabled={signingIn} onClick={() => void signIn("press")}>
                  {signingIn ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  {signingIn ? "Opening Google" : "Sign in to export"}
                </Button>
              ) : blocked ? (
                <Button asChild className="rounded-full">
                  <Link to="/pricing">See the plans</Link>
                </Button>
              ) : (
                <>
                  <Button variant="secondary" className="rounded-full" onClick={() => setSaveOpen(true)}>
                    <Link2 className="size-4" />
                    Save &amp; share
                  </Button>
                  <Button variant="secondary" className="rounded-full" onClick={() => setCarouselOpen(true)}>
                    <Images className="size-4" />
                    Carousel
                  </Button>
                  <Button className="rounded-full" disabled={exporting} onClick={exportIssue}>
                    <Download className="size-4" />
                    Export
                  </Button>
                </>
              )}
            </div>
          </div>

          <header className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
            <span className="flex items-center gap-3 text-[10px] font-medium tracking-[0.3em] text-white/75 uppercase drop-shadow-sm">
              <span aria-hidden className="h-px w-6 bg-white/40" />
              Vol. I · {issue.dateline}
              <span aria-hidden className="h-px w-6 bg-white/40" />
            </span>
            <h1 className="font-editorial text-5xl leading-[1.05] tracking-tight text-balance text-white drop-shadow-md sm:text-6xl">
              {issue.title}
            </h1>
            {dek && <p className="text-sm leading-relaxed text-white/85 italic drop-shadow-sm">{dek}</p>}
            <p className="text-[11px] tracking-wide text-white/65 tabular-nums drop-shadow-sm">
              {issue.pages.length} pages · {photos.length} {photos.length === 1 ? "photograph" : "photographs"} ·{" "}
              {issue.words.toLocaleString()} words
            </p>
          </header>

          <IssueView issue={issue} tilt={tiltNow} sketches={sketches} />

          {(signInError ?? exportError) && (
            <p className="text-center text-xs text-red-100 drop-shadow-sm" role="alert">
              {signInError ?? exportError}
            </p>
          )}

          {/* Shown only when there is an allowance to show; a paid plan has none. */}
          {allowance?.remaining !== null && allowance !== null && !blocked && (
            <p className="text-center text-xs text-white/70 drop-shadow-sm">
              {allowance.remaining} of {allowance.limit} exports left this month on Wanderer.
            </p>
          )}


          <p className="text-center text-sm text-white/80 drop-shadow-sm">
            Set with Atlas. Laid out in your browser, and nothing of it is stored unless you save it — sealed, with the key in its link.
          </p>
          <p className="text-center text-xs text-white/70 drop-shadow-sm">
            {needsSignIn
              ? "Exporting needs an account — it is free, and your issue is kept exactly as you have it here while you sign in."
              : printsToSize
                ? "Export opens your print dialog — choose Save as PDF. The pages are already the right size, so leave the scale at 100%."
                : "Export saves the issue as a PDF to your downloads. A long issue takes a little while to set."}
          </p>
        </div>

        {/*
          Only laid out when printing, and never before there is an account to
          print for. Keeping the sheet out of the document is what stops Ctrl+P
          walking straight past the sign-in; hiding the button alone would not.
        */}
        {exporting && <PressFeed />}

        {!needsSignIn && !blocked && (
          <>
            <PrintSheet
              ref={sheet}
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              offscreen={exporting && !printsToSize}
            />
            <CarouselPanel
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              open={carouselOpen}
              onOpenChange={setCarouselOpen}
              onPress={claimCarousel}
            />
            <SavePanel
              issue={issue}
              tilt={tiltNow}
              sketches={sketches}
              photographs={photos.length}
              dek={dekOf(story)}
              open={saveOpen}
              onOpenChange={setSaveOpen}
              onPress={claimSave}
            />
          </>
        )}
      </>
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

          <ThemePicker theme={theme} onChoose={chooseTheme} />
          {leaning && <TiltControl tilt={tiltNow} onChange={setTilt} />}

          {/* A leaf of the issue given over to whatever the reader wants to
              put on it by hand. Off by default: an issue that ends in a blank
              page nobody asked for is a printing fault, not a feature. */}
          <label className="flex items-start gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={wantsSketch}
              onChange={event => chooseSketch(event.target.checked)}
              className="mt-0.5 size-4 accent-emerald-600"
            />
            <span>
              Add a page to draw on
              <span className="block text-xs text-stone-500">
                A blank leaf near the back — sign it, scrawl on it, colour it in.
              </span>
            </span>
          </label>
          {theme === "custom" && (
            <>
              <LayoutDesigner design={design} onChange={changeDesign} />
              <TypePanel type={type} onChange={changeType} />
            </>
          )}

          <PhotoPicker photos={photos} onAdd={addPhotos} onRemove={removePhoto} onReorder={reorderPhotos} />
          <StoryEditor
            story={story}
            onChange={setStory}
            wordCount={wordCount}
            onPolish={value => {
              setStory(value);
              setPolished(true);
            }}
            onSignIn={() => void signIn("speak")}
            openOn={storyTab}
          />

          <EditorPanel title={title} story={story} photos={photos} onApply={applyEditor} onUseTitle={setTitle} />
        </CardContent>
      </Card>

      <div className="sticky bottom-6 flex flex-wrap items-center justify-between gap-4 rounded-full border border-white/50 bg-white/85 py-3 pr-3 pl-6 shadow-lg shadow-black/10 backdrop-blur-md">
        <p className="text-sm text-stone-600">
          {/* A sign-in from the Speak tab that failed before leaving says so here, the only status line on the desk. */}
          {signInError ? <span className="text-red-600">{signInError}</span> : (blocker ?? "Ready for press.")}
          <span className="text-stone-500">
            {" "}
            · {photos.length} photos · {wordCount.toLocaleString()} words
          </span>
        </p>
        {/*
          No account needed to get here, nor to mark the issue up once there.
          Wrapped rather than passed straight through: `sendToPress` takes an
          optional seed, and a bare handler would hand it the click event.
        */}
        <Button
          className="rounded-full"
          disabled={!ready || blocker !== null || composing}
          onClick={() => void sendToPress()}
        >
          {composing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {composing ? "Setting the type" : "Send to press"}
        </Button>
      </div>
    </div>
  );
}
