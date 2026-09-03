/**
 * The desk, parked across the sign-in redirect.
 *
 * Signing in with Google is a full-page navigation, so everything the reader
 * has built is torn down and rebuilt from nothing. Text could ride along in
 * session storage, but photographs could not: they are `File` handles, and a
 * File is not a string.
 *
 * IndexedDB stores structured clones, and a File is one — so the same File
 * comes back on the other side with its name and type intact, and a fresh
 * object URL is all that has to be made again. This is the only reason the
 * database exists.
 *
 * The record is deleted the moment it is read. These are somebody's holiday
 * photographs: they are on this device either way, and nothing here uploads
 * them, but they have no business outliving the one navigation they were
 * written for.
 */

import type { Focus } from "@/types";

const DB_NAME = "atlas";
const STORE = "draft";
const KEY = "desk";

/**
 * A synchronous hint that a draft is waiting.
 *
 * Reading IndexedDB is asynchronous, so without this the page would paint an
 * empty desk before the restore lands and then fill it in — a flash of "your
 * work is gone" at exactly the moment the reader is checking whether it is.
 * Session storage answers immediately and survives the redirect, which is all
 * this needs to do.
 */
const PARKED = "atlas:desk-parked";

/** What is worth carrying across. Plate sizes are not: they belong to an issue. */
export type DeskDraft = {
  title: string;
  story: string;
  polished: boolean;
  photos: { id: string; file: File; focus?: Focus }[];
};

/** True when `park` ran and `take` has not yet collected it. */
export function isParked(): boolean {
  try {
    return sessionStorage.getItem(PARKED) === "1";
  } catch {
    // Private windows and blocked site data throw rather than answering.
    return false;
  }
}

function mark(parked: boolean): void {
  try {
    if (parked) sessionStorage.setItem(PARKED, "1");
    else sessionStorage.removeItem(PARKED);
  } catch {
    // Without the hint the restore still works; it just paints an empty desk
    // for a frame first.
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Another tab holding an old version open. Nothing here can wait it out.
    request.onblocked = () => reject(new Error("indexeddb blocked"));
  });
}

/** Puts the desk away. Never throws: a failed park must not stop a sign-in. */
export async function park(draft: DeskDraft): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await open();
    const database = db;
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(draft, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    mark(true);
  } catch {
    // Storage blocked, full, or unavailable. Losing the draft is a poor
    // outcome, but refusing the sign-in the reader asked for is a worse one.
    mark(false);
  } finally {
    db?.close();
  }
}

/**
 * Collects the parked desk, once.
 *
 * The read below is destructive, and React mounts an effect twice in
 * development. Without sharing one result the first mount would swallow the
 * draft and the second would find an empty store — the photographs would
 * vanish exactly where they were supposed to come back. The shared handle is
 * released on the next tick, by which time both mounts have taken it, so a
 * later visit to the desk gets a fresh read and finds nothing.
 */
let inFlight: Promise<DeskDraft | null> | null = null;

export function take(): Promise<DeskDraft | null> {
  inFlight ??= read().finally(() => {
    setTimeout(() => {
      inFlight = null;
    }, 0);
  });
  return inFlight;
}

/** Reads and deletes in one transaction, so nothing can be restored twice. */
async function read(): Promise<DeskDraft | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await open();
    const database = db;
    const draft = await new Promise<unknown>((resolve, reject) => {
      const tx = database.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const read = store.get(KEY);
      store.delete(KEY);
      tx.oncomplete = () => resolve(read.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    mark(false);
    return valid(draft) ? draft : null;
  } catch {
    mark(false);
    return null;
  } finally {
    db?.close();
  }
}

/**
 * Checks the shape of what came back.
 *
 * The database outlives any one version of this code, so a record written by
 * an older build can turn up here. An unrecognisable one is treated as no
 * record at all rather than crashing the desk.
 */
function valid(value: unknown): value is DeskDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Partial<DeskDraft>;

  return (
    typeof draft.title === "string" &&
    typeof draft.story === "string" &&
    typeof draft.polished === "boolean" &&
    Array.isArray(draft.photos) &&
    draft.photos.every(photo => typeof photo?.id === "string" && photo.file instanceof File)
  );
}
