/**
 * Live transcription for the Speak tab.
 *
 * The microphone is streamed to OpenAI's Realtime transcription over a
 * WebSocket, and the words come back phrase by phrase while the reader is
 * still talking. The connection goes straight from this tab to OpenAI, opened
 * with a one-use key from `/api/transcribe/session`; our server never sees the
 * audio.
 *
 * The session wants 16-bit mono PCM at a fixed rate, and microphones deliver
 * float samples at whatever rate the hardware likes (44.1 or 48 kHz, 16 kHz on
 * some Bluetooth headsets). An AudioWorklet does the conversion off the main
 * thread. Asking the AudioContext for the target rate instead would be
 * simpler, but Firefox refuses to connect a microphone to a context running at
 * a different rate from the device.
 */

import { api } from "@/lib/api";
import { TRANSCRIBE_SAMPLE_RATE, type TranscribeSession } from "@/types";

/**
 * Samples per message to the socket: 50 ms. Short enough that the gap between
 * two words shows up as a quiet chunk of its own, which is what `pace` below
 * looks for when it has to end a phrase itself.
 */
const CHUNK = TRANSCRIBE_SAMPLE_RATE / 20;

/**
 * Ending phrases from this side as well as the server's.
 *
 * Text comes back only once a phrase is closed, and OpenAI closes one only
 * when it hears a pause. Real rooms defeat that: a fan, traffic or a laptop's
 * own hiss reads as speech that never stops, and someone telling a story
 * barely pauses anyway — the first word would appear and then nothing until
 * Stop. So once a phrase has run SOFT_MS, it is closed at the next dip between
 * words (a chunk well below the recent loudness), and at HARD_MS it is closed
 * regardless, even if that splits a word.
 */
const SOFT_MS = 3_000;
const HARD_MS = 7_000;
/** A chunk this far below the recent peak is a gap between words. */
const DIP = 0.35;
/** How quickly the remembered peak fades, per chunk — about half in a second. */
const PEAK_DECAY = 0.965;

/** How long stopping waits for the last phrase to come back before giving up on it. */
const DRAIN_MS = 6_000;

/**
 * Resamples to the session rate and packs 16-bit samples.
 *
 * Each output sample is the mean of the input samples it covers — a crude
 * low-pass that keeps a 48 kHz microphone from aliasing into the band speech
 * lives in. For a device slower than the target, the ratio drops below one
 * and samples are repeated instead. Plain JavaScript in a string because a
 * worklet has to be loaded from a URL of its own, and the bundler has no
 * notion of one.
 */
const WORKLET = `
class Pcm16 extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${TRANSCRIBE_SAMPLE_RATE};
    this.t = 0;
    this.sum = 0;
    this.count = 0;
    this.out = new Int16Array(${CHUNK});
    this.n = 0;
    this.energy = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i];
      this.count++;
      this.t += 1;
      if (this.t < this.ratio) continue;
      const s = Math.max(-1, Math.min(1, this.sum / this.count));
      const sample = s < 0 ? s * 0x8000 : s * 0x7fff;
      while (this.t >= this.ratio) {
        this.t -= this.ratio;
        this.out[this.n++] = sample;
        this.energy += s * s;
        if (this.n === this.out.length) {
          const rms = Math.sqrt(this.energy / this.n);
          this.port.postMessage({ pcm: this.out.buffer, rms }, [this.out.buffer]);
          this.out = new Int16Array(${CHUNK});
          this.n = 0;
          this.energy = 0;
        }
      }
      this.sum = 0;
      this.count = 0;
    }
    return true;
  }
}
registerProcessor("pcm16", Pcm16);
`;

function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Why the microphone would not start, in words that say what to do about it. */
export function micProblem(cause: unknown): string {
  const name = (cause as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Atlas needs your microphone to record. Allow it in the browser's site settings, then try again.";
  }
  if (name === "NotFoundError") return "No microphone was found on this device.";
  if (name === "NotReadableError") return "The microphone is busy in another app. Close it there and try again.";
  return "The microphone could not be started.";
}

/** Whether this browser can record at all — plain-http pages get no microphone. */
export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof AudioWorkletNode !== "undefined" &&
    typeof WebSocket !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export type LiveHandlers = {
  /** Everything heard so far in this recording, finished phrases and the one arriving. */
  onText: (text: string) => void;
  /** True while the reader is mid-phrase, before its words have come back. */
  onSpeaking: (speaking: boolean) => void;
  /** The session ended on its own — a dropped connection, a time limit. What was heard is kept. */
  onEnded: (reason: string | null) => void;
};

export type LiveTranscription = {
  /** Stops listening, waits briefly for the last phrase, then closes. */
  stop: () => Promise<void>;
  /** Closes at once, dropping anything unfinished — for a page going away. */
  abandon: () => void;
};

/**
 * Opens the microphone and a transcription session, and starts streaming.
 *
 * Rejects with a readable message if any of the three fails to start; the
 * microphone is asked for first, so a refusal is the first thing reported and
 * nothing is spent on a session that could not be fed.
 */
export async function transcribeLive(handlers: LiveHandlers): Promise<LiveTranscription> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (cause) {
    throw new Error(micProblem(cause));
  }

  // Created now, still close to the click, so browsers that insist an audio
  // context start from a gesture let it run.
  const context = new AudioContext();
  const releaseAudio = () => {
    stream.getTracks().forEach(track => track.stop());
    void context.close().catch(() => {});
  };

  // ── The microphone ──────────────────────────────────────────────────────
  const moduleUrl = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(moduleUrl);
    await context.resume();
  } catch {
    releaseAudio();
    throw new Error("This browser could not start recording.");
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  const source = context.createMediaStreamSource(stream);
  const packer = new AudioWorkletNode(context, "pcm16");
  // A worklet only runs while it is part of a graph that reaches the output;
  // a muted gain gets it there without playing the reader back to themselves.
  const mute = context.createGain();
  mute.gain.value = 0;
  source.connect(packer).connect(mute).connect(context.destination);

  /**
   * Audio heard before the session is open. The microphone is live a second or
   * two before the connection is, and a reader who starts talking the moment
   * the browser lets them would otherwise lose their opening sentence — the
   * one that most often names where the trip began.
   */
  const backlog: ArrayBuffer[] = [];
  let live: WebSocket | null = null;
  let muted = false;
  const append = (chunk: ArrayBuffer) =>
    live!.send(JSON.stringify({ type: "input_audio_buffer.append", audio: base64(chunk) }));

  /** When the phrase now being spoken began, by the server's hearing; null between phrases. */
  let phraseSince: number | null = null;
  let peak = 0;
  /** Closes a phrase the server is taking too long to close. See SOFT_MS. */
  const pace = (rms: number) => {
    if (phraseSince === null || stopping) return;
    peak = Math.max(rms, peak * PEAK_DECAY);

    const held = performance.now() - phraseSince;
    if ((held >= SOFT_MS && rms < peak * DIP) || held >= HARD_MS) {
      live!.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      // Still mid-speech as far as the server knows, so the next phrase
      // starts now rather than at a `speech_started` that will not come.
      phraseSince = performance.now();
    }
  };

  packer.port.onmessage = ({ data }: MessageEvent<{ pcm: ArrayBuffer; rms: number }>) => {
    if (muted) return;
    if (live?.readyState === WebSocket.OPEN) {
      append(data.pcm);
      pace(data.rms);
    } else if (!live) {
      backlog.push(data.pcm);
    }
  };

  let socket: WebSocket;
  try {
    const { secret } = await api.post<TranscribeSession>("/api/transcribe/session");
    socket = await connect(secret);
  } catch (cause) {
    releaseAudio();
    throw cause instanceof Error ? cause : new Error("Transcription could not be reached.");
  }

  live = socket;
  backlog.splice(0).forEach(append);

  // ── The transcript ──────────────────────────────────────────────────────
  // Each phrase is an item. Items are committed in the order they were
  // spoken, deltas fill them in, and the completed transcript replaces the
  // deltas with the final wording.
  const order: string[] = [];
  const phrases = new Map<string, string>();
  const unfinished = new Set<string>();
  const emit = () =>
    handlers.onText(
      order
        .map(id => phrases.get(id)?.trim() ?? "")
        .filter(Boolean)
        .join(" "),
    );
  const place = (id: string) => {
    if (!phrases.has(id)) {
      order.push(id);
      phrases.set(id, "");
    }
  };

  let stopping = false;
  let finished = false;
  let drained: (() => void) | null = null;
  let flushAnswered = false;
  const maybeDrained = () => {
    if (stopping && flushAnswered && unfinished.size === 0) drained?.();
  };

  socket.onmessage = message => {
    let event: any;
    try {
      event = JSON.parse(String(message.data));
    } catch {
      return;
    }

    switch (event.type) {
      case "input_audio_buffer.speech_started":
        phraseSince = performance.now();
        peak = 0;
        handlers.onSpeaking(true);
        break;
      case "input_audio_buffer.speech_stopped":
        phraseSince = null;
        handlers.onSpeaking(false);
        break;
      case "input_audio_buffer.committed":
        place(event.item_id);
        unfinished.add(event.item_id);
        if (stopping) flushAnswered = true;
        maybeDrained();
        break;
      case "conversation.item.input_audio_transcription.delta":
        place(event.item_id);
        phrases.set(event.item_id, (phrases.get(event.item_id) ?? "") + (event.delta ?? ""));
        emit();
        break;
      case "conversation.item.input_audio_transcription.completed":
        place(event.item_id);
        phrases.set(event.item_id, event.transcript ?? phrases.get(event.item_id) ?? "");
        unfinished.delete(event.item_id);
        emit();
        maybeDrained();
        break;
      case "conversation.item.input_audio_transcription.failed":
        // One phrase lost; the rest of the recording carries on.
        unfinished.delete(event.item_id);
        maybeDrained();
        break;
      case "error":
        // The flush at stop is refused when nothing was said since the last
        // pause. That is the normal case, not a failure.
        if (stopping) {
          flushAnswered = true;
          maybeDrained();
        } else {
          console.warn("[transcribe]", event.error?.message);
        }
        break;
    }
  };


  const finish = (reason: string | null) => {
    if (finished) return;
    finished = true;
    muted = true;
    packer.port.onmessage = null;
    releaseAudio();
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    handlers.onSpeaking(false);
    handlers.onEnded(reason);
  };

  // A microphone unplugged or permission revoked mid-recording: keep what was said.
  stream.getAudioTracks()[0]?.addEventListener("ended", () => void stop());

  socket.onclose = () => {
    drained?.();
    finish(stopping ? null : "The connection to transcription closed. What was heard so far is kept.");
  };

  const stop = async () => {
    if (stopping || finished) return;
    stopping = true;
    muted = true;

    // The microphone goes off at once; the reader pressed stop and should see
    // the light go out. The phrase in progress is flushed rather than waiting
    // for a pause that will never come.
    stream.getTracks().forEach(track => track.stop());
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      await new Promise<void>(resolve => {
        drained = resolve;
        maybeDrained();
        setTimeout(resolve, DRAIN_MS);
      });
    }
    finish(null);
  };

  return {
    stop,
    abandon: () => {
      stopping = true;
      muted = true;
      finish(null);
    },
  };
}

/** Opens the socket with the one-use key, the way OpenAI documents for browsers. */
function connect(secret: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://api.openai.com/v1/realtime", [
      "realtime",
      `openai-insecure-api-key.${secret}`,
    ]);
    socket.onopen = () => {
      socket.onerror = null;
      resolve(socket);
    };
    socket.onerror = () => reject(new Error("Transcription could not be reached."));
  });
}
