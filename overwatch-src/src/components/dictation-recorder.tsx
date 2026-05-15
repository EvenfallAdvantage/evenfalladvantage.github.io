"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, AlertTriangle, Cpu, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectSpeechTier, describeTier, type SpeechTier } from "@/lib/speech";
import type { WhisperProgress } from "@/lib/speech/whisper-engine";
import type { SpeakerTurn } from "@/lib/speech/diarize-align";
import { logger } from "@/lib/logger";

/* ── Web Speech API type stubs ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const NATIVE_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Please allow microphone permission in your browser settings and try again.",
  "audio-capture": "No microphone was found. Please connect a microphone and try again.",
  "service-not-allowed": "Speech recognition service is not allowed. This may be due to browser settings or extensions blocking the service.",
  "network": "Could not connect to the speech recognition service. Falling back to local Whisper AI...",
};

interface DictationRecorderProps {
  /**
   * Called with the transcribed text. When diarization is enabled and
   * Whisper produced word-level timestamps, `turns` is populated with
   * structured speaker turns. Otherwise `turns` is undefined and the
   * caller treats the text as a flat transcript.
   */
  onTranscript: (text: string, isFinal: boolean, turns?: SpeakerTurn[]) => void;
  disabled?: boolean;
}

export function DictationRecorder({ onTranscript, disabled }: DictationRecorderProps) {
  const [tier, setTier] = useState<SpeechTier>("native");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState<WhisperProgress | null>(null);
  const [processingWhisper, setProcessingWhisper] = useState(false);
  /**
   * When true and the active tier is "whisper", we run pyannote on the
   * audio after Whisper transcription and emit speaker-labeled turns.
   * Persisted across renders via localStorage so the user doesn't have
   * to re-enable it every time.
   */
  const [diarizationEnabled, setDiarizationEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("dictation:diarization") === "1";
    } catch {
      return false;
    }
  });

  /**
   * Hint to the diarization model — when the user knows the recording
   * has exactly N speakers, we collapse any extra "ghost speakers"
   * (caused by background noise misclassification) into the nearest
   * real speaker. 0 = Auto (no cap, let pyannote decide).
   *
   * Persisted across sessions so a user dictating regular 2-person
   * interviews doesn't have to pick "2" every time.
   */
  const [expectedSpeakers, setExpectedSpeakers] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const v = parseInt(localStorage.getItem("dictation:expectedSpeakers") ?? "0", 10);
      return Number.isFinite(v) && v >= 0 && v <= 8 ? v : 0;
    } catch {
      return 0;
    }
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Detect best tier on mount. If the user previously enabled
  // diarization, force-select the Whisper tier (only Whisper has the
  // raw audio buffer that diarization needs).
  useEffect(() => {
    const detected = detectSpeechTier();
    setTier(diarizationEnabled ? "whisper" : detected);
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) { logger.swallow("dictation:recognition-stop-cleanup", e); } }
      if (mediaRecorderRef.current?.state === "recording") { try { mediaRecorderRef.current.stop(); } catch (e) { logger.swallow("dictation:media-stop-cleanup", e, "trace"); } }
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // diarizationEnabled is intentionally not in deps: this runs once on mount.
    // Subsequent toggles are handled by toggleDiarization() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Toggle diarization on/off. Forces Whisper tier when enabling. */
  const toggleDiarization = useCallback(() => {
    setDiarizationEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("dictation:diarization", next ? "1" : "0"); } catch (e) { logger.swallow("dictation:diarization-persist", e, "trace"); }
      // Enabling diarization requires the Whisper tier (raw audio access).
      if (next) setTier("whisper");
      return next;
    });
  }, []);

  // ─── Timer helpers ──────────────────────────────────
  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // ─── Tier 1: Native Web Speech API ──────────────────
  const stopNative = useCallback(() => {
    recordingRef.current = false;
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch (e) { logger.swallow("dictation:recognition-stop", e, "trace"); }
    }
    setIsRecording(false);
    stopTimer();
  }, []);

  const startNative = useCallback(() => {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      // Fallback to whisper if native isn't available at runtime
      setTier("whisper");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.addEventListener("result", (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }
      if (finalTranscript) onTranscript(finalTranscript, true);
      else if (interimTranscript) onTranscript(interimTranscript, false);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.addEventListener("error", (event: any) => {
      console.warn("[Dictation] Native error:", event.error);
      if (event.error === "no-speech" || event.error === "aborted") return;

      // On network error, auto-fallback to Whisper
      if (event.error === "network") {
        console.info("[Dictation] Native speech failed, falling back to Whisper WASM");
        stopNative();
        setTier("whisper");
        setError("Browser speech recognition unavailable. Switched to local Whisper AI — click Start Recording to try again.");
        return;
      }

      const msg = NATIVE_ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}`;
      setError(msg);
      setIsRecording(false);
      recordingRef.current = false;
      stopTimer();
    });

    recognition.addEventListener("end", () => {
      if (recordingRef.current && recognitionRef.current) {
        try { recognition.start(); } catch (e) { logger.swallow("dictation:recognition-restart", e, "trace"); }
      }
    });

    recognitionRef.current = recognition;
    recordingRef.current = true;
    try {
      recognition.start();
      setIsRecording(true);
      startTimer();
    } catch {
      setError("Failed to start speech recognition. Please try again.");
    }
  }, [onTranscript, stopNative]);

  // ─── Tier 2: Whisper WASM via MediaRecorder ─────────
  const startWhisper = useCallback(async () => {
    setError(null);

    // Get mic stream
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was denied. Please allow microphone permission in your browser settings.");
      return;
    }

    // Start recording
    audioChunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // Collect in 1-second chunks
    setIsRecording(true);
    startTimer();
  }, []);

  const stopWhisper = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    setIsRecording(false);
    stopTimer();

    // Stop recording and wait for final data
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;

    if (blob.size === 0) {
      setError("No audio recorded. Please try again.");
      return;
    }

    // Transcribe (and optionally diarize)
    setProcessingWhisper(true);
    try {
      // Lazy-load the Whisper engine (not in main bundle)
      const { transcribeWithTimestamps, audioBufferToFloat32 } = await import("@/lib/speech/whisper-engine");

      // Decode the audio blob to an AudioBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      // Convert to 16kHz mono Float32Array. We KEEP this buffer through
      // the diarization step — same 16kHz mono format pyannote expects.
      const float32 = audioBufferToFloat32(audioBuffer);

      // Run Whisper. When diarization is enabled we need word-level
      // timestamps to align speakers; otherwise skip them (faster, less
      // model state to manage).
      const wantTimestamps = diarizationEnabled;
      const result = await transcribeWithTimestamps(float32, (p) => setWhisperStatus(p), wantTimestamps);

      if (!result.text) {
        setError("Could not detect any speech in the recording. Please try again.");
        return;
      }

      // If diarization is off, emit the flat text and we're done.
      if (!diarizationEnabled) {
        onTranscript(result.text, true);
        return;
      }

      // Diarization path: run pyannote on the same audio buffer, then
      // align Whisper words with speaker segments.
      try {
        const { diarize } = await import("@/lib/speech/diarization");
        const { alignWordsToSpeakers } = await import("@/lib/speech/diarize-align");
        const segments = await diarize(float32, (p) => setWhisperStatus(p), {
          expectedSpeakers: expectedSpeakers > 0 ? expectedSpeakers : undefined,
        });
        if (segments.length === 0 || result.words.length === 0) {
          // Diarization or word timestamps unavailable; emit plain text.
          onTranscript(result.text, true);
          return;
        }
        // Pass the audio buffer through to alignment for acoustic
        // re-matching — uses pitch/spectral features to fix boundary
        // words that pyannote mis-labeled.
        const turns = alignWordsToSpeakers(result.words, segments, float32);
        // Emit both the inline-labeled text (for the textarea) AND the
        // structured turns (for the speaker-bubble view).
        const labeledText = turns
          .map(t => `[Speaker ${Number(t.speaker) + 1}] ${t.text}`)
          .join("\n");
        onTranscript(labeledText, true, turns);
      } catch (diarErr) {
        // Diarization failed — fall back to plain transcript so the user
        // never loses their words to a diarization bug.
        logger.swallow("dictation:diarization-failed", diarErr, "warn");
        onTranscript(result.text, true);
      }
    } catch (err) {
      console.error("[Dictation] Whisper transcription error:", err);
      setError(`Transcription failed: ${err instanceof Error ? err.message : "Unknown error"}. You can type your transcript manually.`);
    } finally {
      setProcessingWhisper(false);
      setWhisperStatus(null);
    }
  }, [onTranscript, diarizationEnabled, expectedSpeakers]);

  // ─── Unified start/stop ─────────────────────────────
  const handleStart = useCallback(() => {
    if (tier === "native") startNative();
    else startWhisper();
  }, [tier, startNative, startWhisper]);

  const handleStop = useCallback(() => {
    if (tier === "native") stopNative();
    else stopWhisper();
  }, [tier, stopNative, stopWhisper]);

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Engine badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] gap-1 font-mono text-muted-foreground">
          {tier === "whisper" && <Cpu className="h-2.5 w-2.5" />}
          {tier === "native" && <Mic className="h-2.5 w-2.5" />}
          {describeTier(tier)}
        </Badge>
        {/* Diarization toggle. Active state shows a Users badge; clicking
            it during native-tier auto-switches to Whisper (the only tier
            that supports speaker detection — raw audio is required). */}
        <button
          onClick={toggleDiarization}
          disabled={isRecording || processingWhisper}
          className={`text-[10px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
            diarizationEnabled
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/40 text-muted-foreground/50 hover:text-muted-foreground hover:border-border"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          title={
            diarizationEnabled
              ? "Speaker detection ON — turns 'Whose voice is this?' into [Speaker 1]/[Speaker 2] labels"
              : tier === "native"
                ? "Enable speaker detection (will switch to local AI engine — required for audio access)"
                : "Enable speaker detection"
          }
        >
          <Users className="h-2.5 w-2.5" /> {diarizationEnabled ? "Speakers ON" : "Detect speakers"}
        </button>
        {/* Expected-speakers hint — shown only when diarization is on.
            Lets the user collapse "ghost speakers" caused by background
            noise misclassification by setting an explicit cap. */}
        {diarizationEnabled && (
          <select
            value={expectedSpeakers}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setExpectedSpeakers(n);
              try { localStorage.setItem("dictation:expectedSpeakers", String(n)); } catch (err) { logger.swallow("dictation:expected-persist", err, "trace"); }
            }}
            disabled={isRecording || processingWhisper}
            className="text-[10px] rounded border border-border/40 bg-background px-1.5 py-0.5 text-muted-foreground disabled:opacity-50"
            title="Tell the model how many speakers to expect. 'Auto' lets the model decide (may detect ghost speakers from noise). Setting a specific count collapses any extras into the nearest real speaker."
            aria-label="Expected number of speakers"
          >
            <option value={0}>Auto speakers</option>
            <option value={2}>2 speakers</option>
            <option value={3}>3 speakers</option>
            <option value={4}>4 speakers</option>
            <option value={5}>5 speakers</option>
            <option value={6}>6 speakers</option>
          </select>
        )}
        {tier === "native" && (
          <button
            onClick={() => setTier("whisper")}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline"
          >
            use local AI instead
          </button>
        )}
        {tier === "whisper" && !diarizationEnabled && getSpeechRecognitionCtor() && (
          <button
            onClick={() => { setTier("native"); setError(null); }}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline"
          >
            try browser native
          </button>
        )}
      </div>

      {/* Controls + unified status (single banner for download, transcribe,
          and diarize stages — uses brand primary color to match the panel) */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button size="sm" variant="destructive" className="gap-2" onClick={handleStop} disabled={disabled || processingWhisper} aria-label="Stop recording">
            <Square className="h-3.5 w-3.5" /> Stop{tier === "whisper" ? " & Transcribe" : " Recording"}
          </Button>
        ) : (
          <Button size="sm" className="gap-2" onClick={handleStart} disabled={disabled || processingWhisper} aria-label="Start recording">
            {processingWhisper ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
            {processingWhisper ? "Working..." : "Start Recording"}
          </Button>
        )}
        {isRecording && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span className="text-xs font-mono text-red-500">{formatTime(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Unified status banner — covers all Whisper / diarization stages.
          Replaces the two stacked banners (blue download bar + orange
          processing pill) that previously showed simultaneously during the
          download stage. */}
      {(processingWhisper || whisperStatus?.status === "downloading" || whisperStatus?.status === "loading") && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="truncate block">
              {whisperStatus?.message ?? "Processing audio with local Whisper AI..."}
            </span>
            {whisperStatus?.progress != null && whisperStatus.progress > 0 && (
              <div className="mt-1 h-1 rounded-full bg-primary/20 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${whisperStatus.progress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !processingWhisper && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
