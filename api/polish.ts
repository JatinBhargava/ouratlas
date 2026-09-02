/**
 * The copy desk: a model pass over the story.
 *
 * Two jobs share this module, and the person writing picks which one. "edit"
 * is a copy-editor's pass — the same words, tidied. "story" hands the notes to
 * a travel writer and gets a piece of short fiction back. They differ only in
 * the system prompt and in how the story is cut up on the way out; everything
 * from the request onward is shared.
 *
 * This is the one feature that sends anything off the machine, so it is opt-in
 * in the UI and deliberately narrow here: the text goes to a model, the reply
 * comes back, and nothing is written down on the way through — no logging, no
 * database, no file. Photographs are never sent.
 *
 * Either OpenAI or Anthropic can do the work; `api/env.ts` decides which from
 * the keys present. They differ only in the shape of the request and of one
 * field in the stream, so everything else below is shared.
 *
 * The API key lives on the server and is never handed to the browser.
 *
 * This module is the engine; `routes/polish.ts` is the endpoint.
 */

import { polish, polishProvider, type PolishProviderName } from "@api/env";

/** Longest story we will accept, well above the 10,000-word editor cap. */
export const MAX_CHARS = 80_000;

/**
 * Words per request. The whole story in one call risks running past the output
 * limit and truncating someone's trip, so it goes over in passes.
 */
const CHUNK_WORDS = 1_200;

/**
 * What the copy desk can be asked to do.
 *
 * "edit" is the original pass and stays the default, so a request that names
 * no mode behaves exactly as it did before.
 */
export type PolishMode = "edit" | "story";

export const MODES: readonly PolishMode[] = ["edit", "story"] as const;

/** Whether a value off the wire names a mode. */
export function isMode(value: unknown): value is PolishMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Tidy the writing, keep the writer. */
const EDIT = [
  "You are a copy editor for a travel magazine, working on a first-person account of a trip.",
  "Improve rhythm, clarity and word choice. Fix grammar, spelling and punctuation.",
  "Preserve the author's voice, and every place, person, number and fact exactly as given. Invent nothing.",
  "Keep the same paragraph structure: return exactly as many paragraphs as you were given, separated by blank lines.",
  "Return only the edited prose — no title, preamble, notes, quotation marks or markdown.",
].join(" ");

/**
 * Turn the trip into short fiction.
 *
 * Written to work from photographs. Only the text is ever sent, so in practice
 * the model is working from whatever the notes describe — the prompt's talk of
 * photographs sets the register rather than pointing at real attachments.
 */
const STORY = [
  "You are a travel storyteller and fiction writer creating a short, cinematic travel story inspired by the provided photographs.",
  "Use the photographs as the primary source of visual inspiration. Pay attention to landscapes, villages, architecture, roads, beaches, people, vegetation, weather, colors, light and local life. Do not simply describe each photograph. Instead, use these visual elements to build one connected story.",
  "Imagine that the photographs are different moments from the same journey. Create a fictional narrative that naturally connects them into a single experience rather than treating them as separate image descriptions.",
  "Create fictional characters, dialogue, events, relationships, motivations and emotional arcs when needed. The story can go beyond what is literally visible in the photographs. The photographs provide the setting, atmosphere and visual inspiration; the narrative itself can be fictional.",
  "Give the story a clear beginning, middle and ending. Introduce a central character with a small but meaningful emotional journey, discovery or realization. Let the character interact with the places rather than simply observing them.",
  "Make the locations feel lived-in. Include small human moments, conversations, unexpected encounters, local details and sensory experiences where appropriate. Avoid making the story feel like a travel guide, tourism advertisement or collection of image captions.",
  "Use vivid, natural and immersive descriptions. The writing should feel like a high-quality travel magazine story: intimate, atmospheric, human and cinematic, but not overly poetic, dramatic or sentimental.",
  "Prefer showing emotions through actions, dialogue, surroundings and small observations rather than explicitly explaining what the character feels.",
  "Create subtle connections between the beginning and ending. Introduce a meaningful object, phrase, idea, place or visual motif early in the story and bring it back near the end in a different or more meaningful context. The ending should feel memorable, satisfying and slightly poetic, creating a sense that the journey has come full circle.",
  "Do not invent specific factual claims about real locations, history, culture or geography unless they are provided by the user or clearly visible in the photographs. Fictional characters, conversations, personal experiences and story events are allowed.",
  "Do not identify or assume an exact location from the photographs unless the location is explicitly provided by the user.",
].join("\n\n");

const SYSTEM: Record<PolishMode, string> = { edit: EDIT, story: STORY };

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
 *
 * Only the editing pass is cut up. Splitting works there because each piece
 * comes back edited in place, but a storyteller given a third of a trip writes
 * a whole story about that third — three passes would return three stories
 * stapled together. So "story" goes over in one request, which it can afford:
 * a short story is short however long the notes were, so the output limit that
 * forces the chunking is not in play.
 */
export function toPasses(story: string, mode: PolishMode = "edit"): Pass[] {
  if (mode === "story") return [{ text: story.trim(), separator: "" }];

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
  if (status === 404 && /model/i.test(detail ?? "")) {
    return "This server is configured for a model its API key cannot reach. Check OPENAI_MODEL.";
  }
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
export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    detail?: string,
  ) {
    super(explain(status, detail));
    this.name = "UpstreamError";
  }
}

/** How one provider is asked, and where its text sits in the stream. */
type Provider = {
  name: PolishProviderName;
  send(text: string, system: string): Promise<Response>;
  /** The text carried by one parsed SSE event, or null if it carries none. */
  textOf(event: any): string | null;
};

const OPENAI: Provider = {
  name: "openai",

  send: (text, system) =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${polish.openai.key}`,
      },
      body: JSON.stringify({
        model: polish.openai.model,
        stream: true,
        // No output cap on purpose. Newer models renamed `max_tokens` to
        // `max_completion_tokens` and reject the old spelling, and the default
        // limit is far above a 1,200-word pass anyway — so asking for one would
        // buy a compatibility problem and nothing else.
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    }),

  textOf: event => event?.choices?.[0]?.delta?.content ?? null,
};

const ANTHROPIC: Provider = {
  name: "anthropic",

  send: (text, system) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": polish.anthropic.key!,
        "anthropic-version": "2023-06-01",
        // Identity-linked keys must name the workspace the request acts in.
        // Ordinary keys reject the header, so it is only sent when configured.
        ...(polish.anthropic.workspace ? { "anthropic-workspace-id": polish.anthropic.workspace } : {}),
      },
      body: JSON.stringify({
        model: polish.anthropic.model,
        max_tokens: 8_000,
        stream: true,
        system,
        messages: [{ role: "user", content: text }],
      }),
    }),

  textOf: event =>
    event?.type === "content_block_delta" && event.delta?.type === "text_delta" ? event.delta.text : null,
};

/** The provider this server will use, or null when the copy desk is off. */
export function activeProvider(): Provider | null {
  const chosen = polishProvider();
  if (chosen === "openai") return OPENAI;
  if (chosen === "anthropic") return ANTHROPIC;
  return null;
}

/**
 * Streams one pass, forwarding just the text deltas.
 *
 * Both providers speak server-sent events and both report failures as
 * `{ error: { message } }`, so the only thing that differs once the response
 * arrives is which field holds the text — `textOf` above.
 */
export async function* editPass(text: string, provider: Provider, mode: PolishMode = "edit"): AsyncGenerator<string> {
  const response = await provider.send(text, SYSTEM[mode]);

  if (!response.ok || !response.body) {
    // The body carries the provider's own message; it describes the request,
    // not the story, and never contains the key.
    const detail = await response
      .json()
      .then((body: any) => body?.error?.message as string | undefined)
      .catch(() => undefined);
    if (detail) console.error(`[polish] ${provider.name} ${response.status}: ${detail}`);
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
      if (event?.error) throw new Error(event.error?.message ?? "stream error");

      const piece = provider.textOf(event);
      if (piece) yield piece;
    }
  }
}
