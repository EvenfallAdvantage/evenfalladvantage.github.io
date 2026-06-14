import { Vad, type VadEvent, type VadConfig } from "./vad";

export type Transcription = {
  id: string;
  text: string;
  freqHz: number;
  timestamp: number;
  durationMs: number;
  status: "pending" | "done" | "error";
};

export type TranscribeProgress = (t: Transcription) => void;

function resample(src: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return src;
  const ratio = fromRate / toRate;
  const newLen = Math.round(src.length / ratio);
  const dst = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, src.length - 1);
    const frac = pos - lo;
    dst[i] = src[lo] * (1 - frac) + src[hi] * frac;
  }
  return dst;
}

let nextId = 0;

export class RadioTranscriber {
  private vad: Vad;
  private active = false;
  private onTranscription: TranscribeProgress;
  private freqHz = 0;
  private transcribing = false;
  private queue: VadEvent[] = [];

  constructor(config: {
    onTranscription: TranscribeProgress;
    freqHz: number;
    sampleRate?: number;
    vadConfig?: Partial<VadConfig>;
  }) {
    this.onTranscription = config.onTranscription;
    this.freqHz = config.freqHz;
    this.vad = new Vad(config.vadConfig);
    this.vad.onSpeechEnd = (evt) => this.handleSegment(evt);
  }

  start(): void { this.active = true; }

  stop(): void {
    this.active = false;
    this.vad.flush();
  }

  setFrequency(freq: number): void { this.freqHz = freq; }

  feed(chunk: Float32Array): void {
    if (!this.active) return;
    this.vad.feed(chunk);
  }

  private handleSegment(evt: VadEvent): void {
    if (!this.active) return;
    const id = `tx-${nextId++}`;
    const t: Transcription = {
      id,
      text: "",
      freqHz: this.freqHz,
      timestamp: Date.now(),
      durationMs: evt.endMs - evt.startMs,
      status: "pending",
    };
    this.queue.push(evt);
    this.onTranscription(t);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.transcribing) return;
    this.transcribing = true;

    while (this.queue.length > 0) {
      const evt = this.queue.shift()!;
      const id = `tx-${nextId - this.queue.length - 1}`;

      try {
        const { transcribeWithTimestamps } = await import(
          "@/lib/speech/whisper-engine"
        );

        const resampled = resample(evt.audio, this.vad.sampleRate, 16000);

        const result = await transcribeWithTimestamps(resampled, undefined, false);

        this.onTranscription({
          id,
          text: result.text,
          freqHz: this.freqHz,
          timestamp: Date.now(),
          durationMs: evt.endMs - evt.startMs,
          status: "done",
        });
      } catch (err) {
        this.onTranscription({
          id,
          text: err instanceof Error ? err.message : "Transcription failed",
          freqHz: this.freqHz,
          timestamp: Date.now(),
          durationMs: evt.endMs - evt.startMs,
          status: "error",
        });
      }
    }

    this.transcribing = false;
  }
}
