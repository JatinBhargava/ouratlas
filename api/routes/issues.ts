/**
 * Saved issues: magazines kept to share by link, and listed in My magazines.
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
 * in My magazines, which is what lets their list open on another device.
 *
 * Uploads bypass this process on purpose. A 96-page issue is tens of
 * megabytes, far past what the API's host (or Vercel's 4.5 MB proxy) will
 * carry in one body, and bytes that never pass through here cannot be logged
 * here either.
 */

import { randomUUID } from "node:crypto";
import { Router } from "express";

import { issuesBucket } from "@api/env";
import { asyncRoute, HttpError } from "@api/http";
import { admin, authenticate, getActiveSubscription } from "@api/supabase";
import {
  KEEPS,
  SAVED_MAX_PAGES,
  type Keep,
  type SaveRequest,
  type SaveResponse,
  type SavedFiles,
  type SavedIssue,
  type SavedList,
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

/** An unfinished save older than this is abandoned, and swept. */
const ABANDONED_MS = DAY;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** 32 random bytes as unpadded base64url: an AES-256 key and nothing else. */
const KEY = /^[A-Za-z0-9_-]{43}$/;

/** Where an issue's files live: a folder per issue, the manifest and then the pages. */
function pathsOf(id: string, pages: number): { manifest: string; pages: string[] } {
  return {
    manifest: `${id}/manifest`,
    pages: Array.from({ length: pages }, (_, n) => `${id}/${String(n + 1).padStart(3, "0")}`),
  };
}

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

/** Whether a paid plan is live on this account: what Forever needs. */
async function canKeepForever(userId: string): Promise<boolean> {
  return (await getActiveSubscription(userId)) !== null;
}

type Row = { id: string; user_id: string; pages: number; key: string | null; expires_at: string | null; created_at: string };

/** A live, finished issue by id, or a 404 that does not say which of the two it was not. */
async function liveIssue(id: string): Promise<Row> {
  if (!ID.test(id)) throw new HttpError(404, "There is no magazine at this link.");
  const { data, error } = await admin()
    .from("issues")
    .select("id, user_id, pages, key, expires_at, created_at")
    .eq("id", id)
    .eq("ready", true)
    .maybeSingle();
  if (error) throw new HttpError(500, `Could not read the magazine: ${error.message}`);
  const row = data as Row | null;
  if (!row || (row.expires_at && Date.parse(row.expires_at) <= Date.now())) {
    throw new HttpError(404, "This magazine has expired, or its owner has taken it down.");
  }
  return row;
}

/** One of the caller's own issues, finished or not. */
async function ownIssue(id: string, userId: string): Promise<Row> {
  if (!ID.test(id)) throw new HttpError(404, "No such magazine.");
  const { data, error } = await admin()
    .from("issues")
    .select("id, user_id, pages, key, expires_at, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, `Could not read the magazine: ${error.message}`);
  if (!data) throw new HttpError(404, "No such magazine.");
  return data as Row;
}

/** Removes an issue's files and then its row, in that order, so a failure leaves a row the sweep will retry. */
async function remove(rows: { id: string; pages: number }[]): Promise<void> {
  if (rows.length === 0) return;
  const paths = rows.flatMap(row => {
    const all = pathsOf(row.id, row.pages);
    return [all.manifest, ...all.pages];
  });
  // The storage API takes a bounded list per call.
  for (let i = 0; i < paths.length; i += 900) {
    const { error } = await bucket().remove(paths.slice(i, i + 900));
    if (error) throw new HttpError(500, `Could not delete the saved pages: ${error.message}`);
  }
  const { error } = await admin()
    .from("issues")
    .delete()
    .in(
      "id",
      rows.map(row => row.id),
    );
  if (error) throw new HttpError(500, `Could not delete the magazine: ${error.message}`);
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
    const pages = Number(body.pages);
    if (!Number.isInteger(pages) || pages < 1 || pages > SAVED_MAX_PAGES) {
      throw new HttpError(400, `A saved magazine has between 1 and ${SAVED_MAX_PAGES} pages.`);
    }
    if (!KEEPS.includes(body.keep as Keep)) throw new HttpError(400, "Choose how long to keep it.");
    const keep = body.keep as Keep;
    if (body.key !== undefined && (typeof body.key !== "string" || !KEY.test(body.key))) {
      throw new HttpError(400, "That key is not one this site made.");
    }

    const userId = req.user!.id;
    if (keep === "forever" && !(await canKeepForever(userId))) {
      throw new HttpError(403, "Keeping a magazine forever comes with Traveller and Cartographer. Choose 30 days, or see the plans.");
    }

    const id = randomUUID();
    const expiresAt = keep === "forever" ? null : new Date(Date.now() + LIFETIME[keep]).toISOString();
    const { error } = await admin()
      .from("issues")
      .insert({ id, user_id: userId, pages, key: body.key ?? null, expires_at: expiresAt });
    if (error) throw new HttpError(500, `Could not start saving: ${error.message}`);

    const paths = pathsOf(id, pages);
    const slots = await Promise.all(
      [paths.manifest, ...paths.pages].map(async path => {
        const { data, error: signError } = await bucket().createSignedUploadUrl(path);
        if (signError || !data) throw new HttpError(500, `Could not prepare the upload: ${signError?.message ?? "no answer"}`);
        return { path, url: data.signedUrl };
      }),
    );

    const response: SaveResponse = { id, manifest: slots[0]!, pages: slots.slice(1), expiresAt };
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
    const { data, error } = await bucket().list(row.id, { limit: SAVED_MAX_PAGES + 10 });
    if (error) throw new HttpError(500, `Could not check the upload: ${error.message}`);
    if ((data?.length ?? 0) < row.pages + 1) throw new HttpError(409, "Some pages did not arrive. Try saving again.");

    const { error: updateError } = await admin().from("issues").update({ ready: true }).eq("id", row.id);
    if (updateError) throw new HttpError(500, `Could not finish saving: ${updateError.message}`);
    res.json({ ok: true });
  }),
);

/** My magazines: every live issue this account has saved, newest first. */
issueRoutes.get(
  "/issues",
  authenticate,
  asyncRoute(async (req, res) => {
    const userId = req.user!.id;
    const now = new Date().toISOString();
    const { data, error } = await admin()
      .from("issues")
      .select("id, user_id, pages, key, expires_at, created_at")
      .eq("user_id", userId)
      .eq("ready", true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new HttpError(500, `Could not read your magazines: ${error.message}`);

    const rows = (data ?? []) as Row[];
    const urls = await signed(rows.flatMap(row => {
      const paths = pathsOf(row.id, row.pages);
      return [paths.manifest, paths.pages[0]!];
    }));

    const issues: SavedIssue[] = rows.map((row, n) => ({
      id: row.id,
      pages: row.pages,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      key: row.key,
      manifest: urls[n * 2]!,
      cover: urls[n * 2 + 1]!,
    }));
    const response: SavedList = { issues, canKeepForever: await canKeepForever(userId) };
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
    const paths = pathsOf(row.id, row.pages);
    const [manifest, ...urls] = await signed([paths.manifest, ...paths.pages]);
    const response: SavedFiles = { id: row.id, pages: row.pages, expiresAt: row.expires_at, manifest: manifest!, urls };
    // The URLs inside expire within the hour, so neither may a cached answer.
    res.set("Cache-Control", "no-store").json(response);
  }),
);

/** Takes an issue down, files and all. The link stops working at once. */
issueRoutes.delete(
  "/issues/:id",
  authenticate,
  asyncRoute(async (req, res) => {
    const row = await ownIssue(String(req.params.id), req.user!.id);
    await remove([row]);
    res.json({ ok: true });
  }),
);

/**
 * Deletes expired issues, and saves abandoned before they finished.
 *
 * Run by `api/cron.ts`. Expiry is also checked on every read, so an issue is
 * unreachable the moment it expires; this is what actually frees the space.
 */
export async function pruneIssues(): Promise<number> {
  const now = new Date();
  const abandoned = new Date(now.getTime() - ABANDONED_MS).toISOString();
  const { data, error } = await admin()
    .from("issues")
    .select("id, pages")
    .or(`expires_at.lte.${now.toISOString()},and(ready.eq.false,created_at.lt.${abandoned})`)
    .limit(100);
  if (error) throw new Error(`could not read expired issues: ${error.message}`);
  const rows = (data ?? []) as { id: string; pages: number }[];
  await remove(rows);
  return rows.length;
}
