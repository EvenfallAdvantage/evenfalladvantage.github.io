"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Web Speech API type stubs ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface DictationRecorderProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}

export function DictationRecorder({ onTranscript, disabled }: DictationRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) setIsSupported(false);
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(() => {
    setError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser. Use Chrome, Edge, or Safari.");
      return;
    }

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript, true);
      } else if (interimTranscript) {
        onTranscript(interimTranscript, false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      if (event.error === "aborted") return;
      setError(`Recognition error: ${event.error}`);
      setIsRecording(false);
      recordingRef.current = false;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    recognition.onend = () => {
      if (recordingRef.current && recognitionRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recordingRef.current = true;
    recognition.start();
    setIsRecording(true);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    recordingRef.current = false;
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch {}
    }
    setIsRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-600">
        <MicOff className="inline h-3.5 w-3.5 mr-1.5" />
        Speech recognition is not available in this browser. Use Chrome, Edge, or Safari for dictation.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {isRecording ? (
          <Button size="sm" variant="destructive" className="gap-2" onClick={stopRecording} disabled={disabled} aria-label="Stop recording">
            <Square className="h-3.5 w-3.5" /> Stop Recording
          </Button>
        ) : (
          <Button size="sm" className="gap-2" onClick={startRecording} disabled={disabled} aria-label="Start recording">
            <Mic className="h-3.5 w-3.5" /> Start Recording
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
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
