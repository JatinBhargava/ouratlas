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
import { publicUrl } from "@/lib/site";
import { newKey, readKey, seal, unseal } from "@/lib/vault";
import type {
  CodeRequest,
  EditableFiles,
  EditCommit,
  EditRequest,
  EditResponse,
  InviteRequest,
  JoinRequest,
  JoinResponse,
  Keep,
  MemberRole,
  MembersResponse,
  SavedFiles,
  SavedList,
  SaveRequest,
  SaveResponse,
  UploadSlot,
} from "@/types";

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
  /** Where an editable issue reopens: the desk, or a Studio layout (`use` is its page or section). */
  source?: EditableOrigin;
};

/** Which editor made an editable issue, and so which one reopens it. */
export type EditableOrigin = { kind: "desk" } | { kind: "studio"; use: string };

/**
 * An editor's work, as it is handed over to be kept editable: its state,
 * which must survive JSON, and its photographs, which are sealed as files of
 * their own and handed back in the same order, with the same ids.
 */
export type EditableCopy<State = unknown> = {
  origin: EditableOrigin;
  state: State;
  photos: { id: string; file: File }[];
};

/** What is sealed as the editable copy's `source` file. */
type SealedSource = { v: 1; origin: EditableOrigin; state: unknown; photos: { id: string; name: string; type: string }[] };

/**
 * The address that opens a saved issue: its id in the query, its key after the
 * `#`. Public rather than the page's own origin, so a link saved in the app is
 * not a `localhost` address only that phone can open.
 */
export function linkFor(id: string, key: string): string {
  return publicUrl(`/read?i=${id}#${key}`);
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

/** The bucket's own ceiling for one file, less room for the seal. */
const PHOTO_CEILING = 1.9 * 1024 * 1024;

/**
 * A photograph made small enough to keep: the longest side at most 2,400 px,
 * as a JPEG, stepping the quality down until it fits under the bucket's limit
 * for one file. Plenty for a page that is printed at magazine size; the
 * original never leaves the device.
 */
async function shrink(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= PHOTO_CEILING) return file;
    throw new Error(`${file.name} could not be made small enough to keep editable.`);
  }
  try {
    for (const [side, quality] of [[2400, 0.88], [2400, 0.78], [2000, 0.75], [1600, 0.7]] as const) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      canvas.width = canvas.height = 0;
      if (blob && blob.size <= PHOTO_CEILING) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`${file.name} could not be made small enough to keep editable.`);
}

/** Seals an editable copy: its state as one file, then each photograph as its own. */
async function sealCopy(key: CryptoKey, copy: EditableCopy): Promise<{ source: Blob; photos: Blob[] }> {
  const sealedSource: SealedSource = {
    v: 1,
    origin: copy.origin,
    state: copy.state,
    photos: copy.photos.map(photo => ({ id: photo.id, name: photo.file.name, type: "image/jpeg" })),
  };
  const source = await seal(key, new TextEncoder().encode(JSON.stringify(sealedSource)));
  const photos: Blob[] = [];
  for (const photo of copy.photos) photos.push(await seal(key, await (await shrink(photo.file)).arrayBuffer()));
  return { source, photos };
}

/** Uploads files to their slots, a few at a time, counting each one sent. */
async function uploadAll(work: { slot: UploadSlot; file: () => Promise<Blob> }[], onSent: () => void): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < work.length) {
      const item = work[next++]!;
      await upload(item.slot, await item.file());
      onSent();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, work.length) }, worker));
}

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
  options: { keep: Keep; keepInLibrary: boolean; editable?: EditableCopy },
  onProgress?: (progress: SaveProgress) => void,
): Promise<{ id: string; link: string; expiresAt: string | null }> {
  const total = leaves.length;
  const slides = await pressSlides(leaves, manifest.title, done => onProgress?.({ stage: "drawing", done, total }));
  const { key, text } = await newKey();
  const copy = options.editable;
  // Everyone who edits an issue opens it from their own My magazines.
  const keepKey = options.keepInLibrary || Boolean(copy);

  const request: SaveRequest = {
    pages: total,
    keep: options.keep,
    ...(keepKey ? { key: text } : {}),
    ...(copy ? { editable: { photos: copy.photos.length } } : {}),
  };
  const started = await api.post<SaveResponse>("/api/issues", request);

  const sealedManifest = await seal(
    key,
    new TextEncoder().encode(
      JSON.stringify({ ...manifest, v: 1, pages: total, savedAt: new Date().toISOString(), ...(copy ? { source: copy.origin } : {}) } satisfies Manifest),
    ),
  );
  const sealedCopy = copy ? await sealCopy(key, copy) : null;
  const work = [
    { slot: started.manifest, file: async () => sealedManifest },
    ...slides.map((slide, n) => ({ slot: started.pages[n]!, file: async () => seal(key, await slide.arrayBuffer()) })),
    ...(sealedCopy && started.source && started.photos
      ? [{ slot: started.source, file: async () => sealedCopy.source }, ...sealedCopy.photos.map((photo, n) => ({ slot: started.photos![n]!, file: async () => photo }))]
      : []),
  ];
  let sent = 0;
  await uploadAll(work, () => onProgress?.({ stage: "sending", done: Math.min(total, ++sent), total }));

  await api.post(`/api/issues/${started.id}/ready`);
  return { id: started.id, link: linkFor(started.id, text), expiresAt: started.expiresAt };
}

/** An editable issue, opened to be changed: its key, the version it is at, and the editor's work as it was saved. */
export type OpenedCopy<State = unknown> = {
  id: string;
  keyText: string;
  version: number;
  origin: EditableOrigin;
  state: State;
  photos: { id: string; file: File }[];
};

/** Opens an editable issue's copy, for its owner or someone it is shared with to edit. */
export async function openEditable<State = unknown>(id: string): Promise<OpenedCopy<State>> {
  const files = await api.get<EditableFiles>(`/api/issues/${encodeURIComponent(id)}/source`);
  const key = await readKey(files.key);
  const source = JSON.parse(new TextDecoder().decode(await unseal(key, await fetchSealed(files.source)))) as SealedSource;
  const photos = await Promise.all(
    source.photos.map(async (photo, n) => ({
      id: photo.id,
      file: new File([await unseal(key, await fetchSealed(files.photos[n]!))], photo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: photo.type }),
    })),
  );
  return { id: files.id, keyText: files.key, version: files.version, origin: source.origin, state: source.state as State, photos };
}

/** Where saving changes stands: which issue, sealed with which key, from which version. */
export type Editing = { id: string; keyText: string; version: number };

/**
 * Saves changes to an editable issue: new pages and a new copy, sealed with
 * the issue's own key, swapped in for the old at the same link. Refused (with
 * the server's reason) when someone else has saved since `editing.version`.
 */
export async function saveChanges(
  editing: Editing,
  leaves: HTMLElement[],
  manifest: Omit<Manifest, "v" | "pages" | "savedAt">,
  copy: EditableCopy,
  onProgress?: (progress: SaveProgress) => void,
): Promise<{ id: string; link: string; version: number }> {
  const total = leaves.length;
  const slides = await pressSlides(leaves, manifest.title, done => onProgress?.({ stage: "drawing", done, total }));
  const key = await readKey(editing.keyText, "seal");

  const request: EditRequest = { base: editing.version, pages: total, photos: copy.photos.length };
  const started = await api.post<EditResponse>(`/api/issues/${editing.id}/edits`, request);
  const sealedManifest = await seal(
    key,
    new TextEncoder().encode(JSON.stringify({ ...manifest, v: 1, pages: total, savedAt: new Date().toISOString(), source: copy.origin } satisfies Manifest)),
  );
  const sealedCopy = await sealCopy(key, copy);
  let sent = 0;
  await uploadAll(
    [
      { slot: started.manifest, file: async () => sealedManifest },
      ...slides.map((slide, n) => ({ slot: started.pages[n]!, file: async () => seal(key, await slide.arrayBuffer()) })),
      { slot: started.source, file: async () => sealedCopy.source },
      ...sealedCopy.photos.map((photo, n) => ({ slot: started.photos[n]!, file: async () => photo })),
    ],
    () => onProgress?.({ stage: "sending", done: Math.min(total, ++sent), total }),
  );

  const commit: EditCommit = { base: editing.version, folder: started.folder, pages: total, photos: copy.photos.length };
  const done = await api.post<{ version: number }>(`/api/issues/${editing.id}/edits/commit`, commit);
  return { id: editing.id, link: linkFor(editing.id, editing.keyText), version: done.version };
}

/* Sharing: by address and by group code. The owner's, except joining and leaving. */

export const getMembers = (id: string) => api.get<MembersResponse>(`/api/issues/${id}/members`);
export const invite = (id: string, email: string, role: MemberRole) =>
  api.post<MembersResponse>(`/api/issues/${id}/members`, { email, role } satisfies InviteRequest);
export const removeMember = (id: string, email: string) => api.delete<MembersResponse>(`/api/issues/${id}/members/${encodeURIComponent(email)}`);
export const setCode = (id: string, password: string, role: MemberRole) =>
  api.put<MembersResponse>(`/api/issues/${id}/code`, { password, role } satisfies CodeRequest);
export const clearCode = (id: string) => api.delete<MembersResponse>(`/api/issues/${id}/code`);
/** Joins one magazine with its code; `id` holds the code to that magazine when the reader is on its page. */
export const joinWithCode = (code: string, password: string, id?: string) =>
  api.post<JoinResponse>("/api/issues/join", { code, password, ...(id ? { id } : {}) } satisfies JoinRequest);
export const leaveIssue = (id: string) => api.delete(`/api/issues/${id}/membership`);

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

/** Opens one sealed page as the JPEG it was before it was sealed. */
export async function openPageBlob(url: string, key: CryptoKey): Promise<Blob> {
  return new Blob([await unseal(key, await fetchSealed(url))], { type: "image/jpeg" });
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
