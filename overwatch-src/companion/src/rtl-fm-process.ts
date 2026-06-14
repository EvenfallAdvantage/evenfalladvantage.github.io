import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { RTL_FM_EXE, LIBRTLSDR_DLL } from "./_embedded-bins";

function extractEmbeddedBinaries(): string {
  const tmpDir = resolve(tmpdir(), "sdr-companion-rtlsdr");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const exePath = resolve(tmpDir, "rtl_fm.exe");
  const dllPath = resolve(tmpDir, "librtlsdr.dll");
  if (!existsSync(exePath)) writeFileSync(exePath, Buffer.from(RTL_FM_EXE, "base64"));
  if (!existsSync(dllPath)) writeFileSync(dllPath, Buffer.from(LIBRTLSDR_DLL, "base64"));
  return tmpDir;
}

function findRtlFm(): string {
  const candidates: string[] = [];
  candidates.push(resolve(dirname(process.execPath), "rtlsdr-bin", "rtl_fm.exe"));
  try { candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), "../rtlsdr-bin/rtl_fm.exe")); } catch {}
  candidates.push(resolve(process.cwd(), "rtlsdr-bin", "rtl_fm.exe"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const tmpDir = extractEmbeddedBinaries();
  const p = resolve(tmpDir, "rtl_fm.exe");
  if (existsSync(p)) return p;
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
  private restartCount = 0;
  private _closing = false;
  private _restarting = false;

  constructor(initialFreq?: number) {
    this.params = {
      freq: initialFreq ?? 162_550_000,
      gain: 30,
      mode: "fm",
      sampleRate: 48_000,
      squelch: 0,
    };
  }

  onAudioData(cb: (buf: Float32Array) => void): void { this.onAudio = cb; }

  async start(): Promise<void> {
    this.restartCount = 0;
    await this.spawn();
  }

  async setFrequency(freqHz: number): Promise<void> {
    this.params.freq = freqHz;
    this.restartCount = 0;
    await this.restart();
  }

  async setGain(gainDb: number): Promise<void> {
    this.params.gain = gainDb;
    this.restartCount = 0;
    await this.restart();
  }

  async setSquelch(squelch: number): Promise<void> {
    this.params.squelch = squelch;
    this.restartCount = 0;
    await this.restart();
  }

  async setMode(mode: string): Promise<void> {
    this.params.mode = mode;
    this.restartCount = 0;
    await this.restart();
  }

  close(): void {
    this._closing = true;
    this.kill();
  }

  private kill(): void {
    if (this.proc) {
      const old = this.proc;
      old.stdout?.removeAllListeners("data");
      old.stderr?.removeAllListeners("data");
      old.removeAllListeners("exit");
      old.removeAllListeners("error");
      try { old.kill(); } catch {}
      this.proc = null;
    }
  }

  private async killAndWait(): Promise<void> {
    if (!this.proc) return;
    const old = this.proc;
    old.stdout?.removeAllListeners("data");
    old.stderr?.removeAllListeners("data");
    old.removeAllListeners("exit");
    old.removeAllListeners("error");

    const exited = new Promise<void>((resolve) => {
      old.once("exit", () => resolve());
    });

    try { old.kill(); } catch {}
    this.proc = null;

    await Promise.race([exited, delay(3000)]);
  }

  private async restart(): Promise<void> {
    if (this._restarting) return;
    this._restarting = true;
    try {
      this.buffer = Buffer.alloc(0);
      if (this.proc) {
        await this.killAndWait();
      }
      await delay(this.backoffDelay());
      await this.spawn();
    } finally {
      this._restarting = false;
    }
  }

  private backoffDelay(): number {
    if (this.restartCount <= 1) return 2000;
    if (this.restartCount <= 3) return 3000;
    if (this.restartCount <= 6) return 5000;
    return 8000;
  }

  private async spawn(): Promise<void> {
    if (this._closing) return;

    const { freq, gain, mode, sampleRate, squelch } = this.params;

    const freqStr = freq >= 1_000_000_000 ? `${(freq / 1_000_000_000).toFixed(3)}G`
                  : freq >= 1_000_000 ? `${(freq / 1_000_000).toFixed(3)}M`
                  : `${freq}`;

    const child = spawn(RTL_FM_PATH, [
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

    this.proc = child;

    child.stdout!.on("data", (data: Buffer) => this.onStdout(data));

    child.stderr!.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error("rtl_fm:", msg);
    });

    child.on("error", (err) => {
      console.error("rtl_fm process error:", err.message);
      if (this.proc === child) this.proc = null;
    });

    child.on("exit", (code, signal) => {
      if (this.proc !== child) return;
      this.proc = null;

      if (this._closing) return;

      if (code === 0) return;

      if (signal !== null || code === null) {
        console.error(`rtl_fm exited abnormally (code=${code}, signal=${signal}), retry #${this.restartCount + 1}`);
        this.restartCount++;
        setTimeout(() => this.restart(), this.backoffDelay());
        return;
      }

      console.error(`rtl_fm exited with code ${code}, restarting...`);
      this.restartCount++;
      setTimeout(() => this.restart(), this.backoffDelay());
    });
  }

  private onStdout(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    const sampleSize = 2;
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
