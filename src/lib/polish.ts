/**
 * Client side of the copy desk. Streams the reply back a piece at a time so a
 * long trip does not sit behind a spinner for a minute.
 *
 * `api.post` is no use here — it reads the whole body as JSON, which is the
 * one thing this must not do — so the token `api.ts` normally attaches is
 * attached by hand. Without it the route answers 401.
 */

import { accessToken } from "@/lib/supabase";

/** The two things the copy desk can be asked for; the server names them too. */
export type PolishMode = "edit" | "story";

export async function* streamPolish(
  story: string,
  mode: PolishMode = "edit",
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const token = await accessToken();

  const response = await fetch("/api/polish", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ story, mode }),
    signal,
  });

  if (!response.ok || !response.body) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.error ?? `The copy desk is unavailable (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}
