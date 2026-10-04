/**
 * Saved issues: magazines kept to share by link, listed in My magazines, and
 * shared with people by name or by group code to read or to edit.
 *
 * What this server holds is sealed. The browser draws each page as a picture,
 * seals it with a key of its own (AES-GCM, `src/lib/vault.ts`) and uploads it
 * straight to the storage bucket through a signed URL handed out here. The
 * title, the pages and every word on them are inside the seal; the row says
 * only who saved it, how many pages it has and when it goes.
 *
 * The key travels in the link, after the `#`, which a browser never sends to
 * a server — so opening a shared link reaches this API with an id and nothing
 * else. It is stored here only when the reader asks for the issue to be kept
 * in My magazines, which is what lets their list open on another device, and
 * what lets the people it is shared with open it from theirs.
 *
 * An issue whose owner allowed editing also carries its editable copy — the
 * editor's state and its photographs, made smaller — sealed with the same key
 * and kept beside the pages. An edit uploads a whole new set into a folder of
 * its own and swaps it in only once every file has arrived, so a reader never
 * sees half of one.
 *
 * Uploads bypass this process on purpose. A 96-page issue is tens of
 * megabytes, far past what the API's host (or Vercel's 4.5 MB proxy) will
 * carry in one body, and bytes that never pass through here cannot be logged
 * here either.
 */

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";

import { APP_URL, issuesBucket, mailConfigured } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { burst } from "@api/limits";
import { escapeHtml, sendMail } from "@api/mail";
import { admin, authenticate, getActiveSubscription, getProfile } from "@api/supabase";
import {
  EDITABLE_MAX_PHOTOS,
  KEEPS,
  MEMBER_ROLES,
  SAVED_MAX_PAGES,
  type CodeRequest,
  type EditableFiles,
  type EditCommit,
  type EditRequest,
  type EditResponse,
  type InviteRequest,
  type IssueRole,
  type JoinRequest,
  type JoinResponse,
  type Keep,
  type Member,
  type MemberRole,
  type MembersResponse,
  type SaveRequest,
  type SaveResponse,
  type SavedFiles,
  type SavedIssue,
  type SavedList,
  type UploadSlot,
} from "@/types";

export const issueRoutes = Router();

const DAY = 86_400_000;

/** How long each choice lasts. Forever has no entry: its expiry is null. */
const LIFETIME: Record<Exclude<Keep, "forever">, number> = { "1d": DAY, "7d": 7 * DAY, "30d": 30 * DAY };

/**
 * How long a signed download URL works. Long enough to read a long issue in
 * one sitting; the reader asks again on the next visit.
 */
const SIGNED_FOR_S = 60 * 60;

/** An unfinished save or edit older than this is abandoned, and swept. */
const ABANDONED_MS = DAY;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 32 random bytes as unpadded base64url: an AES-256 key and nothing else. */
const KEY = /^[A-Za-z0-9_-]{43}$/;
/** The folders an edit writes into. */
const FOLDER = /^e-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Group codes: eight letters and digits that cannot be mistaken for one another when read aloud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

type Row = {
  id: string;
  user_id: string;
  pages: number;
  key: string | null;
  expires_at: string | null;
  created_at: string;
  editable: boolean;
  source_photos: number;
  folder: string | null;
  pending_folder: string | null;
  version: number;
  join_code: string | null;
  join_hash: string | null;
  join_role: MemberRole | null;
};

const COLUMNS =
  "id, user_id, pages, key, expires_at, created_at, editable, source_photos, folder, pending_folder, version, join_code, join_hash, join_role";

type Files = { manifest: string; pages: string[]; source: string | null; photos: string[] };

/**
 * Where a set of an issue's files lives: the issue's own folder for the set it
 * was first saved with, or a folder inside it written by an edit. The
 * manifest, then the pages, then the editable copy when there is one.
 */
function pathsOf(id: string, folder: string | null, pages: number, photos: number | null): Files {
  const base = folder ? `${id}/${folder}` : id;
  return {
    manifest: `${base}/manifest`,
    pages: Array.from({ length: pages }, (_, n) => `${base}/${String(n + 1).padStart(3, "0")}`),
    source: photos === null ? null : `${base}/source`,
    photos: Array.from({ length: photos ?? 0 }, (_, n) => `${base}/photo-${String(n + 1).padStart(2, "0")}`),
  };
}

const currentFiles = (row: Row) => pathsOf(row.id, row.folder, row.pages, row.editable ? row.source_photos : null);
const everyPath = (files: Files) => [files.manifest, ...files.pages, ...(files.source ? [files.source] : []), ...files.photos];

const bucket = () => admin().storage.from(issuesBucket);

/** Short-lived download URLs for `paths`, in the same order. */
async function signed(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await bucket().createSignedUrls(paths, SIGNED_FOR_S);
  if (error || !data) throw new HttpError(500, `Could not reach the saved pages: ${error?.message ?? "no answer"}`);
  const byPath = new Map(data.map(entry => [entry.path, entry.signedUrl]));
  return paths.map(path => {
    const url = byPath.get(path);
    if (!url) throw new HttpError(500, "A saved page is missing.");
    return url;
  });
}

/** One signed upload slot per path. */
function uploadSlots(paths: string[]): Promise<UploadSlot[]> {
  return Promise.all(
    paths.map(async path => {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw new HttpError(500, `Could not prepare the upload: ${error?.message ?? "no answer"}`);
      return { path, url: data.signedUrl };
    }),
  );
}

/** How many files have arrived in a folder. Subfolders (an edit's own) are listed too, and are not files. */
async function filesIn(folder: string): Promise<number> {
  const { data, error } = await bucket().list(folder, { limit: SAVED_MAX_PAGES + EDITABLE_MAX_PHOTOS + 20 });
  if (error) throw new HttpError(500, `Could not check the upload: ${error.message}`);
  return (data ?? []).filter(entry => entry.id !== null).length;
}

/** Removes files, in the bounded batches the storage API takes. */
async function removePaths(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 900) {
    const { error } = await bucket().remove(paths.slice(i, i + 900));
    if (error) throw new HttpError(500, `Could not delete the saved pages: ${error.message}`);
  }
}

/** Every file in one of an issue's edit folders, whatever it holds. */
async function clearFolder(id: string, folder: string): Promise<void> {
  const { data, error } = await bucket().list(`${id}/${folder}`, { limit: 1000 });
  if (error) throw new HttpError(500, `Could not tidy an unfinished edit: ${error.message}`);
  await removePaths((data ?? []).filter(entry => entry.id !== null).map(entry => `${id}/${folder}/${entry.name}`));
}

/** Whether a paid plan is live on this account: what Forever needs. */
async function canKeepForever(userId: string): Promise<boolean> {
  return (await getActiveSubscription(userId)) !== null;
}

const isExpired = (row: { expires_at: string | null }) => Boolean(row.expires_at && Date.parse(row.expires_at) <= Date.now());

/** A live, finished issue by id, or a 404 that does not say which of the two it was not. */
async function liveIssue(id: string): Promise<Row> {
  if (!ID.test(id)) throw new HttpError(404, "There is no magazine at this link.");
  const { data, error } = await admin().from("issues").select(COLUMNS).eq("id", id).eq("ready", true).maybeSingle();
  if (error) throw new HttpError(500, `Could not read the magazine: ${error.message}`);
  const row = data as Row | null;
  if (!row || isExpired(row)) throw new HttpError(404, "This magazine has expired, or its owner has taken it down.");
  return row;
}

/** One of the caller's own issues, finished or not. */
async function ownIssue(id: string, userId: string): Promise<Row> {
  if (!ID.test(id)) throw new HttpError(404, "No such magazine.");
  const { data, error } = await admin().from("issues").select(COLUMNS).eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, `Could not read the magazine: ${error.message}`);
  if (!data) throw new HttpError(404, "No such magazine.");
  return data as Row;
}

/** The caller's email, lowercased: what invitations are addressed to. */
function emailOf(req: Request): string {
  const email = req.user?.email?.toLowerCase();
  if (!email) throw new HttpError(403, "Your account has no email address, which sharing needs.");
  return email;
}

/**
 * Invitations sent to this account's address before it had signed in are
 * theirs now: they are tied to the account, so they follow it to any device.
 */
async function claimInvites(userId: string, email: string): Promise<void> {
  const { error } = await admin()
    .from("issue_members")
    .update({ user_id: userId, joined_at: new Date().toISOString() })
    .eq("email", email)
    .is("user_id", null);
  if (error) throw new HttpError(500, `Could not read your invitations: ${error.message}`);
}

/** What the caller may do with a live issue: own it, edit it, read it, or nothing (a 404, which says no more). */
async function access(req: Request, id: string): Promise<{ row: Row; role: IssueRole }> {
  const row = await liveIssue(id);
  const userId = req.user!.id;
  if (row.user_id === userId) return { row, role: "owner" };
  const email = req.user!.email?.toLowerCase() ?? "";
  const { data, error } = await admin()
    .from("issue_members")
    .select("role, user_id, email")
    .eq("issue_id", row.id)
    .or(`user_id.eq.${userId},email.eq."${email}"`)
    .limit(1)
    .maybeSingle();
  if (error) throw new HttpError(500, `Could not read the magazine: ${error.message}`);
  if (!data) throw new HttpError(404, "No such magazine.");
  return { row, role: (data as { role: MemberRole }).role };
}

/** Removes issues' files, then their rows, in that order, so a failure leaves a row the sweep will retry. */
async function remove(rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  for (const row of rows) if (row.pending_folder) await clearFolder(row.id, row.pending_folder);
  await removePaths(rows.flatMap(row => everyPath(currentFiles(row))));
  const { error } = await admin()
    .from("issues")
    .delete()
    .in(
      "id",
      rows.map(row => row.id),
    );
  if (error) throw new HttpError(500, `Could not delete the magazine: ${error.message}`);
}

function readCounts(body: { pages?: unknown; photos?: unknown }, photosToo: boolean): { pages: number; photos: number } {
  const pages = Number(body.pages);
  if (!Number.isInteger(pages) || pages < 1 || pages > SAVED_MAX_PAGES) {
    throw new HttpError(400, `A saved magazine has between 1 and ${SAVED_MAX_PAGES} pages.`);
  }
  const photos = photosToo ? Number(body.photos) : 0;
  if (!Number.isInteger(photos) || photos < 0 || photos > EDITABLE_MAX_PHOTOS) {
    throw new HttpError(400, `An editable magazine keeps at most ${EDITABLE_MAX_PHOTOS} photos.`);
  }
  return { pages, photos };
}

/**
 * Starts a save: records the issue and hands back a signed upload URL per file.
 *
 * The row is not `ready` until the browser says every file is up, so a save
 * abandoned halfway — a closed tab, a dropped connection — is never listed or
 * served, and the sweep clears it the next day.
 */
issueRoutes.post(
  "/issues",
  authenticate,
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Partial<SaveRequest>;
    const editable = body.editable !== undefined;
    const { pages, photos } = readCounts({ pages: body.pages, photos: body.editable?.photos }, editable);
    if (!KEEPS.includes(body.keep as Keep)) throw new HttpError(400, "Choose how long to keep it.");
    const keep = body.keep as Keep;
    if (body.key !== undefined && (typeof body.key !== "string" || !KEY.test(body.key))) {
      throw new HttpError(400, "That key is not one this site made.");
    }
    // Everyone who edits it has to open it, from their own My magazines.
    if (editable && !body.key) throw new HttpError(400, "A magazine that can be edited is kept in My magazines.");

    const userId = req.user!.id;
    if (keep === "forever" && !(await canKeepForever(userId))) {
      throw new HttpError(403, "Keeping a magazine forever comes with Traveller and Cartographer. Choose 30 days, or see the plans.");
    }

    const id = randomUUID();
    const expiresAt = keep === "forever" ? null : new Date(Date.now() + LIFETIME[keep]).toISOString();
    const { error } = await admin()
      .from("issues")
      .insert({ id, user_id: userId, pages, key: body.key ?? null, expires_at: expiresAt, editable, source_photos: photos });
    if (error) throw new HttpError(500, `Could not start saving: ${error.message}`);

    const files = pathsOf(id, null, pages, editable ? photos : null);
    const slots = await uploadSlots(everyPath(files));
    const response: SaveResponse = {
      id,
      manifest: slots[0]!,
      pages: slots.slice(1, 1 + pages),
      ...(editable ? { source: slots[1 + pages]!, photos: slots.slice(2 + pages) } : {}),
      expiresAt,
    };
    res.status(201).json(response);
  }),
);

/**
 * Finishes a save, once the browser has uploaded every file.
 *
 * Checked against the bucket rather than taken on trust: a link that opens
 * onto missing pages is worse than a save that says it failed.
 */
issueRoutes.post(
  "/issues/:id/ready",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    if ((await filesIn(row.id)) < everyPath(currentFiles(row)).length) throw new HttpError(409, "Some pages did not arrive. Try saving again.");

    const { error: updateError } = await admin().from("issues").update({ ready: true }).eq("id", row.id);
    if (updateError) throw new HttpError(500, `Could not finish saving: ${updateError.message}`);
    res.json({ ok: true });
  }),
);

/**
 * My magazines: every live issue this account saved, and every one shared
 * with it, newest first.
 */
issueRoutes.get(
  "/issues",
  authenticate,
  asyncRoute(async (req, res) => {
    const userId = req.user!.id;
    const email = req.user!.email?.toLowerCase();
    if (email) await claimInvites(userId, email);
    const now = new Date().toISOString();

    const { data: own, error } = await admin()
      .from("issues")
      .select(COLUMNS)
      .eq("user_id", userId)
      .eq("ready", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new HttpError(500, `Could not read your magazines: ${error.message}`);

    const { data: memberships, error: memberError } = await admin().from("issue_members").select("issue_id, role").eq("user_id", userId).limit(200);
    if (memberError) throw new HttpError(500, `Could not read the magazines shared with you: ${memberError.message}`);
    const roles = new Map((memberships ?? []).map(entry => [entry.issue_id as string, entry.role as MemberRole]));

    let shared: Row[] = [];
    if (roles.size > 0) {
      const { data, error: sharedError } = await admin()
        .from("issues")
        .select(COLUMNS)
        .in("id", [...roles.keys()])
        .eq("ready", true)
        .or(`expires_at.is.null,expires_at.gt.${now}`);
      if (sharedError) throw new HttpError(500, `Could not read the magazines shared with you: ${sharedError.message}`);
      shared = ((data ?? []) as Row[]).filter(row => row.key);
    }

    // For the owner's cards: how many people each is shared with.
    const ownRows = (own ?? []) as Row[];
    const counts = new Map<string, number>();
    if (ownRows.length > 0) {
      const { data } = await admin()
        .from("issue_members")
        .select("issue_id")
        .in(
          "issue_id",
          ownRows.map(row => row.id),
        );
      for (const entry of data ?? []) counts.set(entry.issue_id as string, (counts.get(entry.issue_id as string) ?? 0) + 1);
    }

    // Who shared each one, by name where their profile has one.
    const owners = new Map<string, string>();
    for (const ownerId of new Set(shared.map(row => row.user_id))) {
      const profile = await getProfile(ownerId);
      owners.set(ownerId, profile?.full_name || profile?.email || "Someone");
    }

    const rows = [...ownRows, ...shared].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const urls = await signed(
      rows.flatMap(row => {
        const files = currentFiles(row);
        return [files.manifest, files.pages[0]!];
      }),
    );

    const issues: SavedIssue[] = rows.map((row, n) => {
      const mine = row.user_id === userId;
      return {
        id: row.id,
        pages: row.pages,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        key: row.key,
        manifest: urls[n * 2]!,
        cover: urls[n * 2 + 1]!,
        role: mine ? "owner" : roles.get(row.id)!,
        editable: row.editable,
        version: row.version,
        ...(mine ? { members: counts.get(row.id) ?? 0, hasCode: row.join_code !== null } : { sharedBy: owners.get(row.user_id) }),
      };
    });
    const response: SavedList = { issues, canKeepForever: await canKeepForever(userId) };
    res.json(response);
  }),
);

/** Joins an issue with its group code and password, with the role the owner gave the code. */
issueRoutes.post(
  "/issues/join",
  authenticate,
  burst("issue-join", 10, 15 * 60_000),
  asyncRoute(async (req, res) => {
    const body = (req.body ?? {}) as Partial<JoinRequest>;
    const code = String(body.code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    const password = String(body.password ?? "");
    // Each magazine has its own code. On a magazine's own page the code must be that magazine's.
    const only = typeof body.id === "string" && ID.test(body.id) ? body.id : null;
    const wrong = new HttpError(403, only ? "That code and password do not open this magazine." : "That code and password do not open a magazine.");
    if (code.length !== 8 || !password) throw wrong;

    const now = new Date().toISOString();
    let query = admin().from("issues").select(COLUMNS).eq("join_code", code).eq("ready", true).or(`expires_at.is.null,expires_at.gt.${now}`);
    if (only) query = query.eq("id", only);
    const { data, error } = await query.maybeSingle();
    if (error) throw new HttpError(500, `Could not check the code: ${error.message}`);
    const row = data as Row | null;
    if (!row || !row.join_hash || !row.join_role || !row.key || !passwordMatches(password, row.join_hash)) throw wrong;

    const userId = req.user!.id;
    if (row.user_id === userId) throw new HttpError(409, "This is your own magazine. It is already in My magazines.");
    const email = emailOf(req);

    // Joining never lowers access someone was already given by name.
    const { data: existing } = await admin().from("issue_members").select("role").eq("issue_id", row.id).eq("email", email).maybeSingle();
    const role: MemberRole = existing?.role === "edit" ? "edit" : row.join_role;
    const { error: joinError } = await admin()
      .from("issue_members")
      .upsert(
        { issue_id: row.id, email, user_id: userId, role, via: existing ? "invite" : "code", joined_at: new Date().toISOString() },
        { onConflict: "issue_id,email" },
      );
    if (joinError) throw new HttpError(500, `Could not join: ${joinError.message}`);
    const response: JoinResponse = { id: row.id, role };
    res.json(response);
  }),
);

/**
 * One issue's sealed files, for anyone holding its link.
 *
 * No sign-in: a shared magazine is read by people who have no account, and
 * what this hands out is sealed bytes the key in their link opens.
 */
issueRoutes.get(
  "/issues/:id",
  asyncRoute(async (req, res) => {
    const row = await liveIssue(String(req.params.id));
    const files = currentFiles(row);
    const [manifest, ...urls] = await signed([files.manifest, ...files.pages]);
    const response: SavedFiles = { id: row.id, pages: row.pages, expiresAt: row.expires_at, manifest: manifest!, urls };
    // The URLs inside expire within the hour, so neither may a cached answer.
    res.set("Cache-Control", "no-store").json(response);
  }),
);

/** Takes an issue down, files, members and all. The link stops working at once. */
issueRoutes.delete(
  "/issues/:id",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    await remove([row]);
    res.json({ ok: true });
  }),
);

/* -------------------------------------------------------------- editing */

/** Only the owner and the people it is shared with to edit may change an issue, and only one that kept its editable copy. */
async function editable(req: Request): Promise<Row> {
  const { row, role } = await access(req, String(req.params.id));
  if (role === "read") throw new HttpError(403, "You can read this magazine, but not change it.");
  if (!row.editable || !row.key) throw new HttpError(409, "This magazine was saved without its editable copy, so it can only be read.");
  return row;
}

/** What an editor needs to reopen the issue: its key, its version and its editable copy. */
issueRoutes.get(
  "/issues/:id/source",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await editable(req);
    const files = currentFiles(row);
    const [source, ...photos] = await signed([files.source!, ...files.photos]);
    const response: EditableFiles = { id: row.id, key: row.key!, version: row.version, pages: row.pages, source: source!, photos };
    res.set("Cache-Control", "no-store").json(response);
  }),
);

/**
 * Starts saving changes: a new folder for a whole new set of files.
 *
 * Refused when the issue has moved past the version the editor opened, so a
 * save never quietly overwrites someone else's. An edit begun and never
 * finished is cleared when the next one starts, or by the sweep.
 */
issueRoutes.post(
  "/issues/:id/edits",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await editable(req);
    const body = (req.body ?? {}) as Partial<EditRequest>;
    if (body.base !== row.version) throw new HttpError(409, "Someone saved changes to this magazine after you opened it. Reopen it to edit the newest version.");
    const { pages, photos } = readCounts(body, true);

    if (row.pending_folder) await clearFolder(row.id, row.pending_folder);
    const folder = `e-${randomUUID()}`;
    const { error } = await admin().from("issues").update({ pending_folder: folder, pending_since: new Date().toISOString() }).eq("id", row.id);
    if (error) throw new HttpError(500, `Could not start saving: ${error.message}`);

    const slots = await uploadSlots(everyPath(pathsOf(row.id, folder, pages, photos)));
    const response: EditResponse = {
      folder,
      manifest: slots[0]!,
      pages: slots.slice(1, 1 + pages),
      source: slots[1 + pages]!,
      photos: slots.slice(2 + pages),
    };
    res.status(201).json(response);
  }),
);

/** Swaps a finished edit in, once every file is up, and clears the set it replaces. */
issueRoutes.post(
  "/issues/:id/edits/commit",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await editable(req);
    const body = (req.body ?? {}) as Partial<EditCommit>;
    const { pages, photos } = readCounts(body, true);
    if (typeof body.folder !== "string" || !FOLDER.test(body.folder) || body.folder !== row.pending_folder) {
      throw new HttpError(409, "Someone else started saving changes to this magazine at the same time. Reopen it and try again.");
    }
    if (body.base !== row.version) throw new HttpError(409, "Someone saved changes to this magazine after you opened it. Reopen it to edit the newest version.");
    if ((await filesIn(`${row.id}/${body.folder}`)) < everyPath(pathsOf(row.id, body.folder, pages, photos)).length) {
      throw new HttpError(409, "Some pages did not arrive. Try saving again.");
    }

    // Only if nobody has swapped in an edit since this one was checked.
    const { data, error } = await admin()
      .from("issues")
      .update({
        folder: body.folder,
        pages,
        source_photos: photos,
        version: row.version + 1,
        updated_at: new Date().toISOString(),
        updated_by: req.user!.id,
        pending_folder: null,
        pending_since: null,
      })
      .eq("id", row.id)
      .eq("version", row.version)
      .eq("pending_folder", body.folder)
      .select("id");
    if (error) throw new HttpError(500, `Could not save the changes: ${error.message}`);
    if (!data?.length) throw new HttpError(409, "Someone saved changes to this magazine at the same moment. Reopen it to see theirs.");

    // The set it replaced. Files left behind by a failure here are only
    // unreachable bytes, so the swap is not undone for them.
    await removePaths(everyPath(currentFiles(row))).catch(() => undefined);
    res.json({ ok: true, version: row.version + 1 });
  }),
);

/* -------------------------------------------------------------- sharing */

/** Sharing needs the key on the account: the people it is shared with open it from their own My magazines. */
function shareable(row: Row): void {
  if (!row.key) throw new HttpError(409, "This magazine was saved with its key in the link only, so it can be shared only by its link.");
}

function readRole(value: unknown): MemberRole {
  if (!MEMBER_ROLES.includes(value as MemberRole)) throw new HttpError(400, "Choose read or edit.");
  return value as MemberRole;
}

async function membersOf(row: Row): Promise<MembersResponse> {
  const { data, error } = await admin()
    .from("issue_members")
    .select("email, role, via, user_id")
    .eq("issue_id", row.id)
    .order("created_at", { ascending: true });
  if (error) throw new HttpError(500, `Could not read who it is shared with: ${error.message}`);
  const members: Member[] = (data ?? []).map(entry => ({
    email: entry.email as string,
    role: entry.role as MemberRole,
    via: entry.via as Member["via"],
    joined: entry.user_id !== null,
  }));
  return { members, code: row.join_code && row.join_role ? { code: row.join_code, role: row.join_role } : null, mails: mailConfigured };
}

/** Who an issue is shared with, and its group code. The owner's alone. */
issueRoutes.get(
  "/issues/:id/members",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    res.json(await membersOf(row));
  }),
);

/** Shares an issue with one address, or changes the access it already has. */
issueRoutes.post(
  "/issues/:id/members",
  authenticate,
  burst("issue-invite", 30, 60 * 60_000),
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    shareable(row);
    const body = (req.body ?? {}) as Partial<InviteRequest>;
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) throw new HttpError(400, "That does not look like an email address.");
    if (email === req.user!.email?.toLowerCase()) throw new HttpError(400, "That is your own address. It is already yours.");
    const role = readRole(body.role);

    const { data: existing } = await admin().from("issue_members").select("email").eq("issue_id", row.id).eq("email", email).maybeSingle();
    const { error } = await admin().from("issue_members").upsert({ issue_id: row.id, email, role, ...(existing ? {} : { via: "invite" }) }, { onConflict: "issue_id,email" });
    if (error) throw new HttpError(500, `Could not share it: ${error.message}`);

    // Told once, when first invited; a change of role is not worth an email.
    if (!existing) {
      const profile = await getProfile(req.user!.id);
      const from = profile?.full_name || req.user!.email || "Someone";
      const where = `${APP_URL}/magazines`;
      const what = role === "edit" ? "read and edit" : "read";
      void sendMail({
        to: email,
        subject: `${from} shared a magazine with you on Atlas`,
        text: `${from} shared a magazine with you on Atlas, for you to ${what}.\n\nSign in with Google as ${email} and it will be in My magazines:\n${where}\n`,
        html: `<p>${escapeHtml(from)} shared a magazine with you on Atlas, for you to ${what}.</p><p>Sign in with Google as <strong>${escapeHtml(email)}</strong> and it will be in <a href="${escapeHtml(where)}">My magazines</a>.</p>`,
      });
    }
    res.json(await membersOf(row));
  }),
);

/** Stops sharing an issue with one address. */
issueRoutes.delete(
  "/issues/:id/members/:email",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    const email = String(req.params.email).toLowerCase();
    const { error } = await admin().from("issue_members").delete().eq("issue_id", row.id).eq("email", email);
    if (error) throw new HttpError(500, `Could not stop sharing it: ${error.message}`);
    res.json(await membersOf(row));
  }),
);

/** Leaves an issue shared with this account. */
issueRoutes.delete(
  "/issues/:id/membership",
  authenticate,
  asyncRoute(async (req, res) => {
    const id = String(req.params.id);
    if (!ID.test(id)) throw new HttpError(404, "No such magazine.");
    const email = emailOf(req);
    const { error } = await admin().from("issue_members").delete().eq("issue_id", id).or(`user_id.eq.${req.user!.id},email.eq."${email}"`);
    if (error) throw new HttpError(500, `Could not leave it: ${error.message}`);
    res.json({ ok: true });
  }),
);

/* ----------------------------------------------------------- group code */

/** A salted scrypt hash, as `scrypt$salt$hash` in hex. */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}

function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const given = scryptSync(password, Buffer.from(salt, "hex"), expected.length);
  return timingSafeEqual(given, expected);
}

function newCode(): string {
  const bytes = randomBytes(8);
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/**
 * Turns the group code on, or changes its password or role. The code itself
 * stays the same once made, so a code already given out keeps working with
 * the new password; turning it off and on again makes a new one.
 */
issueRoutes.put(
  "/issues/:id/code",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    shareable(row);
    const body = (req.body ?? {}) as Partial<CodeRequest>;
    const password = String(body.password ?? "");
    if (password.length < 6 || password.length > 128) throw new HttpError(400, "Choose a password of at least six characters.");
    const role = readRole(body.role);

    let code = row.join_code;
    for (let attempt = 0; !code && attempt < 5; attempt++) {
      const candidate = newCode();
      const { data } = await admin().from("issues").select("id").eq("join_code", candidate).maybeSingle();
      if (!data) code = candidate;
    }
    if (!code) throw new HttpError(500, "Could not make a code. Try again.");

    const { error } = await admin().from("issues").update({ join_code: code, join_hash: hashPassword(password), join_role: role }).eq("id", row.id);
    if (error) throw new HttpError(500, `Could not set the code: ${error.message}`);
    res.json(await membersOf({ ...row, join_code: code, join_role: role }));
  }),
);

/** Turns the group code off. People who already joined with it keep their access. */
issueRoutes.delete(
  "/issues/:id/code",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    const { error } = await admin().from("issues").update({ join_code: null, join_hash: null, join_role: null }).eq("id", row.id);
    if (error) throw new HttpError(500, `Could not turn the code off: ${error.message}`);
    res.json(await membersOf({ ...row, join_code: null, join_role: null }));
  }),
);

/**
 * Deletes expired issues, saves abandoned before they finished, and edits
 * abandoned before they were swapped in.
 *
 * Run by `api/cron.ts`. Expiry is also checked on every read, so an issue is
 * unreachable the moment it expires; this is what actually frees the space.
 */
export async function pruneIssues(): Promise<number> {
  const now = new Date();
  const abandoned = new Date(now.getTime() - ABANDONED_MS).toISOString();
  const { data, error } = await admin()
    .from("issues")
    .select(COLUMNS)
    .or(`expires_at.lte.${now.toISOString()},and(ready.eq.false,created_at.lt.${abandoned})`)
    .limit(100);
  if (error) throw new Error(`could not read expired issues: ${error.message}`);
  const rows = (data ?? []) as Row[];
  await remove(rows);

  const { data: stale, error: staleError } = await admin().from("issues").select("id, pending_folder").lt("pending_since", abandoned).limit(100);
  if (staleError) throw new Error(`could not read abandoned edits: ${staleError.message}`);
  for (const edit of (stale ?? []) as { id: string; pending_folder: string | null }[]) {
    if (!edit.pending_folder) continue;
    await clearFolder(edit.id, edit.pending_folder);
    await admin().from("issues").update({ pending_folder: null, pending_since: null }).eq("id", edit.id).eq("pending_folder", edit.pending_folder);
  }
  return rows.length;
}
