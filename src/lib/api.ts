/**
 * Thin typed wrapper around fetch for talking to the Express API in `api/`.
 *
 * Every request carries the Supabase access token when there is one, so a
 * route behind `authenticate` works without each caller remembering to attach
 * it. Routes that do not need a session simply ignore the header.
 */

import { accessToken } from "@/lib/supabase";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * The server's own words for a failure.
 *
 * Every route answers with `{ error }`, and those messages are written to be
 * read by the person using the site, so they are preferred over anything
 * invented here. The status line is the fallback for a failure that never
 * reached the app — a proxy timing out, say.
 */
async function toError(response: Response, method: string, path: string): Promise<HttpError> {
  const message = await response
    .json()
    .then((body: unknown) => (body as { error?: unknown } | null)?.error)
    .catch(() => undefined);

  return new HttpError(
    response.status,
    typeof message === "string" && message.length > 0
      ? message
      : `${method} ${path} failed with ${response.status}`,
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await accessToken();
  const method = init?.method ?? "GET";

  const res = await fetch(new URL(path, location.href), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) throw await toError(res, method, path);

  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
