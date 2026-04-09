"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square, AlertTriangle } from "lucide-react";
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

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access was denied. Please allow microphone permission in your browser settings and try again.",
  "network": "Could not connect to Google's speech recognition service. Chrome sends audio to Google servers for transcription. If you use a Pi-hole, DNS-level ad blocker, or VPN, it may be blocking www.google.com or speech.google.com. Whitelist those domains, or type your transcript directly in the text box below.",
  "audio-capture": "No microphone was found. Please connect a microphone and try again.",
  "service-not-allowed": "Speech recognition service is not allowed. This may be due to browser settings or extensions blocking the service.",
};

interface DictationRecorderProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}

export function DictationRecorder({ onTranscript, disabled }: DictationRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied" | "prompt">("unknown");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) setIsSupported(false);

    // Check microphone permission state
    if (navigator.permissions) {
      navigator.permissions.query({ name: "microphone" as PermissionName }).then(result => {
        setMicPermission(result.state as "granted" | "denied" | "prompt");
        result.onchange = () => setMicPermission(result.state as "granted" | "denied" | "prompt");
      }).catch(() => { /* permissions API not available for microphone in some browsers */ });
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setErrorType(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser. Use Chrome, Edge, or Safari.");
      return;
    }

    // Pre-check: can we reach Google's speech service?
    // Chrome's Web Speech API streams audio to Google servers for processing.
    // If DNS-level blocking (Pi-hole, corporate firewall, VPN) prevents
    // reaching www.google.com, recognition.start() will silently fail with
    // a "network" error and nothing appears in DevTools.
    try {
      const probe = await fetch("https://www.google.com/generate_204", {
        method: "HEAD",
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      // mode: "no-cors" means we get an opaque response — that's fine,
      // we only care that the request didn't throw (i.e. DNS resolved + TCP connected)
      void probe;
    } catch {
      setError("Cannot reach Google's speech servers (www.google.com). Chrome requires an internet connection to Google for speech-to-text. If you use a Pi-hole or network-level ad blocker, whitelist www.google.com and speech.google.com. You can still type your transcript directly in the text box below.");
      setErrorType("network");
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

      // "not-allowed" means user denied mic — update permission state
      if (event.error === "not-allowed") {
        setMicPermission("denied");
      }

      const msg = ERROR_MESSAGES[event.error] ?? `Speech recognition error: ${event.error}. Try disabling browser extensions or using a different browser.`;
      setError(msg);
      setErrorType(event.error);
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
    try {
      recognition.start();
      setIsRecording(true);
      setMicPermission("granted");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } catch (err) {
      setError("Failed to start speech recognition. Please try again.");
    }
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
      {micPermission === "denied" && !error && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>Microphone permission is blocked. Click the lock icon in your browser address bar to allow microphone access.</span>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              <span>{error}</span>
              {errorType && <span className="block mt-1 text-[10px] text-red-400/40 font-mono">error code: {errorType}</span>}
            </div>
          </div>
          {(errorType === "network" || errorType === "service-not-allowed") && (
            <div className="mt-2 flex items-center gap-2 pl-5">
              <button onClick={() => { setError(null); setErrorType(null); startRecording(); }} className="text-[10px] font-medium text-amber-500 hover:text-amber-400 underline">
                Try again
              </button>
              <span className="text-[10px] text-red-400/60">or type your transcript directly below</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
