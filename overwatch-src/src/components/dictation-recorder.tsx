"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square, AlertTriangle, Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { detectSpeechTier, describeTier, type SpeechTier } from "@/lib/speech";
import type { WhisperProgress } from "@/lib/speech/whisper-engine";

/* ── Web Speech API type stubs ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const NATIVE_ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Please allow microphone permission in your browser settings and try again.",
  "audio-capture": "No microphone was found. Please connect a microphone and try again.",
  "service-not-allowed": "Speech recognition service is not allowed. This may be due to browser settings or extensions blocking the service.",
  "network": "Could not connect to the speech recognition service. Falling back to local Whisper AI...",
};

interface DictationRecorderProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}

export function DictationRecorder({ onTranscript, disabled }: DictationRecorderProps) {
  const [tier, setTier] = useState<SpeechTier>("native");
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [whisperStatus, setWhisperStatus] = useState<WhisperProgress | null>(null);
  const [processingWhisper, setProcessingWhisper] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Detect best tier on mount
  useEffect(() => {
    setTier(detectSpeechTier());
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (mediaRecorderRef.current?.state === "recording") { try { mediaRecorderRef.current.stop(); } catch {} }
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
        try { recognition.start(); } catch {}
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
  }, [onTranscript]);

  function stopNative() {
    recordingRef.current = false;
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch {}
    }
    setIsRecording(false);
    stopTimer();
  }

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

    // Transcribe
    setProcessingWhisper(true);
    try {
      // Lazy-load the Whisper engine (not in main bundle)
      const { transcribe, audioBufferToFloat32 } = await import("@/lib/speech/whisper-engine");

      // Decode the audio blob to an AudioBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();

      // Convert to 16kHz mono Float32Array
      const float32 = audioBufferToFloat32(audioBuffer);

      // Run Whisper
      const text = await transcribe(float32, (p) => setWhisperStatus(p));

      if (text) {
        onTranscript(text, true);
      } else {
        setError("Could not detect any speech in the recording. Please try again.");
      }
    } catch (err) {
      console.error("[Dictation] Whisper transcription error:", err);
      setError(`Transcription failed: ${err instanceof Error ? err.message : "Unknown error"}. You can type your transcript manually.`);
    } finally {
      setProcessingWhisper(false);
      setWhisperStatus(null);
    }
  }, [onTranscript]);

  // ─── Unified start/stop ─────────────────────────────
  const handleStart = useCallback(() => {
    if (tier === "native") startNative();
    else startWhisper();
  }, [tier, startNative, startWhisper]);

  const handleStop = useCallback(() => {
    if (tier === "native") stopNative();
    else stopWhisper();
  }, [tier, stopWhisper]);

  // ─── Render ─────────────────────────────────────────
  return (
    <div className="space-y-2">
      {/* Engine badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] gap-1 font-mono text-muted-foreground">
          {tier === "whisper" && <Cpu className="h-2.5 w-2.5" />}
          {tier === "native" && <Mic className="h-2.5 w-2.5" />}
          {describeTier(tier)}
        </Badge>
        {tier === "native" && (
          <button
            onClick={() => setTier("whisper")}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline"
          >
            use local AI instead
          </button>
        )}
        {tier === "whisper" && getSpeechRecognitionCtor() && (
          <button
            onClick={() => { setTier("native"); setError(null); }}
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline"
          >
            try browser native
          </button>
        )}
      </div>

      {/* Whisper status */}
      {(whisperStatus?.status === "downloading" || whisperStatus?.status === "loading") && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 text-xs text-blue-400 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <div className="flex-1">
            <span>{whisperStatus.message}</span>
            {whisperStatus.progress != null && whisperStatus.progress > 0 && (
              <div className="mt-1 h-1 rounded-full bg-blue-500/20 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${whisperStatus.progress}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button size="sm" variant="destructive" className="gap-2" onClick={handleStop} disabled={disabled || processingWhisper} aria-label="Stop recording">
            <Square className="h-3.5 w-3.5" /> Stop{tier === "whisper" ? " & Transcribe" : " Recording"}
          </Button>
        ) : (
          <Button size="sm" className="gap-2" onClick={handleStart} disabled={disabled || processingWhisper} aria-label="Start recording">
            {processingWhisper ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
            {processingWhisper ? "Transcribing..." : "Start Recording"}
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

      {/* Whisper processing indicator */}
      {processingWhisper && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-500 flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <span>{whisperStatus?.message ?? "Processing audio with local Whisper AI..."}</span>
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
