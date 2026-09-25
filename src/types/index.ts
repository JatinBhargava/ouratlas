/** Shared types used across the app. */

export type ApiError = {
  status: number;
  message: string;
};

/**
 * Where in a photograph the interesting part is, as percentages.
 *
 * These are `object-position` percentages: 0 is the left or top edge, 100 the
 * right or bottom.
 */
export type Focus = { x: number; y: number };

export const CENTRED: Focus = { x: 50, y: 50 };

/** An image chosen for an album. `url` is an object URL local to the tab. */
export type Photo = {
  id: string;
  file: File;
  url: string;
  /**
   * Where the picture sits inside its frame, or absent for auto.
   *
   * Absent is the default and means the plate places the photograph itself:
   * it fills the frame and the middle is kept, which is a guess but usually
   * the right one. Present means someone has taken the placing over, and the
   * picture stays exactly where they put it. Handing it back to auto clears
   * this rather than remembering a position nobody is using.
   */
  focus?: Focus;
  /** A line set under the photograph, written by the editor; absent for a plain plate number. */
  caption?: string;
};

// --- Accounts and billing ------------------------------------------------
//
// Shared by the Express API in `api/` and the React app, so the two cannot
// drift on what a plan is called.

/** Plans you can pay for. The names match the pricing table and Stripe. */
export type PaidPlan = "traveller" | "cartographer";

/** Every account is on one of these; "free" is the absence of a subscription. */
export type Plan = "free" | PaidPlan;

/**
 * Plans that include the copy desk.
 *
 * The one entitlement both halves of the app have to agree on, so it lives
 * here rather than being spelt out twice. The server enforces it in
 * `api/routes/polish.ts`; the browser uses it only to decide what to show,
 * because a check made in the browser is a check the browser could skip.
 */
export const COPY_DESK_PLANS: readonly Plan[] = ["traveller", "cartographer"];

export function hasCopyDesk(plan: Plan): boolean {
  return COPY_DESK_PLANS.includes(plan);
}

/**
 * Whether recording in the Speak tab needs an account.
 *
 * Off for now, so anyone can try voice before signing up. Both halves read
 * it: the server decides whether `/api/transcribe` sits behind
 * `authenticate`, and the Speak tab decides whether to offer sign-in first.
 * Turning it back on is this one line; the sign-in path, which parks the desk
 * and returns to the Speak tab, is still wired up and waiting.
 */
export const VOICE_NEEDS_SIGN_IN = false;

/**
 * `POST /api/transcribe/session`: a short-lived key that opens one live
 * transcription session with OpenAI, straight from the browser.
 */
export type TranscribeSession = {
  secret: string;
  /** Unix seconds; the key must be used to connect before then. */
  expiresAt: number;
};

/**
 * The audio the live session expects: 16-bit mono PCM at this rate. The
 * server declares it when opening the session and the browser resamples the
 * microphone to it, so it lives here where both can see the same number.
 */
export const TRANSCRIBE_SAMPLE_RATE = 24_000;

/**
 * Largest piece of an uploaded recording the server accepts. The browser cuts
 * files to fit: two minutes of 16 kHz 16-bit mono is 3.84 MB, which clears
 * Vercel's 4.5 MB proxy limit with room for the WAV header.
 */
export const TRANSCRIBE_PIECE_BYTES = 4_400_000;

/**
 * Whether the editor (the agent that lays out an issue from the photographs
 * and the story) needs an account. Off for now, like voice; both halves read
 * it, the server to gate `/api/editor` and the desk to decide what to offer.
 */
export const EDITOR_NEEDS_SIGN_IN = false;

/** Most photographs an issue holds, and so the most the editor is ever shown. */
export const EDITOR_MAX_PHOTOS = 10;

/** One photograph as the editor sees it: a small JPEG preview and its true shape. */
export type EditorPhoto = {
  /** A short label ("p1"), not the desk's id, so nothing on the desk leaks into a prompt. */
  id: string;
  /** A data URL: a JPEG a few hundred pixels across. */
  preview: string;
  width: number;
  height: number;
};

/**
 * A style the editor may choose, described by the desk that owns the list.
 * `suits` says when to choose it; the blurb alone says only what it looks
 * like, and the editor picked the most evocative-sounding one every time.
 */
export type EditorTheme = { id: string; name: string; blurb: string; suits: string };

/** A typeface the editor may set a designed issue in. */
export type EditorFace = { id: string; name: string; body: boolean };

/** A page layout the editor may build a designed issue from (see `archetypes.ts`). */
export type EditorLayout = {
  id: string;
  name: string;
  description: string;
  plates: number;
  /** Pull quotes the page takes. */
  quotes: number;
  minShare: number;
  maxShare: number;
};

export type EditorRequest = {
  title: string;
  story: string;
  /** The words in the story, so the editor can judge how many pages it runs to. */
  words: number;
  /** The slot each body page is drawn from, in order: "special", "left" or "right". */
  rhythm: string[];
  photos: EditorPhoto[];
  themes: EditorTheme[];
  faces: EditorFace[];
  layouts: EditorLayout[];
};

/**
 * One designed page: which layout, and how much of the page's depth the
 * photograph takes. The desk builds the boxes; the editor never places them.
 */
export type EditorPage = { layout: string; share: number };

/**
 * A designed issue. The three named pages are the shared design every page of
 * that kind is drawn from; `pages` is the editor's plan for the body page by
 * page, in reading order, so the issue changes its rhythm rather than
 * repeating three pages. Pages past the end of the plan fall back to the
 * shared design.
 */
export type EditorDesign = { special: EditorPage; left: EditorPage; right: EditorPage; pages: EditorPage[] };

/** Type for a designed issue; the desk holds it inside what its controls allow. */
export type EditorType = { display: string; body: string; size: number; leading: number; align: "justify" | "left" };

/** What the editor decided, and why. */
export type EditorPlan = {
  /** A title for the issue, always offered; the desk decides whether to use it. */
  title: string;
  theme: string;
  /** Every photograph's label, cover first. */
  order: string[];
  /** Where each photograph's subject is, as percentages across and down. */
  focus: { id: string; x: number; y: number }[];
  /** Degrees the snapshots lean, for the one theme that leans them. */
  tilt: number;
  /** Pages drawn by the editor, only when it chose the "custom" style. */
  design: EditorDesign | null;
  /** Type for those pages, likewise. */
  type: EditorType | null;
  /** A line under each photograph, by label: what it shows, in the magazine's voice. */
  captions: { id: string; caption: string }[];
  /** Paper, ink and accent as hex colours, drawn from the photographs; designed issues only. */
  palette: { paper: string; ink: string; accent: string } | null;
  /** Pull quotes lifted word for word from the story, in the order they are to appear. */
  quotes: string[];
  /** A few sentences to the reader, one per decision worth explaining. */
  notes: string[];
};

/** `POST /api/transcribe/file`: the words in one piece of an uploaded recording. */
export type TranscribeResponse = {
  text: string;
};

/** What the signed-in person is entitled to, as the server sees it. */
export type Billing = {
  plan: Plan;
  /** The processor's subscription status, or null on a free account. */
  status: string | null;
  /** ISO date the current period ends, or null on a free account. */
  currentPeriodEnd: string | null;
  /** True when the plan is set to lapse rather than renew. */
  cancelAtPeriodEnd: boolean;
};

/** The signed-in person, flattened out of the Supabase user record. */
export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

/** `GET /api/me` */
export type MeResponse = {
  user: SessionUser;
  billing: Billing;
};

/** `POST /api/billing/checkout` and `/api/billing/portal` both answer with a URL to visit. */
export type RedirectResponse = { url: string };

/**
 * `GET /api/exports` and `POST /api/exports`.
 *
 * `limit` is null when this account is not counted at all — either the limit
 * is switched off on the server, or the plan is a paid one. In that case
 * `remaining` is null too, and nothing about an allowance should be shown.
 */
export type ExportAllowance = {
  used: number;
  limit: number | null;
  remaining: number | null;
};

/** `POST /api/waitlist` */
export type WaitlistResponse = { ok: true; alreadySubscribed: boolean };

/** `GET /api/visits` — Vercel Web Analytics totals for the whole project. */
export type VisitsResponse = {
  visitors: number;
  pageviews: number;
};

// --- Saved issues ----------------------------------------------------------
//
// A saved issue is its pages as pictures, sealed in the browser with a key
// the server never sees in the link. The server keeps sealed bytes, a page
// count and an expiry; the title, the pages and everything on them are inside
// the seal.

/** How long a saved issue lasts. "forever" is for paid plans only. */
export type Keep = "1d" | "7d" | "30d" | "forever";

/** In the order the save panel offers them. */
export const KEEPS: readonly Keep[] = ["1d", "7d", "30d", "forever"];

/** The most pages a saved issue may have: the composer's own ceiling. */
export const SAVED_MAX_PAGES = 96;

/**
 * The most one sealed file may weigh. A slide is a few hundred kilobytes;
 * this is headroom, not a target, and the bucket enforces it as well.
 */
export const SAVED_MAX_FILE_BYTES = 2 * 1024 * 1024;

/** `POST /api/issues`: what is about to be uploaded. */
export type SaveRequest = {
  pages: number;
  keep: Keep;
  /**
   * The issue's key, when it is to be kept in My magazines. Absent, the only
   * copy is in the link, and the issue can be opened by no one without it.
   */
  key?: string;
};

/** One signed place to put one sealed file. */
export type UploadSlot = { path: string; url: string };

export type SaveResponse = {
  id: string;
  /** The sealed manifest's slot first, then one per page in order. */
  manifest: UploadSlot;
  pages: UploadSlot[];
  /** ISO time, or null for forever. */
  expiresAt: string | null;
};

/** `GET /api/issues/:id`: where to fetch a saved issue's sealed files. */
export type SavedFiles = {
  id: string;
  pages: number;
  expiresAt: string | null;
  manifest: string;
  urls: string[];
};

/** One row of My magazines. */
export type SavedIssue = {
  id: string;
  pages: number;
  createdAt: string;
  expiresAt: string | null;
  /** The key, where the issue was kept in My magazines; null when the link holds the only copy. */
  key: string | null;
  /** Signed, short-lived: the sealed manifest and the sealed cover, for the card. */
  manifest: string;
  cover: string;
};

export type SavedList = { issues: SavedIssue[]; canKeepForever: boolean };
