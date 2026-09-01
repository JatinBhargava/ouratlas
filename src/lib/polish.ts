/**
 * Client side of the copy desk. Streams the edited story back a piece at a
 * time so a long trip does not sit behind a spinner for a minute.
 */
export async function* streamPolish(story: string, signal?: AbortSignal): AsyncGenerator<string> {
  const response = await fetch("/api/polish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ story }),
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
