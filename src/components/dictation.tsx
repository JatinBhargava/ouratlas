import { useEffect, useRef, useState } from "react";
import { FileAudio, Loader2, LogIn, Mic, Square, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { canRecord, transcribeLive, type LiveTranscription } from "@/lib/transcribe";
import { ACCEPT, transcribeFile } from "@/lib/transcribe-file";
import { VOICE_NEEDS_SIGN_IN } from "@/types";

/** 125 → "2:05". */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export type Dictation = {
  /** The browser can record at all. */
  supported: boolean;
  /** Recording would need an account the reader does not have yet. */
  needsSignIn: boolean;
  /** Still waiting on something before recording can start (the stored session). */
  waiting: boolean;
  starting: boolean;
  recording: boolean;
  /** Mid-phrase: the reader is talking and those words have not come back yet. */
  speaking: boolean;
  /** Stopped, and waiting for the last phrase to be set. */
  finishing: boolean;
  elapsed: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

/**
 * Live dictation into the copy.
 *
 * `onText` is handed the whole of this recording's transcript every time it
 * grows — finished phrases plus the one arriving — so the caller can set it
 * into the copy as it stands rather than stitching fragments together.
 *
 * Held by the story editor rather than the Speak tab, so the recording outlives
 * a switch between tabs: the point is to watch the words land under Write.
 */
export function useDictation(onText: (text: string) => void): Dictation {
  const { ready, user } = useAuth();

  // Read once: the answer does not change while the page is open.
  const [supported] = useState(canRecord);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const live = useRef<LiveTranscription | null>(null);
  const timer = useRef<number | null>(null);
  /** False once the editor is gone, so a late phrase is not set into a page that has moved on. */
  const alive = useRef(true);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stopClock = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };

  const start = async () => {
    if (live.current || starting) return;
    setError(null);
    setStarting(true);

    try {
      const session = await transcribeLive({
        onText: text => {
          if (alive.current) onTextRef.current(text);
        },
        onSpeaking: value => {
          if (alive.current) setSpeaking(value);
        },
        onEnded: reason => {
          live.current = null;
          stopClock();
          if (!alive.current) return;
          setRecording(false);
          setFinishing(false);
          if (reason) setError(reason);
        },
      });
      if (!alive.current) {
        session.abandon();
        return;
      }

      live.current = session;
      const began = Date.now();
      setElapsed(0);
      setRecording(true);
      timer.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - began) / 1000)), 500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recording could not be started.");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    const session = live.current;
    if (!session) return;
    stopClock();
    setFinishing(true);
    await session.stop();
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopClock();
      live.current?.abandon();
      live.current = null;
    };
  }, []);

  return {
    supported,
    needsSignIn: VOICE_NEEDS_SIGN_IN && ready && !user,
    waiting: VOICE_NEEDS_SIGN_IN && !ready,
    starting,
    recording,
    speaking,
    finishing,
    elapsed,
    error,
    start,
    stop,
  };
}

export type FileTranscription = {
  /** The file being transcribed, or null. */
  name: string | null;
  /** Pieces done and in all; total is 0 while the file is still being decoded. */
  done: number;
  total: number;
  error: string | null;
  start: (file: File) => Promise<void>;
  cancel: () => void;
};

/**
 * Transcribing an uploaded recording into the copy.
 *
 * Like `useDictation`, `onText` gets the whole transcript so far each time a
 * piece lands, and the caller sets it after the copy as it stood.
 */
export function useFileTranscription(onText: (text: string) => void): FileTranscription {
  const { ready, user } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const start = async (file: File) => {
    if (abort.current) return;
    // Behind sign-in only when voice is; the panel offers sign-in instead.
    if (VOICE_NEEDS_SIGN_IN && (!ready || !user)) return;

    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setName(file.name);
    setDone(0);
    setTotal(0);

    try {
      for await (const progress of transcribeFile(file, controller.signal)) {
        if (controller.signal.aborted) break;
        setDone(progress.done);
        setTotal(progress.total);
        if (progress.text) onTextRef.current(progress.text);
      }
    } catch (cause) {
      // Whatever was transcribed before the failure stays in the copy.
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "That recording could not be transcribed.");
      }
    } finally {
      abort.current = null;
      setName(null);
    }
  };

  const cancel = () => abort.current?.abort();

  useEffect(() => () => abort.current?.abort(), []);

  return { name, done, total, error, start, cancel };
}

type SpeakPanelProps = {
  dictation: Dictation;
  upload: FileTranscription;
  /** Sign-in is a full-page redirect, so the desk has to be put away first — the page does that. */
  onSignIn: () => void;
  /** The copy is at its word limit; nothing more should be recorded into it. */
  full: boolean;
};

/**
 * The Speak tab: where a recording starts. Once it does, the editor moves to
 * Write, so the reader watches their words being set.
 */
export function SpeakPanel({ dictation, upload, onSignIn, full }: SpeakPanelProps) {
  const { supported, needsSignIn, waiting, starting, recording, error, start } = dictation;
  const picker = useRef<HTMLInputElement>(null);
  const busy = recording || starting || upload.name !== null;

  let note: string;
  if (!supported) {
    note = "This browser can't record audio. Chrome, Edge, Firefox and Safari all can.";
  } else if (needsSignIn) {
    note =
      "Say it out loud and it's written down as you go. Recording needs an account — sign in with Google and your desk comes back just as you left it.";
  } else if (full) {
    note = "The copy is at its word limit. Trim it under Write to record more.";
  } else {
    note = "Say it out loud and watch it written down under Write as you go, a few words behind you.";
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-700 text-white">
        <Mic className="size-6" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="font-medium text-stone-800">Talk it through</p>
        <p className="max-w-sm text-sm text-stone-500">{note}</p>
      </div>

      {supported &&
        (needsSignIn ? (
          <Button className="rounded-full" onClick={onSignIn}>
            <LogIn className="size-4" />
            Sign in to record
          </Button>
        ) : (
          <Button className="rounded-full" onClick={() => void start()} disabled={waiting || starting || recording || full}>
            {starting ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
            {starting ? "Opening the microphone" : "Start recording"}
          </Button>
        ))}

      {!needsSignIn && (
        <>
          <input
            ref={picker}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              // Cleared so choosing the same file again still fires a change.
              event.target.value = "";
              if (file) void upload.start(file);
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-stone-600"
            onClick={() => picker.current?.click()}
            disabled={waiting || busy || full}
          >
            <Upload className="size-4" />
            Or upload a recording
          </Button>
        </>
      )}

      {(error ?? upload.error) && <p className="max-w-sm text-sm text-red-600">{error ?? upload.error}</p>}

      {supported && !needsSignIn && (
        <p className="max-w-sm text-xs text-stone-500">
          Your voice is sent to OpenAI to be transcribed and comes back as text. Atlas keeps neither the audio nor
          the words.
        </p>
      )}
    </div>
  );
}

/** Sits above the copy while recording: what is happening, how long, and the way to stop. */
export function RecordingBar({ dictation }: { dictation: Dictation }) {
  const { speaking, finishing, elapsed, stop } = dictation;

  return (
    <div className="flex items-center justify-between gap-3 rounded-full bg-red-50 py-1.5 pr-1.5 pl-4 ring-1 ring-red-200">
      <p className="flex items-center gap-2 text-sm text-red-800">
        <span className={`size-2 rounded-full bg-red-600 ${finishing ? "" : "animate-pulse"}`} />
        {finishing ? "Setting the last words…" : speaking ? "Listening…" : "Recording"}
        <span className="text-red-700/70 tabular-nums">{clock(elapsed)}</span>
      </p>
      <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={() => void stop()} disabled={finishing}>
        {finishing ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3 fill-current" />}
        Stop
      </Button>
    </div>
  );
}

/** Sits above the copy while an uploaded recording is transcribed. */
export function UploadBar({ upload }: { upload: FileTranscription }) {
  const { name, done, total, cancel } = upload;

  return (
    <div className="flex items-center justify-between gap-3 rounded-full bg-emerald-50 py-1.5 pr-1.5 pl-4 ring-1 ring-emerald-200">
      <p className="flex min-w-0 items-center gap-2 text-sm text-emerald-900">
        <FileAudio className="size-4 shrink-0" />
        <span className="truncate">
          {total === 0 ? `Reading ${name}…` : `Transcribing ${name}`}
        </span>
        {total > 1 && (
          <span className="shrink-0 text-emerald-800/70 tabular-nums">
            {done} of {total}
          </span>
        )}
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      </p>
      <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={cancel}>
        <X className="size-3.5" />
        Stop
      </Button>
    </div>
  );
}
