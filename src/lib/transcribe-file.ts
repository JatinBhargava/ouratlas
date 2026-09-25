/**
 * Transcribing an uploaded recording — a voice memo, a clip from a camera.
 *
 * The file is decoded here, in the browser, and cut into pieces small enough
 * for every hop between here and OpenAI (see `/api/transcribe/file`). The
 * pieces go up one after another and their text comes back in order, so the
 * words start appearing in the copy long before a long file is finished.
 *
 * Cutting at a fixed length would split words, so each cut is moved back to
 * the quietest moment in the seconds before it — usually a breath between
 * sentences. The last words of each piece travel with the next as context,
 * which carries a sentence across the cut that does land mid-thought.
 */

import { accessToken } from "@/lib/supabase";
import type { TranscribeResponse } from "@/types";

/** Plenty for speech, and a third of the bytes of the 48 kHz the file probably holds. */
const RATE = 16_000;

/** Target length of a piece: 3.84 MB as 16-bit WAV, inside every limit on the way. */
const PIECE_SECONDS = 120;

/** How far back from the target a cut may move to find a quiet moment. */
const SEARCH_SECONDS = 20;

/** The window measured for quiet: long enough to be a pause, not a consonant. */
const QUIET_WINDOW = 0.25;

/** Longer than any story's worth of talking; decoding it all at once costs memory. */
export const MAX_SECONDS = 60 * 60;
export const MAX_BYTES = 200 * 1024 * 1024;

/** Recordings the picker offers. Anything the browser can decode will work. */
export const ACCEPT = "audio/*,video/mp4,video/webm,.m4a,.mp3,.wav,.ogg,.oga,.opus,.webm,.aac,.flac,.mp4";

export type FileProgress = {
  /** Everything transcribed so far, in order. */
  text: string;
  done: number;
  total: number;
};

/** Mixes down to one channel. Decoding already resampled to RATE. */
function mono(audio: AudioBuffer): Float32Array {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);

  const out = new Float32Array(audio.length);
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const data = audio.getChannelData(channel);
    for (let i = 0; i < data.length; i++) out[i]! += data[i]! / audio.numberOfChannels;
  }
  return out;
}

/** Where to cut, in samples: the quietest window in the search range before each target. */
function cuts(samples: Float32Array): number[] {
  const piece = PIECE_SECONDS * RATE;
  const search = SEARCH_SECONDS * RATE;
  const window = Math.round(QUIET_WINDOW * RATE);
  const step = Math.round(window / 5);

  const points = [0];
  let from = 0;
  while (samples.length - from > piece) {
    const target = from + piece;
    let best = target;
    let quietest = Infinity;

    for (let start = target - search; start + window <= target; start += step) {
      let energy = 0;
      for (let i = start; i < start + window; i++) energy += samples[i]! * samples[i]!;
      if (energy < quietest) {
        quietest = energy;
        best = start + Math.round(window / 2);
      }
    }

    points.push(best);
    from = best;
  }
  points.push(samples.length);
  return points;
}

/** 16-bit PCM WAV. */
function wav(samples: Float32Array): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => header.setUint8(offset + i, char.charCodeAt(0)));
  const bytes = samples.length * 2;

  text(0, "RIFF");
  header.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, RATE, true);
  header.setUint32(28, RATE * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  text(36, "data");
  header.setUint32(40, bytes, true);

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Blob([header.buffer, pcm.buffer], { type: "audio/wav" });
}

async function sendPiece(piece: Blob, context: string, signal?: AbortSignal): Promise<string> {
  const token = await accessToken();
  const response = await fetch("/api/transcribe/file", {
    method: "POST",
    headers: {
      "content-type": "audio/wav",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(context ? { "x-transcribe-context": encodeURIComponent(context.slice(-400)) } : {}),
    },
    body: piece,
    signal,
  });

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new Error(problem?.error ?? `Transcription is unavailable (${response.status}).`);
  }
  return ((await response.json()) as TranscribeResponse).text;
}

/**
 * Decodes the file and transcribes it piece by piece, yielding the whole text
 * so far after each piece. Throws a readable message for a file that is too
 * big, too long, or not audio this browser can read.
 */
export async function* transcribeFile(file: File, signal?: AbortSignal): AsyncGenerator<FileProgress> {
  if (file.size > MAX_BYTES) throw new Error("That file is over 200 MB. Trim it to the part worth keeping and try again.");

  let audio: AudioBuffer;
  try {
    // An offline context at the target rate makes the decoder resample as it
    // goes, so the full-rate audio never has to sit in memory as floats.
    const context = new OfflineAudioContext(1, 1, RATE);
    audio = await context.decodeAudioData(await file.arrayBuffer());
  } catch {
    throw new Error("That file couldn't be read as audio. Voice memos, MP3, M4A, WAV and WebM all work.");
  }
  if (audio.duration > MAX_SECONDS) throw new Error("That recording is over an hour. Trim it and try again.");

  const samples = mono(audio);
  const points = cuts(samples);
  const total = points.length - 1;
  let text = "";

  for (let i = 0; i < total; i++) {
    signal?.throwIfAborted();
    const piece = samples.subarray(points[i]!, points[i + 1]!);
    // A sliver left over after the last cut is not worth a request.
    const words = piece.length < RATE / 2 ? "" : await sendPiece(wav(piece), text, signal);
    if (words) text = text ? `${text} ${words}` : words;
    yield { text, done: i + 1, total };
  }
}
