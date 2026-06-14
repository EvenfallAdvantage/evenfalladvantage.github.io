import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { RTL_SDR_EXE, LIBRTLSDR_DLL } from "./_embedded-bins";

export interface DeviceInfo {
  index: number;
  serial: string;
  manufacturer: string;
  product: string;
}

export type SdrRole = "radio" | "adsb" | "none";

export interface DeviceAssignment {
  radio: number | null;
  adsb: number | null;
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

const RTL_SDR_PATH = findRtlSdr();

export class DeviceManager {
  private catalog: DeviceInfo[] = [];
  private assignments: DeviceAssignment = { radio: null, adsb: null };
  private onCatalogChange: ((catalog: DeviceInfo[], assignments: DeviceAssignment) => void) | null = null;

  onCatalogChanged(cb: (catalog: DeviceInfo[], assignments: DeviceAssignment) => void): void {
    this.onCatalogChange = cb;
  }

  getCatalog(): DeviceInfo[] {
    return this.catalog;
  }

  getAssignments(): DeviceAssignment {
    return { ...this.assignments };
  }

  async enumerate(): Promise<DeviceInfo[]> {
    const devices = await enumerateRtlDevices();
    this.catalog = devices;
    // Auto-assign first available device to radio if not yet assigned
    if (this.assignments.radio === null && devices.length > 0) {
      this.assignments.radio = devices[0].index;
    }
    if (this.assignments.adsb === null && devices.length > 1) {
      this.assignments.adsb = devices[1].index;
    }
    this.notify();
    return devices;
  }

  assignRole(role: "radio" | "adsb", deviceIndex: number | null): { success: true } | { success: false; error: string } {
    if (deviceIndex === null) {
      this.assignments[role] = null;
      this.notify();
      return { success: true };
    }

    // Validate device exists
    const device = this.catalog.find((d) => d.index === deviceIndex);
    if (!device) {
      return { success: false, error: `Device ${deviceIndex} is not connected` };
    }

    // Check for conflict with the other role
    const otherRole = role === "radio" ? "adsb" : "radio";
    if (this.assignments[otherRole] === deviceIndex) {
      return { success: false, error: `Device ${deviceIndex} is already assigned to ${otherRole}` };
    }

    this.assignments[role] = deviceIndex;
    this.notify();
    return { success: true };
  }

  private notify(): void {
    this.onCatalogChange?.(this.catalog, { ...this.assignments });
  }
}

function enumerateRtlDevices(): Promise<DeviceInfo[]> {
  return new Promise((resolve_) => {
    const results: DeviceInfo[] = [];
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timeout); resolve_(results); } };
    const child = spawn(RTL_SDR_PATH, ["-d", "9999"], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const timeout = setTimeout(() => { child.kill(); finish(); }, 10000);

    const parseOutput = (data: Buffer) => {
      const text = data.toString();
      // Format: "  0:  Manufacturer, Product, SN: SerialNumber"
      const regex = /^\s*(\d+):\s*([^,]+),\s*(.+?),\s*SN:\s*(\S+)/gm;
      let match;
      while ((match = regex.exec(text)) !== null) {
        results.push({
          index: parseInt(match[1], 10),
          manufacturer: match[2].trim(),
          product: match[3].trim(),
          serial: match[4].trim(),
        });
      }
    };

    child.stdout!.on("data", parseOutput);
    child.stderr!.on("data", parseOutput);

    child.on("close", () => finish());
    child.on("error", () => finish());
  });
}
