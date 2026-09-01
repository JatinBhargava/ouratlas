/**
 * Copy-editing pass over the story.
 *
 * This is the one feature that sends anything off the machine, so it is opt-in
 * in the UI and deliberately narrow here: the text goes to Anthropic, the
 * edited text comes back, and nothing is written down on the way through — no
 * logging, no database, no file. Photographs are never sent.
 *
 * The API key lives on the server and is never handed to the browser.
 */

const MODEL = "claude-sonnet-5";

/** Longest story we will accept, well above the 10,000-word editor cap. */
const MAX_CHARS = 80_000;

/**
 * Words per request. The whole story in one call risks running past the output
 * limit and truncating someone's trip, so it goes over in passes.
 */
const CHUNK_WORDS = 1_200;

const SYSTEM = [
  "You are a copy editor for a travel magazine, working on a first-person account of a trip.",
  "Improve rhythm, clarity and word choice. Fix grammar, spelling and punctuation.",
  "Preserve the author's voice, and every place, person, number and fact exactly as given. Invent nothing.",
  "Keep the same paragraph structure: return exactly as many paragraphs as you were given, separated by blank lines.",
  "Return only the edited prose — no title, preamble, notes, quotation marks or markdown.",
].join(" ");

/**
 * One request's worth of text, and what to put in front of it when the edited
 * pieces are joined back together.
 */
type Pass = { text: string; separator: string };

/** Sentence ends, keeping any closing quote or bracket with the sentence. */
const SENTENCE = /(?<=[.!?]["'\u2019\u201d)\]]?)\s+/;

/** Groups items into runs of at most `limit` words. */
function group(pieces: string[], limit: number, join: string): string[] {
  const runs: string[] = [];
  let current: string[] = [];
  let words = 0;

  for (const piece of pieces) {
    const length = piece.split(/\s+/).length;
    if (current.length > 0 && words + length > limit) {
      runs.push(current.join(join));
      current = [];
      words = 0;
    }
    current.push(piece);
    words += length;
  }
  if (current.length > 0) runs.push(current.join(join));
  return runs;
}

/**
 * Splits the story into requests small enough that the reply cannot run past
 * the output limit.
 *
 * Paragraphs are the natural seam. A paragraph too long to send on its own —
 * a story pasted in as one unbroken block, which is what dictation gives you —
 * is split again at sentence ends and rejoined with spaces, so the paragraph
 * survives the round trip as one paragraph.
 */
export function toPasses(story: string): Pass[] {
  const paragraphs = story
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean);

  const passes: Pass[] = [];
  let pending: string[] = [];
  let pendingWords = 0;

  const flush = () => {
    if (pending.length === 0) return;
    passes.push({ text: pending.join("\n\n"), separator: passes.length === 0 ? "" : "\n\n" });
    pending = [];
    pendingWords = 0;
  };

  for (const paragraph of paragraphs) {
    const length = paragraph.split(/\s+/).length;

    if (length > CHUNK_WORDS) {
      flush();
      // A "sentence" longer than a whole pass means text with no punctuation
      // at all; fall back to splitting on words so nothing can be truncated.
      const sentences = paragraph.split(SENTENCE).filter(Boolean);
      const pieces = sentences.flatMap(sentence =>
        sentence.split(/\s+/).length > CHUNK_WORDS ? group(sentence.split(/\s+/), CHUNK_WORDS, " ") : [sentence],
      );
      const parts = group(pieces, CHUNK_WORDS, " ");
      parts.forEach((part, index) => {
        // Only the first part starts a new paragraph; the rest continue it.
        passes.push({ text: part, separator: passes.length === 0 ? "" : index === 0 ? "\n\n" : " " });
      });
      continue;
    }

    if (pending.length > 0 && pendingWords + length > CHUNK_WORDS) flush();
    pending.push(paragraph);
    pendingWords += length;
  }
  flush();

  return passes;
}

/**
 * Turns an upstream failure into something the person writing can read.
 *
 * Two audiences share this endpoint. Whoever runs the server needs the real
 * reason, and gets it in the log. Whoever is writing up their trip needs to
 * know only whether to wait, retry, or carry on — telling them about a credit
 * balance they cannot top up is noise, so those are kept back.
 */
export function explain(status: number, detail?: string): string {
  if (status === 401 || status === 403) return "The copy desk rejected this server's API key.";
  if (status === 429) return "The copy desk is busy right now. Try again in a moment.";

  if (detail?.includes("anthropic-workspace-id")) {
    return "This API key belongs to a workspace. Set ANTHROPIC_WORKSPACE_ID on the server and restart.";
  }
  if (/credit balance|billing|quota/i.test(detail ?? "")) {
    return "The copy desk is unavailable right now. Your writing is untouched — carry on and send to press whenever you like.";
  }

  return detail ? `The copy desk failed (${status}): ${detail}` : `The copy desk failed (${status}).`;
}

/** An upstream failure, carrying the status so the route can mirror it. */
class UpstreamError extends Error {
  constructor(
    readonly status: number,
    detail?: string,
  ) {
    super(explain(status, detail));
    this.name = "UpstreamError";
  }
}

/** Streams one pass, forwarding just the text deltas. */
async function* editPass(text: string, key: string): AsyncGenerator<string> {
  // Identity-linked keys must name the workspace the request acts in. Ordinary
  // keys do not, and reject the header, so only send it when it is configured.
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      ...(workspace ? { "anthropic-workspace-id": workspace } : {}),
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8_000,
      stream: true,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!response.ok || !response.body) {
    // The body carries Anthropic's own message; it describes the request, not
    // the story, and never contains the key.
    const detail = await response
      .json()
      .then((body: any) => body?.error?.message as string | undefined)
      .catch(() => undefined);
    if (detail) console.error(`[polish] Anthropic ${response.status}: ${detail}`);
    throw new UpstreamError(response.status, detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Server-sent events arrive line by line; the tail may be a partial line.
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const event = JSON.parse(payload);
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        yield event.delta.text as string;
      }
      if (event.type === "error") throw new Error(event.error?.message ?? "stream error");
    }
  }
}

export async function polish(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "Polishing is switched off: this server has no ANTHROPIC_API_KEY set." },
      { status: 503 },
    );
  }

  let story: unknown;
  try {
    ({ story } = (await request.json()) as { story?: unknown });
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (typeof story !== "string" || story.trim().length === 0) {
    return Response.json({ error: "Nothing to edit." }, { status: 400 });
  }
  if (story.length > MAX_CHARS) {
    return Response.json({ error: "That story is too long to edit in one go." }, { status: 413 });
  }

  const passes = toPasses(story);
  const encoder = new TextEncoder();

  // Run the first pass far enough to know it works. A bad key or a rate limit
  // discovered after the response has started can only break the stream; found
  // here it is still an ordinary error with a status and a readable message.
  const opening = editPass(passes[0]!.text, key);
  let head: IteratorResult<string>;
  try {
    head = await opening.next();
  } catch (error) {
    const upstream = error instanceof UpstreamError;
    return Response.json(
      { error: upstream ? error.message : "The copy desk could not be reached." },
      { status: upstream ? (error as UpstreamError).status === 429 ? 429 : 502 : 502 },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!head.done) controller.enqueue(encoder.encode(head.value));
        for await (const delta of opening) controller.enqueue(encoder.encode(delta));

        for (const pass of passes.slice(1)) {
          controller.enqueue(encoder.encode(pass.separator));
          for await (const delta of editPass(pass.text, key)) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        controller.close();
      } catch (error) {
        // The response has already begun, so the only signal left is to break
        // the stream; the client treats a broken read as a failed edit.
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
