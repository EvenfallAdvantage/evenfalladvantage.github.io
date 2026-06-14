import { spawn, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { RTL_ADSB_EXE, RTL_SDR_EXE, LIBRTLSDR_DLL } from "./_embedded-bins";
import Decoder from "mode-s-decoder";
import AircraftStore from "mode-s-aircraft-store";

export interface AdsbAircraft {
  icao24: string;
  callsign: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  onGround: boolean;
  lastContact: number;
}

export type AdsbAircraftMap = Record<string, AdsbAircraft>;

function findRtlAdsb(): string {
  const candidates: string[] = [];
  candidates.push(resolve(dirname(process.execPath), "rtlsdr-bin", "rtl_adsb.exe"));
  try { candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), "../rtlsdr-bin/rtl_adsb.exe")); } catch { /* ignore */ }
  candidates.push(resolve(process.cwd(), "rtlsdr-bin", "rtl_adsb.exe"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const tmpDir = extractEmbeddedAdsb();
  const p = resolve(tmpDir, "rtl_adsb.exe");
  if (existsSync(p)) return p;
  return candidates[0];
}

function extractEmbeddedAdsb(): string {
  const tmpDir = resolve(tmpdir(), "sdr-companion-rtlsdr");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const exePath = resolve(tmpDir, "rtl_adsb.exe");
  const dllPath = resolve(tmpDir, "librtlsdr.dll");
  writeFileSync(exePath, Buffer.from(RTL_ADSB_EXE, "base64"));
  writeFileSync(dllPath, Buffer.from(LIBRTLSDR_DLL, "base64"));
  return tmpDir;
}

const RTL_ADSB_PATH = findRtlAdsb();
const RTL_SDR_PATH = findRtlSdr();
console.log(`SDR: rtl_adsb = ${RTL_ADSB_PATH} (exists=${existsSync(RTL_ADSB_PATH)})`);
console.log(`SDR: rtl_sdr  = ${RTL_SDR_PATH} (exists=${existsSync(RTL_SDR_PATH)})`);

export class AdsbProcessor {
  private proc: ChildProcess | null = null;
  private decoder: Decoder;
  private store: AircraftStore;
  private onAircraft: ((batch: AdsbAircraftMap) => void) | null = null;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private _running = false;
  private deviceIndex: number;

  constructor(deviceIndex = 1) {
    this.decoder = new Decoder();
    this.store = new AircraftStore({ timeout: 120000 });
    this.deviceIndex = deviceIndex;
  }

  onAircraftData(cb: (batch: AdsbAircraftMap) => void): void {
    this.onAircraft = cb;
  }

  get running(): boolean { return this._running; }

  async start(): Promise<void> {
    if (this._running) return;
    this._running = true;

    const child = spawn(RTL_ADSB_PATH, [
      "-d", String(this.deviceIndex),
    ], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    this.proc = child;

    child.stdout!.on("data", (data: Buffer) => this.onStdout(data));

    child.stderr!.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error("rtl_adsb:", msg);
    });

    child.on("error", (err) => {
      console.error("rtl_adsb process error:", err.message);
      if (this.proc === child) this.proc = null;
    });

    child.on("exit", (code, signal) => {
      if (this.proc !== child) return;
      this.proc = null;
      this._running = false;
      console.error(`rtl_adsb exited (code=${code}, signal=${signal})`);
    });

    this.broadcastTimer = setInterval(() => this.broadcast(), 2000);
  }

  async setDevice(index: number): Promise<void> {
    this.deviceIndex = index;
    this.stop();
    await this.start();
  }

  stop(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
    if (this.proc) {
      const old = this.proc;
      old.stdout?.removeAllListeners("data");
      old.stderr?.removeAllListeners("data");
      old.removeAllListeners("exit");
      old.removeAllListeners("error");
      try { old.kill(); } catch { /* ignore */ }
      if (this.proc === old) this.proc = null;
    }
    this._running = false;
  }

  private onStdout(data: Buffer): void {
    const text = data.toString("utf-8");
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // rtl_adsb outputs lines like: *8D406B902015A678FBD6C8D387;
      if (trimmed.startsWith("*") && trimmed.endsWith(";")) {
        const hex = trimmed.slice(1, -1);
        try {
          const msg = this.decoder.parse(Buffer.from(hex, "hex"));
          if (msg && msg.crcOk) {
            this.store.addMessage(msg);
          }
        } catch { /* skip malformed frames */ }
      }
    }
  }

  private broadcast(): void {
    if (!this.onAircraft) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list: any[] = this.store.getAircrafts();
    const batch: AdsbAircraftMap = {};
    for (const a of list) {
      batch[a.icao] = {
        icao24: a.icao,
        callsign: a.callsign || "",
        lat: a.lat ?? null,
        lng: a.lng ?? null,
        altitude: a.altitude ?? null,
        velocity: a.speed ?? null,
        heading: a.heading ?? null,
        verticalRate: a.vertRate ?? null,
        onGround: false,
        lastContact: a.seen ?? Date.now(),
      };
    }
    if (Object.keys(batch).length > 0) {
      this.onAircraft(batch);
    }
  }
}

export async function enumerateAdsbDevices(): Promise<string[]> {
  // Use rtl_sdr to list devices: rtl_sdr -d 9999 outputs device info then exits
  // We just look for "Found N device(s)" or parse serials
  return new Promise((resolve_) => {
    const results: string[] = [];
    const child = spawn(RTL_SDR_PATH, ["-d", "9999"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const timeout = setTimeout(() => { child.kill(); resolve_(results); }, 5000);

    child.stdout!.on("data", (data: Buffer) => {
      const text = data.toString();
      // Parse lines like: "  0:  Realtek, RTL2838UHIDIR, SN: 00000001"
      const regex = /^\s*(\d+):\s*.+SN:\s*(\S+)/gm;
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push(match[2]);
      }
    });

    child.on("exit", () => {
      clearTimeout(timeout);
      resolve_(results);
    });

    child.on("error", () => {
      clearTimeout(timeout);
      resolve_(results);
    });
  });
}

function extractEmbeddedSdr(): string {
  const tmpDir = resolve(tmpdir(), "sdr-companion-rtlsdr");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const exePath = resolve(tmpDir, "rtl_sdr.exe");
  const dllPath = resolve(tmpDir, "librtlsdr.dll");
  writeFileSync(exePath, Buffer.from(RTL_SDR_EXE, "base64"));
  writeFileSync(dllPath, Buffer.from(LIBRTLSDR_DLL, "base64"));
  return tmpDir;
}

function findRtlSdr(): string {
  const candidates: string[] = [];
  candidates.push(resolve(dirname(process.execPath), "rtlsdr-bin", "rtl_sdr.exe"));
  try { candidates.push(resolve(dirname(fileURLToPath(import.meta.url)), "../rtlsdr-bin/rtl_sdr.exe")); } catch { /* ignore */ }
  candidates.push(resolve(process.cwd(), "rtlsdr-bin", "rtl_sdr.exe"));
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  const tmpDir = extractEmbeddedSdr();
  const p = resolve(tmpDir, "rtl_sdr.exe");
  if (existsSync(p)) return p;
  return candidates[0];
}
