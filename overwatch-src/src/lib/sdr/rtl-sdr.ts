import type { WasmSdrModule } from "./types";
import { BUFFER_SIZE, AUDIO_SAMPLE_RATE, DEFAULT_SAMPLE_RATE, RTL_USB_PRODUCT_IDS, RTL_USB_VENDOR_ID } from "./types";

const WASM_URL = "/overwatch/wasm/rtl-sdr.wasm";

let wasmModule: WasmSdrModule | null = null;
let wasmLoadPromise: Promise<WasmSdrModule> | null = null;

export async function loadWasm(): Promise<WasmSdrModule> {
  if (wasmModule) return wasmModule;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    const r = await fetch(WASM_URL);
    const bytes = await r.arrayBuffer();
    const result = await WebAssembly.instantiate(bytes, {
      env: { memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }) },
    });
    wasmModule = result.instance.exports as unknown as WasmSdrModule;
    wasmModule.sdr_init();
    return wasmModule;
  })();

  return wasmLoadPromise;
}

export function getWasm(): WasmSdrModule | null {
  return wasmModule;
}

const EP_BULK_IN = 1;
const R820T_I2C = 0x34;
const RTL_XTAL = 28_800_000;

export class SdrController {
  private device: USBDevice | null = null;
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;
  private audioBuf: Float32Array[] = [];
  private currentFreqHz = 0;
  private vendorOk = false;

  // ── Connect ───────────────────────────────────────────

  async connect(): Promise<void> {
    if (!navigator.usb) throw new Error("WebUSB not available");

    const d = await navigator.usb.requestDevice({
      filters: [
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[0] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[1] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[2] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[3] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[4] },
      ],
    });

    await d.open();
    await d.selectConfiguration(1);
    await d.claimInterface(0);
    this.device = d;

    await this.initVendor();

    this.audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 0.7;
    this.gainNode.connect(this.audioCtx.destination);
    this.active = true;
  }

  disconnect(): void {
    this.active = false;
    this.audioBuf = [];
    if (this.scriptNode) { try { this.scriptNode.disconnect(); } catch {} this.scriptNode = null; }
    if (this.gainNode) { try { this.gainNode.disconnect(); } catch {} this.gainNode = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
    if (this.device) { try { this.device.close(); } catch {} this.device = null; }
  }

  isConnected(): boolean {
    return this.active && this.device !== null;
  }

  // ── Public controls ──────────────────────────────────

  async setFrequency(freqHz: number): Promise<void> {
    if (!this.vendorOk) return;
    this.currentFreqHz = freqHz;
    this.audioBuf = [];
    if (!this.active || !this.device) return;
    await this.demodWrite(0x01, 0x11);
    await this.r820tSetFreq(freqHz);
    await this.demodWrite(0x01, 0x01);
  }

  async setGain(gainDb: number): Promise<void> {
    if (!this.vendorOk || !this.active || !this.device) return;
    const idx = Math.max(0, Math.min(49, Math.round(gainDb)));
    const lna = Math.min(15, Math.floor(idx / 3));
    const mix = Math.min(15, idx % 3 === 0 ? 0 : (idx % 3) * 5 + 5);
    await this.demodWrite(0x01, 0x11);
    await this.i2cWrite(0x0d, (lna << 4) | 0x00);
    await this.i2cWrite(0x0c, 0x9f | (mix << 4));
    await this.demodWrite(0x01, 0x01);
  }

  setVolume(v: number): void {
    if (this.gainNode) this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  async setSquelch(_squelch: number): Promise<void> {
    // squelch controlled by the RTL-SDR directly; NOP for WebUSB path
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  // ── Streaming ────────────────────────────────────────

  startStream(onLevel: (l: number) => void): void {
    if (!this.audioCtx) return;
    this.audioBuf = [];
    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 0, 1);
    this.scriptNode.onaudioprocess = (e) => {
      if (!this.active) return;
      const out = e.outputBuffer.getChannelData(0);
      const buf = this.audioBuf;
      let written = 0;
      while (written < out.length && buf.length > 0) {
        const chunk = buf[0];
        const needed = out.length - written;
        if (chunk.length <= needed) {
          out.set(chunk, written);
          written += chunk.length;
          buf.shift();
        } else {
          out.set(chunk.subarray(0, needed), written);
          buf[0] = chunk.subarray(needed);
          written = out.length;
        }
      }
      let s = 0;
      for (let i = 0; i < out.length; i++) s += out[i] * out[i];
      onLevel(Math.sqrt(s / out.length));
    };
    this.scriptNode.connect(this.gainNode!);
  }

  feedAudio(s: Float32Array): void { this.audioBuf.push(s); }

  async readBulk(): Promise<DataView | null> {
    if (!this.device) return null;
    try { const r = await this.device.transferIn(EP_BULK_IN, BUFFER_SIZE); return r.data ?? null; }
    catch { return null; }
  }

  // ── Vendor init (best-effort, non-fatal) ─────────────

  private async initVendor(): Promise<void> {
    // RTL2832U uses vendor control transfers with NO data phase (wLength=0).
    // The register value is passed in wIndex, address in wValue.
    // Including a data phase (wLength > 0) will cause the device to STALL.
    await this.tryCtrl("reset EP1", () =>
      this.vendorCtrl(0x01, 0x0001, 0x0000),
    );
    await this.tryCtrl("set pkt size", () =>
      this.vendorCtrl(0x81, 0x0002, 0x0000),
    );
    await this.tryCtrl("XTAL bypass", () =>
      this.vendorCtrl(0x61, 0x0000, 0x0000),
    );
    await this.sleep(5);

    // Essential: configure demod + tuner. If any register write fails, give up.
    try {
      await this.demodWrite(0x01, 0x01);
      await this.demodWrite(0x06, 0x0f);
      for (const r of [0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c]) await this.demodWrite(r, 0x00);
      await this.setSampleRate(DEFAULT_SAMPLE_RATE);
      await this.r820tInit();
      await this.r820tSetFreq(100_000_000);
      await this.sleep(20);
      this.vendorOk = true;
    } catch (err) {
      console.warn("SDR: vendor init failed — using hardware defaults", err);
    }
  }

  private async tryCtrl(label: string, fn: () => Promise<unknown>): Promise<void> {
    try { await fn(); } catch { console.warn(`SDR: ${label} skipped`); }
  }

  // ── Generic vendor control transfer (no data phase) ──────

  private async vendorCtrl(request: number, value: number, index: number): Promise<void> {
    await this.device!.controlTransferOut({ requestType: "vendor", recipient: "device", request, value, index });
  }

  // ── Demod register write ──────────────────────────────
  //
  // RTL2832U protocol: bmRequestType=0x40 (vendor/device/host-to-dev),
  // bRequest=0x04, wValue=register_addr, wIndex=register_val, wLength=0.
  // The correct format is therefore request=0x04, recipient="device",
  // value=addr, index=val, NO data phase.
  //
  // We try this format first. If it stalls (unlikely on properly bound
  // WinUSB), we try recipient="interface" as a last resort.

  private async demodWrite(addr: number, val: number): Promise<void> {
    const err: unknown[] = [];

    for (const recipient of ["device" as const, "interface" as const]) {
      try {
        await this.device!.controlTransferOut({ requestType: "vendor", recipient, request: 0x04, value: addr, index: val });
        return;
      } catch (e) {
        err.push(e);
        await this.sleep(10);
      }
    }
    throw new Error(`demodWrite(0x${addr.toString(16)},${val}) stalled: ${err.map((e) => String(e)).join(" | ")}`);
  }

  // ── I2C (tuner access through RTL2832U) ──────────────

  private async i2cWrite(reg: number, val: number): Promise<void> {
    await this.demodWrite(0x1b, reg);
    await this.demodWrite(0x19, val);
    await this.demodWrite(0x1c, (R820T_I2C << 1) | 0x01);
    await this.sleep(1);
  }

  // ── Sample rate ──────────────────────────────────────

  private async setSampleRate(sr: number): Promise<void> {
    const ratio = Math.floor(RTL_XTAL / sr);
    await this.demodWrite(0x9f, (ratio >> 16) & 0x3f);
    await this.demodWrite(0x9e, (ratio >> 8) & 0xff);
    await this.demodWrite(0x9d, ratio & 0xff);
    await this.demodWrite(0x06, sr > 2_400_000 ? 0x13 : 0x0f);
  }

  // ── R820T Tuner Init ─────────────────────────────────

  private async r820tInit(): Promise<void> {
    await this.demodWrite(0x01, 0x11);

    const tbl: [number, number][] = [
      [0x05,0x00],[0x06,0x00],[0x07,0x00],[0x08,0x40],[0x09,0x80],[0x0a,0x00],[0x0b,0x00],[0x0c,0x9f],
      [0x0d,0x00],[0x0e,0x40],[0x0f,0x40],[0x10,0x00],[0x11,0x00],[0x12,0x00],[0x13,0x00],[0x14,0x00],
      [0x15,0x00],[0x16,0x00],[0x17,0x50],[0x18,0x40],[0x19,0x00],[0x1a,0x00],[0x1b,0x00],[0x1c,0x00],
      [0x1d,0x00],[0x1e,0x00],[0x1f,0x40],[0x20,0x40],[0x21,0x00],[0x22,0x00],[0x23,0x00],[0x24,0xc0],
      [0x25,0x00],[0x26,0x00],[0x27,0x30],[0x28,0x00],[0x29,0x00],[0x2a,0x00],[0x2b,0x00],[0x2c,0x00],
      [0x2d,0x00],[0x2e,0x00],[0x2f,0x00],[0x30,0x00],[0x31,0x00],[0x32,0x00],[0x33,0x00],[0x34,0x00],
      [0x35,0x00],[0x36,0x00],[0x37,0x00],[0x38,0x00],[0x39,0x00],[0x3a,0x00],[0x3b,0x00],[0x3c,0x00],
      [0x3d,0x00],[0x3e,0x00],[0x3f,0x80],
    ];
    for (const [r, v] of tbl) await this.i2cWrite(r, v);
    await this.sleep(10);
    await this.demodWrite(0x01, 0x01);
  }

  // ── R820T Tune ───────────────────────────────────────

  private async r820tSetFreq(freqHz: number): Promise<void> {
    let div = 1;
    let vco = freqHz;
    while (vco < 1_770_000_000 && div <= 64) { div *= 2; vco = freqHz * div; }
    if (vco > 3_630_000_000) { div /= 2; vco = freqHz * div; }

    const dc: Record<number,number> = { 1:0, 2:1, 4:2, 8:3, 16:4, 32:5, 64:6 };
    const code = dc[div] ?? 2;
    const xtal = 16_000_000;
    const nint = Math.floor(vco / xtal);
    const frac = Math.round(((vco % xtal) / xtal) * 4096);

    await this.i2cWrite(0x07, 0x00);
    await this.i2cWrite(0x08, 0x40 | (code << 4));
    await this.i2cWrite(0x09, nint & 0xff);
    await this.i2cWrite(0x0a, ((nint >> 8) & 0x0f) | ((frac >> 4) & 0xf0));
    await this.i2cWrite(0x0b, ((frac & 0x0f) << 4) | 0x08);
    const filt = freqHz >= 900_000_000 ? 0x60 : freqHz >= 600_000_000 ? 0x50 : freqHz >= 400_000_000 ? 0x40 : freqHz >= 200_000_000 ? 0x30 : freqHz >= 100_000_000 ? 0x20 : freqHz >= 50_000_000 ? 0x10 : 0x00;
    await this.i2cWrite(0x0e, filt);
    await this.i2cWrite(0x0f, filt);
    await this.i2cWrite(0x13, 0x00);
    await this.sleep(5);
    await this.i2cWrite(0x13, 0x40);
    await this.sleep(10);
    this.currentFreqHz = freqHz;
  }

  // ── Utility ──────────────────────────────────────────

  private rms(buf: Float32Array): number {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ── Factory ─────────────────────────────────────────────

let instance: SdrController | null = null;

export function getSdrController(): SdrController {
  if (!instance) instance = new SdrController();
  return instance;
}

export function destroySdrController(): void {
  if (instance) { instance.disconnect(); instance = null; }
}
