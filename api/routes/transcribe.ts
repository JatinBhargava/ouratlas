/**
 * Voice to text: the Speak tab's endpoints.
 *
 * Two ways in. A live recording (`/transcribe/session`, described first) and
 * an uploaded recording (`/transcribe/file`, at the bottom).
 *
 * The words appear in the copy while the reader is still talking, which needs
 * a live connection to OpenAI's Realtime transcription — audio streamed in,
 * text streamed back phrase by phrase. The browser holds that connection
 * itself; this route only hands it a key to open it with.
 *
 * The key is an ephemeral client secret minted per recording: it can open one
 * transcription session and nothing else, and expires within a minute if
 * unused. The real OPENAI_API_KEY never leaves the server. The audio itself
 * never passes through here at all, so there is nothing of it to log or keep.
 */

import express, { Router, type RequestHandler } from "express";

import { transcription } from "@api/env";
import { asyncRoute, HttpError, unconfigured } from "@api/http";
import { authenticate } from "@api/supabase";
import {
  TRANSCRIBE_PIECE_BYTES,
  TRANSCRIBE_SAMPLE_RATE,
  VOICE_NEEDS_SIGN_IN,
  type TranscribeResponse,
  type TranscribeSession,
} from "@/types";

export const transcribeRoutes = Router();

/** Long enough to connect over a slow phone network, short enough to be worthless if it leaks. */
const SECRET_TTL_SECONDS = 60;

/**
 * Sign-in, when voice asks for it (see `VOICE_NEEDS_SIGN_IN`); otherwise the
 * door is open and any visitor may record.
 */
const gate: RequestHandler = VOICE_NEEDS_SIGN_IN ? authenticate : (_req, _res, next) => next();

/**
 * How the session listens.
 *
 * Server-side voice detection closes a phrase at each pause, and a phrase is
 * what comes back as text — so the pause length is the lag between finishing a
 * sentence and seeing it. Half a second keeps up with speech without cutting a
 * sentence in two at every breath. `near_field` suits a laptop or phone mic
 * held close, which is how anyone tells a story into one.
 */
function sessionConfig() {
  return {
    type: "transcription",
    audio: {
      input: {
        format: { type: "audio/pcm", rate: TRANSCRIBE_SAMPLE_RATE },
        transcription: {
          model: transcription.model,
          ...(transcription.language ? { language: transcription.language } : {}),
        },
        noise_reduction: { type: "near_field" },
        turn_detection: { type: "server_vad", silence_duration_ms: 500, prefix_padding_ms: 300 },
      },
    },
  } as const;
}

/**
 * Turns an upstream failure into something the person speaking can act on,
 * in the same spirit as the copy desk's `explain`: whoever runs the server
 * gets the real reason in the log, the reader gets whether to wait or retry.
 */
function explain(status: number, detail?: string): HttpError {
  if (status === 401 || status === 403) return new HttpError(502, "Transcription rejected this server's API key.");
  if (/model/i.test(detail ?? "") && (status === 400 || status === 404)) {
    return new HttpError(502, "This server names a transcription model its key cannot reach. Check OPENAI_TRANSCRIBE_MODEL.");
  }
  if (status === 429 && /quota|billing/i.test(detail ?? "")) {
    return new HttpError(503, "Transcription is unavailable right now. Your copy is untouched — you can still type.");
  }
  if (status === 429) return new HttpError(429, "Transcription is busy right now. Try again in a moment.");
  return new HttpError(502, "Transcription could not be reached.");
}

transcribeRoutes.post(
  "/transcribe/session",
  // Every session costs money. For now it is open to anyone, signed in or
  // not; the plan never matters.
  gate,
  asyncRoute(async (_req, res) => {
    if (!transcription.key) throw unconfigured("Voice transcription is", "OPENAI_API_KEY");

    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: { authorization: `Bearer ${transcription.key}`, "content-type": "application/json" },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: SECRET_TTL_SECONDS },
        session: sessionConfig(),
      }),
    }).catch(() => {
      throw new HttpError(502, "Transcription could not be reached.");
    });

    if (!response.ok) {
      // The provider's message describes the request, never the key.
      const detail = await response
        .json()
        .then((body: any) => body?.error?.message as string | undefined)
        .catch(() => undefined);
      console.error(`[transcribe] openai ${response.status}: ${detail ?? "no detail"}`);
      throw explain(response.status, detail);
    }

    const body = (await response.json()) as { value?: unknown; expires_at?: unknown };
    if (typeof body.value !== "string") throw new HttpError(502, "Transcription could not be reached.");

    res.setHeader("cache-control", "no-store");
    res.json({
      secret: body.value,
      expiresAt: typeof body.expires_at === "number" ? body.expires_at : 0,
    } satisfies TranscribeSession);
  }),
);

/**
 * An uploaded recording, a piece at a time.
 *
 * The browser decodes the file, cuts it into two-minute WAV pieces at quiet
 * moments, and posts them here in order. The pieces are what keep every limit
 * on the way out of reach: Vercel's proxy and nginx both cap request bodies in
 * single megabytes, OpenAI takes 25 MB and (for this model) 25 minutes per
 * file, and a half-hour voice memo is past all of them in one piece.
 *
 * The audio is held in memory for the length of the request and never written
 * down. Neither is the text.
 */
const parsePiece = express.raw({ type: ["audio/wav", "audio/x-wav", "audio/wave"], limit: TRANSCRIBE_PIECE_BYTES });

/** body-parser's own failures are not `HttpError`s and would otherwise surface as a generic 500. */
const readPiece: RequestHandler = (req, res, next) => {
  parsePiece(req, res, error => {
    if (!error) return next();
    if ((error as { status?: number }).status === 413) return next(new HttpError(413, "That piece of audio is too large."));
    next(new HttpError(400, "That audio could not be read."));
  });
};

/**
 * The last words of the piece before, sent so the model carries a sentence
 * across the cut instead of starting it again with a capital letter. In a
 * header rather than the address: addresses end up in access logs, and this
 * is someone's story.
 */
function contextOf(header: string | string[] | undefined): string | null {
  if (typeof header !== "string" || !header) return null;
  try {
    return decodeURIComponent(header).slice(-400) || null;
  } catch {
    return null;
  }
}

transcribeRoutes.post(
  "/transcribe/file",
  gate,
  readPiece,
  asyncRoute(async (req, res) => {
    if (!transcription.key) throw unconfigured("Voice transcription is", "OPENAI_API_KEY");

    const audio = req.body as unknown;
    if (!Buffer.isBuffer(audio) || audio.length === 0) throw new HttpError(400, "No audio came through.");

    const form = new FormData();
    // Copied into a plain Uint8Array: Node types a Buffer as possibly backed by
    // shared memory, which Blob will not accept.
    form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "piece.wav");
    form.append("model", transcription.model);
    form.append("response_format", "json");
    if (transcription.language) form.append("language", transcription.language);
    const context = contextOf(req.headers["x-transcribe-context"]);
    if (context) form.append("prompt", context);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${transcription.key}` },
      body: form,
    }).catch(() => {
      throw new HttpError(502, "Transcription could not be reached.");
    });

    if (!response.ok) {
      const detail = await response
        .json()
        .then((body: any) => body?.error?.message as string | undefined)
        .catch(() => undefined);
      console.error(`[transcribe] openai ${response.status}: ${detail ?? "no detail"}`);
      throw status400(response.status, detail) ?? explain(response.status, detail);
    }

    const body = (await response.json()) as { text?: unknown };
    res.setHeader("cache-control", "no-store");
    res.json({ text: typeof body.text === "string" ? body.text.trim() : "" } satisfies TranscribeResponse);
  }),
);

/** A 400 on a file is almost always the file, which `explain` would misreport as unreachable. */
function status400(status: number, detail?: string): HttpError | null {
  if (status !== 400 || /model/i.test(detail ?? "")) return null;
  return new HttpError(400, "OpenAI could not read part of that recording.");
}
