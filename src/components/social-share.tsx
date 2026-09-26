import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Download, Loader2, Share2 } from "lucide-react";

import { PrintSheet } from "@/components/magazine/print-sheet";
import { Button } from "@/components/ui/button";
import { canShareSlides, defaultSlides, pressSlides, pressStory, shareSlides, slidesMax, storyFromImage } from "@/lib/magazine/carousel";
import { printHonoursPageSize, saveBlob, slugOf } from "@/lib/magazine/press";
import type { Issue } from "@/lib/magazine/types";
import { openIssue, openPageBlob } from "@/lib/saved";
import { readKey } from "@/lib/vault";
import { zipOf } from "@/lib/zip";

/** Instagram's and X's marks, drawn here: the icon set carries no brand logos. */
function InstagramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

type Kind = "post" | "story";

const READY: Record<Kind, { share: string; download: string; how: string }> = {
  post: {
    share: "Share to Instagram",
    download: "Download the slides",
    how: "Your link is copied. In the share sheet pick Instagram, then Post. Instagram doesn't make links in captions clickable, so paste it into your bio and say “link in bio”.",
  },
  story: {
    share: "Share to your story",
    download: "Download the story",
    how: "Your link is copied. In the share sheet pick Instagram, then Story — then tap the sticker button, choose Link, and paste it into the space under the cover.",
  },
};

/**
 * Posting a saved magazine: to Instagram as a carousel or a story, or to X.
 *
 * X takes a link in a post, so it is one tap to its composer. Instagram takes
 * pictures, and only from the phone's share sheet, so those are drawn here
 * first — the carousel from the same pages the PDF is drawn from, the story
 * from the cover — and handed over in a second tap: a share sheet opens only
 * straight from a tap, and drawing takes longer than a tap lasts. Nothing is
 * sent anywhere by this panel; the pictures go where the reader sends them.
 */
export function SocialShare({
  title,
  link,
  makePost,
  makeStory,
  bare,
}: {
  title: string;
  link: string;
  /** The carousel's slides, in posting order. */
  makePost: () => Promise<File[]>;
  makeStory: () => Promise<File>;
  /** Without the rule and label above, for a panel that already says what it is. */
  bare?: boolean;
}) {
  const [drawing, setDrawing] = useState<Kind | null>(null);
  const [ready, setReady] = useState<{ kind: Kind; files: File[]; preview: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const run = useRef(0);
  // Instagram is only in the share sheet on a phone or tablet. A computer's
  // sheet offers AirDrop and Messages, so there the pictures go to the phone
  // first — the same platform test the press uses for its print dialog.
  const [onPhone] = useState(() => !printHonoursPageSize());

  // Each preview is an object URL over a drawn picture; let the last one go when it is replaced.
  useEffect(() => () => void (ready && URL.revokeObjectURL(ready.preview)), [ready]);

  /** Copied on the tap itself, while the browser still counts it as the reader's doing. */
  const copyLink = () => navigator.clipboard?.writeText(link).catch(() => undefined);

  const prepare = async (kind: Kind) => {
    setFailed(null);
    setReady(null);
    void copyLink();
    const mine = ++run.current;
    setDrawing(kind);
    try {
      const files = kind === "story" ? [await makeStory()] : await makePost();
      if (mine === run.current) setReady({ kind, files, preview: URL.createObjectURL(files[0]!) });
    } catch {
      if (mine === run.current) setFailed("The pages could not be drawn on this device. Try again, or on a computer.");
    } finally {
      if (mine === run.current) setDrawing(null);
    }
  };

  const share = async () => {
    if (!ready) return;
    setFailed(null);
    void copyLink();
    try {
      await shareSlides(ready.files);
    } catch (cause) {
      setFailed(
        cause instanceof DOMException && cause.name === "InvalidStateError"
          ? "The share sheet is already open."
          : "The share sheet would not open. Download the pictures instead.",
      );
    }
  };

  const download = async () => {
    if (!ready) return;
    if (ready.files.length === 1) saveBlob(ready.files[0]!, ready.files[0]!.name);
    else saveBlob(await zipOf(ready.files), `${slugOf(title)}-instagram.zip`);
  };

  const postToX = () => {
    const titled = title.trim() && title !== "Untitled";
    const text = titled ? `${title} — a magazine I made with Atlas` : "A magazine I made with Atlas";
    const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=600,height=520");
  };

  const shareable = ready ? canShareSlides(ready.files) : false;

  return (
    <section className={bare ? "flex flex-col gap-3" : "flex flex-col gap-3 border-t border-stone-200 pt-4"}>
      {!bare && <span className="text-[10px] font-medium tracking-[0.28em] text-stone-500 uppercase">Post it</span>}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-xl py-3" disabled={drawing !== null} onClick={() => void prepare("post")}>
          {drawing === "post" ? <Loader2 className="size-5 animate-spin" /> : <InstagramMark className="size-5" />}
          <span className="text-xs">Instagram post</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-xl py-3" disabled={drawing !== null} onClick={() => void prepare("story")}>
          {drawing === "story" ? <Loader2 className="size-5 animate-spin" /> : <InstagramMark className="size-5" />}
          <span className="text-xs">Instagram story</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-1.5 rounded-xl py-3" onClick={postToX}>
          <XMark className="size-5" />
          <span className="text-xs">Post on X</span>
        </Button>
      </div>

      {ready && (
        <div className="flex flex-col gap-3 rounded-xl bg-stone-50 p-3 ring-1 ring-stone-200">
          <div className="flex items-center gap-3">
            <img
              src={ready.preview}
              alt=""
              className={ready.kind === "story" ? "h-24 w-[54px] rounded object-cover" : "h-20 w-[60px] rounded object-cover"}
            />
            <p className="text-xs leading-relaxed text-stone-600">
              {ready.kind === "post" ? `${ready.files.length} ${ready.files.length === 1 ? "slide" : "slides"}, ready.` : "Your story, ready."}{" "}
              {shareable && onPhone
                ? READY[ready.kind].how
                : "Instagram posts from your phone: send this there (the share button can AirDrop it) or download it, then post it from the Instagram app. Your link is copied for your bio or a Link sticker."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {shareable && (
              <Button size="sm" className="rounded-full" onClick={() => void share()}>
                <Share2 className="size-4" /> {READY[ready.kind].share}
              </Button>
            )}
            <Button size="sm" variant={shareable ? "ghost" : "default"} className="rounded-full" onClick={() => void download()}>
              <Download className="size-4" /> {READY[ready.kind].download}
            </Button>
          </div>
        </div>
      )}
      {failed && <p className="text-xs text-red-600">{failed}</p>}
    </section>
  );
}

/**
 * Posting the issue just pressed: its pages drawn afresh, from the same leaves
 * the PDF is drawn from — the cover and the pages with pictures for a
 * carousel, the cover alone for a story.
 */
export function IssueSocialShare({ issue, link, tilt, sketches }: { issue: Issue; link: string; tilt?: number; sketches?: Record<string, string> }) {
  const [mounted, setMounted] = useState<Kind | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const picked = mounted === "story" ? issue.pages.slice(0, 1) : issue.pages.filter(page => defaultSlides(issue.pages, slidesMax()).has(page.index));

  /** Lays the pages out just long enough to draw them. Mounted synchronously so the leaves exist on the next line. */
  const withLeaves = async <T,>(kind: Kind, draw: (leaves: HTMLElement[]) => Promise<T>): Promise<T> => {
    flushSync(() => setMounted(kind));
    try {
      return await draw([...(sheet.current?.children ?? [])] as HTMLElement[]);
    } finally {
      setMounted(null);
    }
  };

  return (
    <>
      <SocialShare
        title={issue.title}
        link={link}
        makePost={() => withLeaves("post", leaves => pressSlides(leaves, issue.title))}
        makeStory={() => withLeaves("story", leaves => pressStory(leaves[0]!, issue.title))}
      />
      {/* Full size and off the screen, only while being drawn. Portalled out of the dialog, whose
          transform would otherwise make "off the screen" mean "off the dialog". */}
      {mounted && createPortal(<PrintSheet ref={sheet} issue={{ ...issue, pages: picked }} tilt={tilt} sketches={sketches} offscreen />, document.body)}
    </>
  );
}

/**
 * Which saved pages make the carousel: the cover, then pages spread evenly
 * through the rest of the issue, so a long one is not all opening spread. The
 * pages were sealed as pictures, so which hold photographs cannot be known.
 */
function spread(pages: number, max: number): number[] {
  if (pages <= max) return Array.from({ length: pages }, (_, n) => n);
  const rest = max - 1;
  const step = (pages - 1) / rest;
  return [0, ...Array.from({ length: rest }, (_, n) => Math.min(pages - 1, 1 + Math.round(n * step)))];
}

/**
 * Posting an issue from My magazines. Its pages are already the carousel's
 * 1080 × 1440 pictures, sealed; they are opened here with the key and handed
 * on as they are, so nothing is drawn again.
 */
export function SavedSocialShare({ id, keyText, cover, title, link }: { id: string; keyText: string; cover: string; title: string; link: string }) {
  const makePost = async () => {
    const { files, key } = await openIssue(id, keyText);
    const width = Math.max(2, String(files.urls.length).length);
    const stem = slugOf(title);
    const chosen = spread(files.urls.length, slidesMax());
    const slides: File[] = [];
    for (const [n, index] of chosen.entries()) {
      const blob = await openPageBlob(files.urls[index]!, key);
      slides.push(new File([blob], `${stem}-${String(n + 1).padStart(width, "0")}.jpg`, { type: "image/jpeg" }));
    }
    return slides;
  };
  const makeStory = async () => storyFromImage(await openPageBlob(cover, await readKey(keyText)), title);
  return <SocialShare title={title} link={link} makePost={makePost} makeStory={makeStory} bare />;
}
