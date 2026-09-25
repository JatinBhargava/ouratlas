/**
 * Sealing a saved issue before it leaves the browser.
 *
 * Every file of an issue — the manifest and each page — is sealed with one
 * AES-256-GCM key made here for that issue alone. A sealed file is the
 * 12-byte nonce followed by the ciphertext; GCM's tag inside the ciphertext is
 * what makes a tampered or truncated file fail to open rather than open wrong.
 *
 * The key is written as unpadded base64url so it can sit in a link after the
 * `#`: that part of an address stays in the browser, so a shared link hands
 * the reader the key without ever handing it to the server.
 */

const NONCE = 12;

function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** A fresh key for one issue, and the same key written out for a link. */
export async function newKey(): Promise<{ key: CryptoKey; text: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return { key, text: toBase64url(raw) };
}

/** The key a link carries. Throws on anything that is not one. */
export async function readKey(text: string): Promise<CryptoKey> {
  const raw = fromBase64url(text);
  if (raw.length !== 32) throw new Error("That link is missing part of its key.");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
}

/** Seals `data` into a file ready to upload. */
export async function seal(key: CryptoKey, data: BufferSource): Promise<Blob> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data);
  return new Blob([nonce, sealed], { type: "application/octet-stream" });
}

/** Opens a sealed file. Throws when the key is wrong or the file was changed. */
export async function unseal(key: CryptoKey, sealed: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(sealed);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, NONCE) }, key, bytes.slice(NONCE));
}
