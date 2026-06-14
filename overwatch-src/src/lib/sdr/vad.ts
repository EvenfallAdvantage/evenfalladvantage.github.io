export type VadConfig = {
  threshold: number;
  minSpeechMs: number;
  holdMs: number;
  sampleRate: number;
};

export type VadEvent = {
  audio: Float32Array;
  startMs: number;
  endMs: number;
};

const DEFAULTS: VadConfig = {
  threshold: 0.015,
  minSpeechMs: 150,
  holdMs: 800,
  sampleRate: 48000,
};

export class Vad {
  private config: VadConfig;
  private state: "silence" | "speech" = "silence";
  private chunkAccum: Float32Array[] = [];
  private speechStartMs = 0;
  private silenceStartMs = 0;
  private totalMs = 0;
  onSpeechEnd: ((evt: VadEvent) => void) | null = null;

  get sampleRate(): number { return this.config.sampleRate; }

  constructor(config?: Partial<VadConfig>) {
    this.config = { ...DEFAULTS, ...config };
  }

  feed(chunk: Float32Array): void {
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    const rms = Math.sqrt(sum / chunk.length);
    const chunkMs = (chunk.length / this.config.sampleRate) * 1000;
    const isSpeech = rms > this.config.threshold;

    this.totalMs += chunkMs;

    if (isSpeech) {
      if (this.state === "silence") {
        this.chunkAccum = [chunk];
        this.speechStartMs = this.totalMs;
        this.silenceStartMs = 0;
        this.state = "speech";
      } else {
        this.chunkAccum.push(chunk);
        this.silenceStartMs = 0;
      }
    } else {
      if (this.state === "speech") {
        this.chunkAccum.push(chunk);
        if (this.silenceStartMs === 0) {
          this.silenceStartMs = this.totalMs;
        }
        const silenceDur = this.totalMs - this.silenceStartMs;
        if (silenceDur >= this.config.holdMs) {
          this.endSegment();
        }
      }
    }
  }

  private endSegment(): void {
    const speechDurationMs = this.silenceStartMs - this.speechStartMs;
    if (speechDurationMs < this.config.minSpeechMs || this.chunkAccum.length === 0) {
      this.reset();
      return;
    }

    let totalLen = 0;
    for (const c of this.chunkAccum) totalLen += c.length;
    const audio = new Float32Array(totalLen);
    let offset = 0;
    for (const c of this.chunkAccum) { audio.set(c, offset); offset += c.length; }

    const evt: VadEvent = {
      audio,
      startMs: this.speechStartMs,
      endMs: this.silenceStartMs,
    };

    this.reset();
    this.onSpeechEnd?.(evt);
  }

  private reset(): void {
    this.state = "silence";
    this.chunkAccum = [];
    this.speechStartMs = 0;
    this.silenceStartMs = 0;
  }

  flush(): void {
    if (this.state === "speech") {
      this.silenceStartMs = this.totalMs;
      this.endSegment();
    }
  }
}
