/**
 * The layout directory: layouts readers submit, the editors review, and
 * everyone can start from and like once accepted.
 *
 * This is a deliberate exception to "nothing is stored", and a narrow one.
 * What is kept is a template — `sanitizeDesign` in `src/types/layouts.ts`
 * rebuilds every submission from known fields, drops every photograph and
 * replaces every word — plus one sample picture the submitter chose to attach
 * and agreed may be shown. The sample passes through here rather than
 * straight to storage because it is one small image, meant to be public, and
 * one request is simpler to make all-or-nothing than two.
 *
 * Samples sit in a private bucket and are handed out as short-lived signed
 * URLs, so a rejected sample is reachable by nobody but its submitter and the
 * editors, and the cron clears it away a month after the decision.
 */

import { randomUUID } from "node:crypto";
import { Router, type Request, type RequestHandler } from "express";

import { APP_URL, isAdmin, layoutsBucket, supabaseConfigured } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { burst } from "@api/limits";
import { escapeHtml, sendMail } from "@api/mail";
import { admin, authenticate } from "@api/supabase";
import {
  LAYOUT_KINDS,
  LAYOUT_LIMITS,
  sanitizeDesign,
  type LayoutCard,
  type LayoutDesign,
  type LayoutKind,
  type LayoutList,
  type LayoutStatus,
  type LayoutSubmission,
  type LikeResult,
  type OwnLayout,
  type OwnLayoutList,
  type ReviewDecision,
  type ReviewLayout,
  type ReviewList,
  type ReviewResult,
} from "@/types";

export const layoutRoutes = Router();

/** A sample is at most 1.5 MB decoded, which is about 2 MB as base64 in JSON. `app.ts` mounts the parser with this. */
export const LAYOUT_BODY_LIMIT = "3mb";

const SIGNED_FOR_S = 60 * 60;
const DAY = 86_400_000;
/** How long a rejected sample is kept, so its submitter can still see what was decided on. */
const REJECTED_SAMPLE_KEPT_MS = 30 * DAY;
/** The directory shows this many at a time. */
const PAGE = 60;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLUMNS = "id, user_id, kind, title, description, design, sample_path, status, review_note, reviewed_at, notified_at, likes, created_at";

type Row = {
  id: string;
  user_id: string;
  kind: LayoutKind;
  title: string;
  description: string;
  design: LayoutDesign;
  sample_path: string | null;
  status: LayoutStatus;
  review_note: string | null;
  reviewed_at: string | null;
  notified_at: string | null;
  likes: number;
  created_at: string;
};

const bucket = () => admin().storage.from(layoutsBucket);
const table = () => admin().from("layouts");

/**
 * Who is asking, when they say. The directory is public, but a signed-in
 * reader should see which layouts they have already liked; a bad or missing
 * token is simply an anonymous visit, never an error.
 */
const identify: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !supabaseConfigured) {
    next();
    return;
  }
  admin()
    .auth.getUser(token)
    .then(({ data }) => {
      if (data.user) req.user = data.user;
      next();
    })
    .catch(() => next());
};

const requireAdmin: RequestHandler = (req, _res, next) => {
  next(isAdmin(req.user?.email) ? undefined : new HttpError(403, "Only the editors can review layouts."));
};

function idParam(req: Request): string {
  const id = String(req.params.id ?? "");
  if (!ID.test(id)) throw new HttpError(404, "No such layout.");
  return id;
}

/** Signed URLs for the rows' samples, keyed by row id. */
async function samples(rows: Row[]): Promise<Map<string, string>> {
  const paths = rows.flatMap(row => (row.sample_path ? [row.sample_path] : []));
  if (paths.length === 0) return new Map();
  const { data, error } = await bucket().createSignedUrls(paths, SIGNED_FOR_S);
  if (error || !data) throw new HttpError(500, `Could not reach the layout samples: ${error?.message ?? "no answer"}`);
  const byPath = new Map(data.flatMap(entry => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [])));
  return new Map(rows.flatMap(row => (row.sample_path && byPath.has(row.sample_path) ? [[row.id, byPath.get(row.sample_path)!] as const] : [])));
}

/** First names only: a directory credit, never an address. */
async function authors(rows: Row[]): Promise<Map<string, { name: string | null; email: string | null }>> {
  const ids = [...new Set(rows.map(row => row.user_id))];
  if (ids.length === 0) return new Map();
  const { data, error } = await admin().from("profiles").select("id, full_name, email").in("id", ids);
  if (error) throw new HttpError(500, `Could not read the authors: ${error.message}`);
  return new Map(
    (data ?? []).map(profile => [
      profile.id as string,
      { name: (profile.full_name as string | null)?.trim().split(/\s+/)[0] || null, email: (profile.email as string | null) ?? null },
    ]),
  );
}

async function likedBy(viewer: string | undefined, rows: Row[]): Promise<Set<string>> {
  if (!viewer || rows.length === 0) return new Set();
  const { data, error } = await admin()
    .from("layout_likes")
    .select("layout_id")
    .eq("user_id", viewer)
    .in(
      "layout_id",
      rows.map(row => row.id),
    );
  if (error) throw new HttpError(500, `Could not read your likes: ${error.message}`);
  return new Set((data ?? []).map(entry => entry.layout_id as string));
}

async function describeRows(rows: Row[], viewer?: string) {
  const [urls, people, liked] = await Promise.all([samples(rows), authors(rows), likedBy(viewer, rows)]);
  return rows.map(row => {
    const card: LayoutCard = {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      design: row.design,
      sampleUrl: urls.get(row.id) ?? null,
      likes: row.likes,
      liked: liked.has(row.id),
      author: people.get(row.user_id)?.name ?? null,
      createdAt: row.created_at,
    };
    const own: OwnLayout = { ...card, status: row.status, note: row.review_note, reviewedAt: row.reviewed_at };
    const review: ReviewLayout = { ...own, authorEmail: people.get(row.user_id)?.email ?? null, notified: Boolean(row.notified_at) };
    return { card, own, review };
  });
}

/** A data URL's picture, checked by its first bytes as well as its label. */
function decodeSample(sample: unknown): { bytes: Buffer; type: string; ext: string } {
  const match = typeof sample === "string" ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(sample) : null;
  if (!match) throw new HttpError(400, "Attach a sample picture of the finished page (JPEG, PNG or WebP).");
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0) throw new HttpError(400, "The sample picture is empty.");
  if (bytes.length > LAYOUT_LIMITS.sampleBytes) throw new HttpError(413, "The sample picture is too large. Try a smaller image.");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const webp = bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
  if (jpeg) return { bytes, type: "image/jpeg", ext: "jpg" };
  if (png) return { bytes, type: "image/png", ext: "png" };
  if (webp) return { bytes, type: "image/webp", ext: "webp" };
  throw new HttpError(400, "The sample is not a picture this site can show.");
}

/* ------------------------------------------------------------- public */

layoutRoutes.get(
  "/layouts",
  identify,
  asyncRoute(async (req, res) => {
    const kind = LAYOUT_KINDS.includes(req.query.kind as LayoutKind) ? (req.query.kind as LayoutKind) : "poster";
    const newest = req.query.sort === "new";
    let query = table().select(COLUMNS).eq("status", "accepted").eq("kind", kind);
    query = newest ? query.order("created_at", { ascending: false }) : query.order("likes", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await query.limit(PAGE);
    if (error) throw new HttpError(500, `Could not read the directory: ${error.message}`);
    const described = await describeRows((data ?? []) as Row[], req.user?.id);
    res.setHeader("cache-control", "no-store");
    res.json({ layouts: described.map(entry => entry.card) } satisfies LayoutList);
  }),
);

layoutRoutes.get(
  "/layouts/mine",
  authenticate,
  asyncRoute(async (req, res) => {
    const { data, error } = await table().select(COLUMNS).eq("user_id", req.user!.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, `Could not read your layouts: ${error.message}`);
    const described = await describeRows((data ?? []) as Row[], req.user!.id);
    res.setHeader("cache-control", "no-store");
    res.json({ layouts: described.map(entry => entry.own) } satisfies OwnLayoutList);
  }),
);

/** One layout, to start from. Accepted ones are anyone's; a pending or rejected one only its submitter's and the editors'. */
layoutRoutes.get(
  "/layouts/:id",
  identify,
  asyncRoute(async (req, res) => {
    const id = idParam(req);
    const { data, error } = await table().select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new HttpError(500, `Could not read that layout: ${error.message}`);
    const row = data as Row | null;
    const mayRead = row && (row.status === "accepted" || row.user_id === req.user?.id || isAdmin(req.user?.email));
    if (!row || !mayRead) throw new HttpError(404, "No such layout.");
    const [described] = await describeRows([row], req.user?.id);
    res.setHeader("cache-control", "no-store");
    res.json(described!.own);
  }),
);

/* ---------------------------------------------------------- submitter */

layoutRoutes.post(
  "/layouts",
  authenticate,
  burst("layouts", 5, 60 * 60_000),
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Partial<LayoutSubmission>;
    const kind = body.kind;
    if (!LAYOUT_KINDS.includes(kind as LayoutKind)) throw new HttpError(400, "Say whether this is a poster or a magazine layout.");
    const title = typeof body.title === "string" ? body.title.trim().replace(/\s+/g, " ") : "";
    if (!title) throw new HttpError(400, "Give the layout a name.");
    if (title.length > LAYOUT_LIMITS.title) throw new HttpError(400, `Keep the name under ${LAYOUT_LIMITS.title} characters.`);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length > LAYOUT_LIMITS.description) throw new HttpError(400, `Keep the description under ${LAYOUT_LIMITS.description} characters.`);

    const design = sanitizeDesign(kind as LayoutKind, body.design);
    if (typeof design === "string") throw new HttpError(400, design);
    if (JSON.stringify(design).length > 200_000) throw new HttpError(413, "That layout is too large to submit.");
    const sample = decodeSample(body.sample);

    const userId = req.user!.id;
    const { count, error: countError } = await table().select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending");
    if (countError) throw new HttpError(500, `Could not check your submissions: ${countError.message}`);
    if ((count ?? 0) >= LAYOUT_LIMITS.pending) {
      throw new HttpError(429, `You have ${LAYOUT_LIMITS.pending} layouts waiting for review. Send another once one has been decided.`);
    }

    const id = randomUUID();
    const path = `${id}/sample.${sample.ext}`;
    const { error: uploadError } = await bucket().upload(path, sample.bytes, { contentType: sample.type, upsert: false });
    if (uploadError) throw new HttpError(500, `Could not store the sample: ${uploadError.message}`);

    const { data, error } = await table()
      .insert({ id, user_id: userId, kind, title, description, design, sample_path: path })
      .select(COLUMNS)
      .single();
    if (error || !data) {
      // A sample with no row is unreachable space; take it back.
      await bucket().remove([path]);
      throw new HttpError(500, `Could not submit the layout: ${error?.message ?? "no answer"}`);
    }
    const [described] = await describeRows([data as Row], userId);
    res.status(201).json(described!.own);
  }),
);

/** Withdraws a layout, whatever its status; the sample goes with it. */
layoutRoutes.delete(
  "/layouts/:id",
  authenticate,
  asyncRoute(async (req, res) => {
    const id = idParam(req);
    const { data, error } = await table().select("id, user_id, sample_path").eq("id", id).maybeSingle();
    if (error) throw new HttpError(500, `Could not read that layout: ${error.message}`);
    if (!data || (data.user_id !== req.user!.id && !isAdmin(req.user!.email))) throw new HttpError(404, "No such layout.");
    const { error: deleteError } = await table().delete().eq("id", id);
    if (deleteError) throw new HttpError(500, `Could not remove the layout: ${deleteError.message}`);
    if (data.sample_path) await bucket().remove([data.sample_path as string]);
    res.json({ ok: true });
  }),
);

layoutRoutes.post(
  "/layouts/:id/like",
  authenticate,
  burst("layout-likes", 60, 60_000),
  asyncRoute(async (req, res) => {
    const id = idParam(req);
    const { data, error } = await admin().rpc("toggle_layout_like", { p_layout: id, p_user: req.user!.id });
    if (error) throw new HttpError(error.message.includes("not found") ? 404 : 500, error.message.includes("not found") ? "No such layout." : `Could not record that: ${error.message}`);
    const result = (Array.isArray(data) ? data[0] : data) as LikeResult | undefined;
    if (!result) throw new HttpError(500, "Could not record that.");
    res.json({ liked: result.liked, likes: result.likes } satisfies LikeResult);
  }),
);

/* ------------------------------------------------------------ editors */

layoutRoutes.get(
  "/admin/layouts",
  authenticate,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const status = (["pending", "accepted", "rejected"] as const).includes(req.query.status as LayoutStatus) ? (req.query.status as LayoutStatus) : "pending";
    const { data, error } = await table()
      .select(COLUMNS)
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" })
      .limit(100);
    if (error) throw new HttpError(500, `Could not read the queue: ${error.message}`);
    const described = await describeRows((data ?? []) as Row[], req.user!.id);
    res.setHeader("cache-control", "no-store");
    res.json({ layouts: described.map(entry => entry.review) } satisfies ReviewList);
  }),
);

/** The two emails a submitter can get. Plain text first; the HTML is the same words. */
function decisionEmail(row: Row, accepted: boolean, note: string) {
  const kind = row.kind === "poster" ? "poster" : "magazine";
  const link = `${APP_URL}/layouts?kind=${row.kind}`;
  const noteLine = note ? `A note from the editors: ${note}` : "";
  const subject = accepted ? `Your layout "${row.title}" is in the Atlas directory` : `About your layout "${row.title}"`;
  const lines = accepted
    ? [
        `Good news: your ${kind} layout "${row.title}" has been accepted and is now in the Atlas layout directory, where anyone can start from it and like it.`,
        noteLine,
        `See it here: ${link}`,
      ]
    : [
        `Thank you for sending your ${kind} layout "${row.title}". We have decided not to add it to the directory this time.`,
        noteLine,
        `Your submissions, and room to send another, are at ${APP_URL}/layouts`,
      ];
  const body = lines.filter(Boolean);
  return {
    subject,
    text: [...body, "— The Atlas editors"].join("\n\n"),
    html: [...body.map(line => `<p>${escapeHtml(line)}</p>`), "<p>— The Atlas editors</p>"].join(""),
  };
}

layoutRoutes.post(
  "/admin/layouts/:id/review",
  authenticate,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const id = idParam(req);
    const body = (req.body ?? {}) as Partial<ReviewDecision>;
    if (body.decision !== "accept" && body.decision !== "reject") throw new HttpError(400, "Accept or reject.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, LAYOUT_LIMITS.note) : "";
    const status: LayoutStatus = body.decision === "accept" ? "accepted" : "rejected";

    const { data, error } = await table()
      .update({ status, review_note: note || null, reviewed_at: new Date().toISOString(), notified_at: null })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new HttpError(500, `Could not record the decision: ${error.message}`);
    const row = data as Row | null;
    if (!row) throw new HttpError(404, "No such layout.");

    const { data: profile } = await admin().from("profiles").select("email").eq("id", row.user_id).maybeSingle();
    const to = (profile?.email as string | null) ?? null;
    let emailed = false;
    if (to) {
      emailed = await sendMail({ to, ...decisionEmail(row, status === "accepted", note) });
      if (emailed) await table().update({ notified_at: new Date().toISOString() }).eq("id", id);
    }
    res.json({ status, emailed } satisfies ReviewResult);
  }),
);

/**
 * Clears away the samples of layouts rejected more than a month ago. The row
 * stays, so its submitter still sees the decision; only the picture goes.
 * Called by the cron.
 */
export async function pruneLayoutSamples(): Promise<number> {
  const before = new Date(Date.now() - REJECTED_SAMPLE_KEPT_MS).toISOString();
  const { data, error } = await table().select("id, sample_path").eq("status", "rejected").lt("reviewed_at", before).not("sample_path", "is", null).limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; sample_path: string }[];
  if (rows.length === 0) return 0;
  await bucket().remove(rows.map(row => row.sample_path));
  await table()
    .update({ sample_path: null })
    .in(
      "id",
      rows.map(row => row.id),
    );
  return rows.length;
}
