import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

function findRtlFm(): string {
  const candidates: string[] = [];
  candidates.push(resolve(dirname(process.execPath), "rtlsdr-bin", "rtl_fm.exe"));
  try { candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), "../rtlsdr-bin/rtl_fm.exe")); } catch {}
  candidates.push(resolve(process.cwd(), "rtlsdr-bin", "rtl_fm.exe"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}
const RTL_FM_PATH = findRtlFm();

export interface RtlFmParams {
  freq: number;
  gain: number;
  mode: string;
  sampleRate: number;
  squelch: number;
}

export class RtlFmProcess {
  private proc: ChildProcess | null = null;
  private params: RtlFmParams;
  private onAudio: ((buf: Float32Array) => void) | null = null;
  private buffer = Buffer.alloc(0);

  constructor() {
    this.params = {
      freq: 100_000_000,
      gain: 30,
      mode: "fm",
      sampleRate: 48_000,
      squelch: 0,
    };
  }

  onAudioData(cb: (buf: Float32Array) => void): void { this.onAudio = cb; }

  async start(): Promise<void> {
    await this.spawn();
  }

  async setFrequency(freqHz: number): Promise<void> {
    this.params.freq = freqHz;
    await this.restart();
  }

  async setGain(gainDb: number): Promise<void> {
    this.params.gain = gainDb;
    await this.restart();
  }

  async setSquelch(squelch: number): Promise<void> {
    this.params.squelch = squelch;
    await this.restart();
  }

  async setMode(mode: string): Promise<void> {
    this.params.mode = mode;
    await this.restart();
  }

  close(): void {
    this.kill();
  }

  private kill(): void {
    if (this.proc) {
      this.proc.stdout?.removeAllListeners("data");
      this.proc.stderr?.removeAllListeners("data");
      this.proc.removeAllListeners("exit");
      this.proc.removeAllListeners("error");
      try { this.proc.kill(); } catch {}
      this.proc = null;
    }
  }

  private async restart(): Promise<void> {
    this.buffer = Buffer.alloc(0);
    this.kill();
    await this.spawn();
  }

  private async spawn(): Promise<void> {
    const { freq, gain, mode, sampleRate, squelch } = this.params;

    const freqStr = freq >= 1_000_000_000 ? `${(freq / 1_000_000_000).toFixed(3)}G`
                  : freq >= 1_000_000 ? `${(freq / 1_000_000).toFixed(3)}M`
                  : `${freq}`;

    this.proc = spawn(RTL_FM_PATH, [
      "-f", freqStr,
      "-M", mode === "nfm" ? "fm" : mode,
      "-s", String(sampleRate),
      "-g", String(gain),
      "-l", String(squelch),
      "-A", "fast",
      "-F", "9",
      "-E", "dc",
      "-",
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    this.proc.stdout!.on("data", (data: Buffer) => this.onStdout(data));

    this.proc.stderr!.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error("rtl_fm:", msg);
    });

    this.proc.on("error", (err) => {
      console.error("rtl_fm process error:", err.message);
      this.proc = null;
    });

    this.proc.on("exit", (code) => {
      if (code !== 0 && this.proc) {
        console.warn(`rtl_fm exited with code ${code}, restarting...`);
        setTimeout(() => this.restart(), 500);
      }
      this.proc = null;
    });
  }

  private onStdout(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    const sampleSize = 2; // 16-bit PCM
    const frameSamples = 1024;
    const frameBytes = frameSamples * sampleSize;

    while (this.buffer.length >= frameBytes) {
      const chunk = this.buffer.subarray(0, frameBytes);
      this.buffer = this.buffer.subarray(frameBytes);

      const audio = new Float32Array(frameSamples);
      for (let i = 0; i < frameSamples; i++) {
        audio[i] = chunk.readInt16LE(i * 2) / 32768;
      }
      if (this.onAudio) this.onAudio(audio);
    }
  }
}
