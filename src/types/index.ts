/** Shared types used across the app. */

import type { EditorDirection } from "./directions";

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
 * Whether a plan includes the copy desk at all: any monthly allowance of
 * passes in `PLAN_LIMITS` (below) does.
 *
 * Read from the allowance rather than a separate list so the two cannot
 * disagree — Wanderer was once paid-only here while its allowance said
 * otherwise. The server enforces the count in `api/limits.ts`; the browser
 * uses this only to decide what to show, because a check made in the browser
 * is a check the browser could skip.
 */
export function hasCopyDesk(plan: Plan): boolean {
  return PLAN_LIMITS[plan].polish > 0;
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
 * and the story) needs an account. Both halves read it, the server to gate
 * `/api/editor` and the desk to decide what to offer.
 *
 * On, because every design is a paid call to the strongest model there is and
 * the monthly allowance below has to be counted against someone. Open to
 * anyone, one script could spend the month's budget in an afternoon.
 */
export const EDITOR_NEEDS_SIGN_IN = true;

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
  /** The fixed layouts an older editor chose from. No longer offered: the editor draws every page. */
  layouts?: EditorLayout[];
  /**
   * The look the reader asked for (`directions.ts`). Optional, so a desk
   * built before directions still gets the editor's own judgement.
   */
  direction?: EditorDirection;
};

/**
 * A page the editor drew: cut first into bands — horizontal (`rows`) or
 * vertical (`columns`) — and each band cut the other way into cells, each a
 * photograph, a run of the story, or a pull quote. Sizes are relative shares,
 * not measurements: the desk snaps every edge to the magazine's six-column grid,
 * its gutters and its margins, so a grid always fills its page edge to edge with
 * nothing overlapping, whatever shape the editor asked for. Two cuts deep is
 * the grammar every magazine grid is made of, and it cannot draw a page that
 * leaves a hole.
 */
export type GridCellKind = "photo" | "text" | "quote" | "color";
export type GridCell = { kind: GridCellKind; size: number; tone: "accent" | "ink" | "paper" };
export type GridBand = { size: number; cells: GridCell[] };
/** `stock` "ink" prints the page dark, its words reversed out of it. */
export type EditorGrid = { split: "rows" | "columns"; bands: GridBand[]; stock?: "ink" };

/** How much one page may hold, so every cell stays big enough to do its job. */
export const GRID_LIMITS = { bands: 4, cells: 3, photos: 4, quotes: 2, colors: 3 } as const;

/**
 * A grid as it may be drawn: known kinds, positive sizes, within the limits.
 * Used by the API on the editor's answer and by the desk on what it applies,
 * so the two can never disagree about what a page may be. Cells past a limit
 * are dropped rather than the page refused; a page left with nothing is null.
 */
export function cleanGrid(raw: unknown): EditorGrid | null {
  if (typeof raw !== "object" || raw === null) return null;
  const grid = raw as Record<string, any>;
  const split = grid.split === "columns" ? "columns" : "rows";
  const size = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0.05, value)) : 1);
  let photos = 0;
  let quotes = 0;
  let colors = 0;
  const bands: GridBand[] = [];
  for (const band of Array.isArray(grid.bands) ? grid.bands.slice(0, GRID_LIMITS.bands) : []) {
    const cells: GridCell[] = [];
    for (const cell of Array.isArray(band?.cells) ? band.cells.slice(0, GRID_LIMITS.cells) : []) {
      const kind: GridCellKind | null =
        cell?.kind === "photo" || cell?.kind === "text" || cell?.kind === "quote" || cell?.kind === "color" ? cell.kind : null;
      if (!kind) continue;
      if (kind === "photo" && ++photos > GRID_LIMITS.photos) continue;
      if (kind === "quote" && ++quotes > GRID_LIMITS.quotes) continue;
      if (kind === "color" && ++colors > GRID_LIMITS.colors) continue;
      const tone = cell.tone === "ink" || cell.tone === "paper" ? cell.tone : "accent";
      cells.push({ kind, size: size(cell.size), tone });
    }
    if (cells.length > 0) bands.push({ size: size(band.size), cells });
  }
  // A page of nothing but colour has nowhere for the story to go or a picture to sit.
  if (!bands.some(band => band.cells.some(cell => cell.kind !== "color"))) return null;
  return { split, bands, ...(grid.stock === "ink" ? { stock: "ink" as const } : {}) };
}

/** The photographs and pull quotes a grid takes. */
export const gridCounts = (grid: EditorGrid) => {
  const cells = grid.bands.flatMap(band => band.cells);
  return { photos: cells.filter(cell => cell.kind === "photo").length, quotes: cells.filter(cell => cell.kind === "quote").length };
};

/**
 * One designed page: a grid the editor drew, or the full-bleed page (one
 * photograph to the trim, a pull quote over it). `layout` and `share` are the
 * older form, a choice from fixed layouts, still read from a server that sends it.
 */
export type EditorPage = { grid?: EditorGrid | null; bleed?: boolean; layout?: string; share?: number };

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
  /** Whether this account may review submitted layouts (`ADMIN_EMAILS` on the API). Only decides what the site shows. */
  admin?: boolean;
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

// --- What each plan allows --------------------------------------------------
//
// One table for the pricing card, the desk and the server, so the three cannot
// promise, show and enforce different numbers. The server enforces; the desk
// only reads it to say how much is left.

/** The AI calls counted against a monthly allowance. */
export type AiKind = "editor" | "polish";

export type PlanLimits = {
  /** Longest story the desk will send to press. */
  words: number;
  /** Designs from the editor ("Lay it out for me") a calendar month. */
  editor: number;
  /** Passes through the copy desk a calendar month. Zero means not included. */
  polish: number;
};

/**
 * Sized to one trip a month with room to change your mind.
 *
 * A design costs roughly ₹18–35 in model time and a copy-desk pass on a long
 * story about ₹10, so the paid allowances cap the worst case at about twice
 * the plan's price while an ordinary month — one issue, two or three designs,
 * one polish — stays well inside it. Wanderer gets two of each: enough to feel
 * the editor and the copy desk on a trip, not enough to run a travel blog on
 * them.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { words: 5_000, editor: 2, polish: 2 },
  traveller: { words: 10_000, editor: 5, polish: 5 },
  cartographer: { words: 15_000, editor: 12, polish: 15 },
};

/** The longest story any plan allows: what the API's size checks are set from. */
export const MAX_STORY_WORDS = Math.max(...Object.values(PLAN_LIMITS).map(limits => limits.words));

/** Words in a story, counted the same way on both halves. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** One month's use of one allowance. */
export type Meter = { used: number; limit: number; remaining: number };

/** `GET /api/ai/allowance`: what this account has left this month. */
export type AiAllowance = { plan: Plan; words: number; editor: Meter; polish: Meter };

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

/**
 * The most photographs an editable copy carries. The desk takes ten; a Studio
 * issue can hold more, one per picture in its pages.
 */
export const EDITABLE_MAX_PHOTOS = 40;

/** `POST /api/issues`: what is about to be uploaded. */
export type SaveRequest = {
  pages: number;
  keep: Keep;
  /**
   * The issue's key, when it is to be kept in My magazines. Absent, the only
   * copy is in the link, and the issue can be opened by no one without it.
   */
  key?: string;
  /**
   * Present when the owner allowed editing later: the issue also carries its
   * editable copy (the editor's state and this many photographs), sealed with
   * the same key. Needs `key`, since everyone who edits it must open it.
   */
  editable?: { photos: number };
};

/** One signed place to put one sealed file. */
export type UploadSlot = { path: string; url: string };

export type SaveResponse = {
  id: string;
  /** The sealed manifest's slot first, then one per page in order. */
  manifest: UploadSlot;
  pages: UploadSlot[];
  /** The editable copy's slots, when one was asked for: its state, then each photograph. */
  source?: UploadSlot;
  photos?: UploadSlot[];
  /** ISO time, or null for forever. */
  expiresAt: string | null;
};

// --- Sharing and editing a saved issue ---------------------------------------
//
// An owner can share a saved issue with people by email address, or with a
// group code and its password, each with read or edit access. Only the owner
// changes who it is shared with. Editing reopens the issue's editable copy in
// the editor that made it, and saving puts new pages and a new copy in place
// of the old, at the same link.

/** What someone may do with a saved issue. */
export type IssueRole = "owner" | "edit" | "read";
/** The roles an owner hands out. */
export type MemberRole = Exclude<IssueRole, "owner">;
export const MEMBER_ROLES: readonly MemberRole[] = ["read", "edit"];

/** `GET /api/issues/:id/source`: what an editor needs to reopen an editable issue. */
export type EditableFiles = {
  id: string;
  key: string;
  /** The version being edited; saving changes from it is refused once another save has moved past it. */
  version: number;
  pages: number;
  source: string;
  photos: string[];
};

/** `POST /api/issues/:id/edits`: a new set of files about to replace the current one. */
export type EditRequest = { base: number; pages: number; photos: number };
export type EditResponse = { folder: string; manifest: UploadSlot; pages: UploadSlot[]; source: UploadSlot; photos: UploadSlot[] };
/** `POST /api/issues/:id/edits/commit`: every file of the edit is up; swap it in. */
export type EditCommit = { base: number; folder: string; pages: number; photos: number };

/** One person an issue is shared with. */
export type Member = { email: string; role: MemberRole; via: "invite" | "code"; joined: boolean };

/** `GET /api/issues/:id/members`: who it is shared with, and its group code if it has one. */
export type MembersResponse = {
  members: Member[];
  code: { code: string; role: MemberRole } | null;
  /** Whether invitations are emailed on this server. */
  mails: boolean;
};

export type InviteRequest = { email: string; role: MemberRole };
export type CodeRequest = { password: string; role: MemberRole };
/**
 * Joining one magazine with its group code. Each saved magazine has a code of
 * its own and opens nothing else; `id`, when the reader is on that magazine's
 * page, holds the code to that one magazine.
 */
export type JoinRequest = { code: string; password: string; id?: string };
export type JoinResponse = { id: string; role: MemberRole };

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
  /** Whose it is to this account: their own, or shared with them to read or edit. */
  role: IssueRole;
  /** Whether it carries its editable copy, so the owner and its editors can change it. */
  editable: boolean;
  version: number;
  /** For a shared issue, who shared it: their name, or their address. */
  sharedBy?: string;
  /** For the owner: how many people it is shared with, and whether a group code is on. */
  members?: number;
  hasCode?: boolean;
};

export type SavedList = { issues: SavedIssue[]; canKeepForever: boolean };

/**
 * `GET /api/admin/stats`: the editors' dashboard. Counts and sums only — no
 * email, name, photograph or word of anyone's appears here. A figure the
 * server could not read (a table not yet created, say) is null rather than
 * failing the whole page.
 */
export type AdminStats = {
  generatedAt: string;
  readers: { total: number | null; last7: number | null; last30: number | null; daily: { day: string; count: number }[] };
  subscriptions: { active: number; traveller: number; cartographer: number; cancelling: number } | null;
  /** Amounts in the currency's minor unit (paise, cents), one row per currency. */
  revenue: { currency: string; thisMonth: number; last30: number; allTime: number }[] | null;
  recentPayments: { amount: number; currency: string; at: string; provider: string; status: string }[] | null;
  magazines: { saved: number | null; last30: number | null; keptForever: number | null };
  exportsThisMonth: number | null;
  ai: { editor: number; polish: number } | null;
  layouts: { pending: number; accepted: number; rejected: number; likes: number } | null;
  waitlist: { total: number | null; last30: number | null };
  /** The API's own boot report: one line per integration, on or off. */
  system: string[];
};

/** Layouts readers submit to the directory, and the sanitizer every submission passes through. */
export * from "./layouts";
export * from "./directions";
