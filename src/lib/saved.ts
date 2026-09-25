/**
 * Saved issues, from the browser's side: saving one, listing them, opening
 * one from its link, taking one down.
 *
 * An issue is saved as the pictures the carousel makes — each page drawn at
 * 1080 × 1440 — rather than as the words and photographs it was set from.
 * Pictures read the same on every screen. A composed issue re-drawn on another
 * machine would be set in that machine's fonts, and the fitter's promise that
 * every line fits holds only for the fonts it measured.
 */

import { api } from "@/lib/api";
import { pressSlides } from "@/lib/magazine/carousel";
import { newKey, readKey, seal, unseal } from "@/lib/vault";
import type { Keep, SavedFiles, SavedList, SaveRequest, SaveResponse, UploadSlot } from "@/types";

/** What is sealed alongside the pages: everything the reader shows about the issue. */
export type Manifest = {
  v: 1;
  title: string;
  dateline: string;
  pages: number;
  /** Printed page numbers, null on the cover, so the reader can say where it is. */
  folios: (number | null)[];
  words: number;
  photographs: number;
  /** The story's opening line, shown under the title. */
  dek: string;
  savedAt: string;
};

/** The address that opens a saved issue: its id in the query, its key after the `#`. */
export function linkFor(id: string, key: string): string {
  return new URL(`/read?i=${id}#${key}`, location.origin).toString();
}

/** A sealed file up to its signed slot, the way the storage client sends one. */
async function upload(slot: UploadSlot, file: Blob): Promise<void> {
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const response = await fetch(slot.url, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
  if (!response.ok) throw new Error("A page could not be uploaded. Check the connection and try again.");
}

/** How many uploads go at once: enough to fill a connection, few enough not to choke a phone's. */
const PARALLEL = 4;

export type SaveProgress = { stage: "drawing" | "sending"; done: number; total: number };

/**
 * Draws, seals and uploads an issue, and returns its link.
 *
 * `keepInLibrary` decides whether the key is stored on the account. Without
 * it the link is the only way in, and the issue can be opened by no one else —
 * this site included.
 */
export async function saveIssue(
  leaves: HTMLElement[],
  manifest: Omit<Manifest, "v" | "pages" | "savedAt">,
  options: { keep: Keep; keepInLibrary: boolean },
  onProgress?: (progress: SaveProgress) => void,
): Promise<{ id: string; link: string; expiresAt: string | null }> {
  const total = leaves.length;
  const slides = await pressSlides(leaves, manifest.title, done => onProgress?.({ stage: "drawing", done, total }));
  const { key, text } = await newKey();

  const request: SaveRequest = { pages: total, keep: options.keep, ...(options.keepInLibrary ? { key: text } : {}) };
  const started = await api.post<SaveResponse>("/api/issues", request);

  const sealedManifest = await seal(
    key,
    new TextEncoder().encode(JSON.stringify({ ...manifest, v: 1, pages: total, savedAt: new Date().toISOString() } satisfies Manifest)),
  );
  await upload(started.manifest, sealedManifest);

  let next = 0;
  let sent = 0;
  const worker = async () => {
    while (next < total) {
      const n = next++;
      await upload(started.pages[n]!, await seal(key, await slides[n]!.arrayBuffer()));
      onProgress?.({ stage: "sending", done: ++sent, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, total) }, worker));

  await api.post(`/api/issues/${started.id}/ready`);
  return { id: started.id, link: linkFor(started.id, text), expiresAt: started.expiresAt };
}

export function listSaved(): Promise<SavedList> {
  return api.get<SavedList>("/api/issues");
}

export function deleteSaved(id: string): Promise<unknown> {
  return api.delete(`/api/issues/${id}`);
}

async function fetchSealed(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("A page could not be fetched.");
  return response.arrayBuffer();
}

/** Opens a sealed manifest with its key. */
export async function openManifest(url: string, keyText: string): Promise<Manifest> {
  const key = await readKey(keyText);
  return JSON.parse(new TextDecoder().decode(await unseal(key, await fetchSealed(url)))) as Manifest;
}

/** Opens one sealed page as an object URL the caller revokes. */
export async function openPage(url: string, key: CryptoKey): Promise<string> {
  const bytes = await unseal(key, await fetchSealed(url));
  return URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
}

/**
 * Everything the reader needs from a link: the manifest, opened, and a way to
 * open each page when it is wanted rather than all ninety-six up front.
 */
export async function openIssue(id: string, keyText: string): Promise<{ files: SavedFiles; manifest: Manifest; key: CryptoKey }> {
  const files = await api.get<SavedFiles>(`/api/issues/${encodeURIComponent(id)}`);
  const key = await readKey(keyText);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(await unseal(key, await fetchSealed(files.manifest)))) as Manifest;
  } catch {
    throw new Error("This link's key does not open the magazine. Check that the whole link was copied.");
  }
  return { files, manifest, key };
}
