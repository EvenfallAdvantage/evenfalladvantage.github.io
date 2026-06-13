import type { WasmSdrModule } from "./types";
import { BUFFER_SIZE, AUDIO_SAMPLE_RATE, DEFAULT_SAMPLE_RATE, RTL_USB_PRODUCT_IDS, RTL_USB_VENDOR_ID } from "./types";

// ─── WASM LOADER ──────────────────────────────────────────

const WASM_URL = "/overwatch/wasm/rtl-sdr.wasm";

let wasmModule: WasmSdrModule | null = null;
let wasmLoadPromise: Promise<WasmSdrModule> | null = null;

export async function loadWasm(): Promise<WasmSdrModule> {
  if (wasmModule) return wasmModule;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    const response = await fetch(WASM_URL);
    const bytes = await response.arrayBuffer();
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

// ─── RTL2832U USB CONSTANTS ───────────────────────────────

const EP_BULK_IN = 1;

// R820T tuner I2C address (7-bit)
const R820T_I2C_ADDR = 0x34;

// ─── SDR CONTROLLER ───────────────────────────────────────

export class SdrController {
  private device: USBDevice | null = null;
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;
  private audioBuf: Float32Array[] = [];
  private currentFreqHz = 0;
  private useDataPhase = true; // auto-detected

  // ── Connect + RTL2832U Init ─────────────────────────

  private async step(label: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[${label}] ${msg}`);
    }
  }

  /** Run a step; log warning on failure but don't throw */
  private async tryStep(label: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`SDR init: ${label} skipped (${msg})`);
    }
  }

  async connect(): Promise<void> {
    if (!navigator.usb) throw new Error("WebUSB not available");

    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[0] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[1] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[2] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[3] },
        { vendorId: RTL_USB_VENDOR_ID, productId: RTL_USB_PRODUCT_IDS[4] },
      ],
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    this.device = device;

    // Verify vendor control access — if vendor requests stall, driver is wrong
    const vendorOk = await this.testVendorAccess();
    if (!vendorOk) {
      throw new Error(
        "RTL2832U driver rejects vendor control transfers.\n\n" +
        "On Windows, install WinUSB via Zadig:\n" +
        "1. Download https://zadig.akeo.ie/\n" +
        "2. Plug in RTL-SDR\n" +
        "3. Options > List All Devices\n" +
        "4. Select 'Bulk-In, Interface (Interface 0)'\n" +
        "5. Click arrow until 'WinUSB' is shown\n" +
        "6. Replace Driver\n" +
        "7. Unplug/replug and retry",
      );
    }

    // Non-essential — warn but continue on failure
    await this.tryStep("reset EP1", () => this.vendorCtrl(0x01, 0x0001, 0x0000));
    await this.tryStep("set EP1 packet size", () =>
      this.vendorCtrlW(0x81, 0x0002, 0x0000, new Uint8Array([0x00, 0x02])),
    );
    await this.tryStep("XTAL bypass", () =>
      this.vendorCtrlW(0x61, 0x0000, 0x0000, new Uint8Array([0x60, 0x00])),
    );

    // Init RTL2832U demod registers
    await this.step("demod reg 0x01", () => this.demodWrite(0x01, 0x01));
    await this.step("demod reg 0x06", () => this.demodWrite(0x06, 0x0f));
    await this.step("demod reg 0x15", () => this.demodWrite(0x15, 0x00));
    await this.step("demod reg 0x16", () => this.demodWrite(0x16, 0x00));
    await this.step("demod reg 0x17", () => this.demodWrite(0x17, 0x00));
    await this.step("demod reg 0x18", () => this.demodWrite(0x18, 0x00));
    await this.step("demod reg 0x19", () => this.demodWrite(0x19, 0x00));
    await this.step("demod reg 0x1a", () => this.demodWrite(0x1a, 0x00));
    await this.step("demod reg 0x1b", () => this.demodWrite(0x1b, 0x00));
    await this.step("demod reg 0x1c", () => this.demodWrite(0x1c, 0x00));

    // Set sample rate
    await this.step("sample rate", () => this.setSampleRate(DEFAULT_SAMPLE_RATE));

    // Init R820T tuner via I2C
    await this.step("R820T init", () => this.r820tInit());

    // Set initial frequency
    await this.step("tune init", () => this.r820tSetFreq(100_000_000));

    await this.sleep(20);

    // ── Audio pipeline ──
    this.audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 0.7;
    this.gainNode.connect(this.audioCtx.destination);

    this.active = true;
  }

  disconnect(): void {
    this.active = false;
    this.audioBuf = [];

    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
      this.gainNode = null;
    }
    if (this.device) {
      try { this.device.close(); } catch { /* ignore */ }
      this.device = null;
    }
  }

  isConnected(): boolean {
    return this.device !== null && this.active;
  }

  // ── Public Controls ─────────────────────────────────

  async setFrequency(freqHz: number): Promise<void> {
    this.currentFreqHz = freqHz;
    if (!this.device || !this.active) return;

    await this.demodWrite(0x01, 0x11); // I2C repeater on
    await this.r820tSetFreq(freqHz);
    await this.demodWrite(0x01, 0x01); // I2C repeater off
  }

  async setGain(gainDb: number): Promise<void> {
    if (!this.device || !this.active) return;

    const idx = Math.max(0, Math.min(49, Math.round(gainDb)));
    const lnaGain = Math.min(15, Math.floor(idx / 3));
    const mixerGain = Math.min(15, idx % 3 === 0 ? 0 : (idx % 3) * 5 + 5);

    await this.demodWrite(0x01, 0x11); // I2C repeater on
    await this.i2cWrite(R820T_I2C_ADDR, 0x0d, (lnaGain << 4) | 0x00);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0c, 0x9f | (mixerGain << 4));
    await this.demodWrite(0x01, 0x01); // I2C repeater off
  }

  setVolume(v: number): void {
    if (this.gainNode) this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  // ── Streaming ───────────────────────────────────────

  startStream(onSignalLevel: (level: number) => void): void {
    if (!this.audioCtx) return;
    this.audioBuf = [];

    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 0, 1);
    this.scriptNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const buf = this.audioBuf.shift();
      if (buf) {
        output.set(buf.subarray(0, output.length));
        onSignalLevel(this.rms(buf));
      }
    };
    this.scriptNode.connect(this.gainNode!);
  }

  feedAudio(samples: Float32Array): void {
    this.audioBuf.push(samples);
  }

  async readBulk(): Promise<DataView | null> {
    if (!this.device) return null;
    try {
      const result = await this.device.transferIn(EP_BULK_IN, BUFFER_SIZE);
      return result.data ?? null;
    } catch {
      return null;
    }
  }

  // ── RTL2832U Demod Register Write ─────────────────────

  /**
   * Auto-detect register write format:
   * 1. Try data-phase format (librtlsdr): wValue=addr, wIndex=page, data=[val]
   * 2. On stall, fall back to wIndex format: wValue=addr, wIndex=val, no data
   */
  private async demodWrite(addr: number, val: number, page: number = 0): Promise<void> {
    if (this.useDataPhase) {
      try {
        await this.device!.controlTransferOut({
          requestType: "vendor",
          recipient: "device",
          request: 0x04,
          value: addr,
          index: page,
        }, new Uint8Array([val]));
        return;
      } catch {
        console.warn(`SDR init: switching to wIndex format after stall on 0x${addr.toString(16)}`);
        this.useDataPhase = false;
      }
    }

    // Fallback: value in wIndex, no data phase
    await this.device!.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request: 0x04,
      value: addr,
      index: val,
    });
  }

  private async demodRead(addr: number, page: number = 0): Promise<number> {
    const result = await this.device!.controlTransferIn({
      requestType: "vendor",
      recipient: "device",
      request: 0x05,
      value: addr,
      index: page,
    }, 1);
    return result.data?.getUint8(0) ?? 0;
  }

  // ── Vendor Access Test ──────────────────────────────────

  /** Probe device to verify vendor control transfers work */
  private async testVendorAccess(): Promise<boolean> {
    // Try data-phase format first (librtlsdr style)
    try {
      await this.device!.controlTransferOut({
        requestType: "vendor",
        recipient: "device",
        request: 0x04,
        value: 0x01,
        index: 0x00,
      }, new Uint8Array([0x01]));
      return true;
    } catch {
      // Fall back to wIndex-encoded format (no data phase)
      try {
        await this.device!.controlTransferOut({
          requestType: "vendor",
          recipient: "device",
          request: 0x04,
          value: 0x01,
          index: 0x01,
        });
        this.useDataPhase = false;
        return true;
      } catch {
        return false;
      }
    }
  }

  // ── USB Vendor Control Transfers ─────────────────────

  /** OUT, no data phase */
  private async vendorCtrl(request: number, value: number, index: number): Promise<void> {
    await this.device!.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    });
  }

  /** OUT, with data buffer */
  private async vendorCtrlW(request: number, value: number, index: number, data: Uint8Array): Promise<void> {
    await this.device!.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    }, data as BufferSource);
  }

  // ── I2C Access (tuner communication) ─────────────────

  /**
   * Write to a tuner register via the RTL2832U I2C master.
   *   reg 0x1b = tuner register address
   *   reg 0x19 = data byte
   *   reg 0x1c = control byte (addr << 1 | direction | start)
   */
  private async i2cWrite(i2cAddr: number, reg: number, val: number): Promise<void> {
    await this.demodWrite(0x1b, reg);
    await this.demodWrite(0x19, val);
    await this.demodWrite(0x1c, (i2cAddr << 1) | 0x01);
    await this.sleep(1);
  }

  private async i2cRead(i2cAddr: number, reg: number): Promise<number> {
    await this.demodWrite(0x1b, reg);
    await this.demodWrite(0x1c, (i2cAddr << 1) | 0x01);
    await this.sleep(1);
    await this.demodWrite(0x1c, (i2cAddr << 1) | 0x11);
    await this.sleep(1);
    return this.demodRead(0x19);
  }

  // ── Sample Rate ────────────────────────────────────────

  private async setSampleRate(sampleRate: number): Promise<void> {
    // rsamp_ratio = floor(28.8 MHz / sampleRate)
    // For 1.024 MHz: floor(28.8 / 1.024) = 28
    const rtlXtal = 28_800_000;
    const ratio = Math.floor(rtlXtal / sampleRate);

    await this.demodWrite(0x9f, (ratio >> 16) & 0x3f);
    await this.demodWrite(0x9e, (ratio >> 8) & 0xff);
    await this.demodWrite(0x9d, ratio & 0xff);

    // High-speed ADC mode
    await this.demodWrite(0x06, sampleRate > 2_400_000 ? 0x13 : 0x0f);
  }

  // ── R820T Tuner Init ────────────────────────────────────

  private async r820tInit(): Promise<void> {
    await this.demodWrite(0x01, 0x11); // I2C repeater on

    // Init register table from librtlsdr
    const initRegs: [number, number][] = [
      [0x05, 0x00], [0x06, 0x00], [0x07, 0x00], [0x08, 0x40],
      [0x09, 0x80], [0x0a, 0x00], [0x0b, 0x00], [0x0c, 0x9f],
      [0x0d, 0x00], [0x0e, 0x40], [0x0f, 0x40], [0x10, 0x00],
      [0x11, 0x00], [0x12, 0x00], [0x13, 0x00], [0x14, 0x00],
      [0x15, 0x00], [0x16, 0x00], [0x17, 0x50], [0x18, 0x40],
      [0x19, 0x00], [0x1a, 0x00], [0x1b, 0x00], [0x1c, 0x00],
      [0x1d, 0x00], [0x1e, 0x00], [0x1f, 0x40], [0x20, 0x40],
      [0x21, 0x00], [0x22, 0x00], [0x23, 0x00], [0x24, 0xc0],
      [0x25, 0x00], [0x26, 0x00], [0x27, 0x30], [0x28, 0x00],
      [0x29, 0x00], [0x2a, 0x00], [0x2b, 0x00], [0x2c, 0x00],
      [0x2d, 0x00], [0x2e, 0x00], [0x2f, 0x00], [0x30, 0x00],
      [0x31, 0x00], [0x32, 0x00], [0x33, 0x00], [0x34, 0x00],
      [0x35, 0x00], [0x36, 0x00], [0x37, 0x00], [0x38, 0x00],
      [0x39, 0x00], [0x3a, 0x00], [0x3b, 0x00], [0x3c, 0x00],
      [0x3d, 0x00], [0x3e, 0x00], [0x3f, 0x80],
    ];

    for (const [reg, val] of initRegs) {
      await this.i2cWrite(R820T_I2C_ADDR, reg, val);
    }

    await this.sleep(10);

    // Verify chip ID
    const id = await this.i2cRead(R820T_I2C_ADDR, 0x00);
    if ((id & 0xF0) !== 0x50) {
      console.warn(`R820T chip ID mismatch: 0x${id.toString(16)} (expected 0x5x)`);
    }

    await this.demodWrite(0x01, 0x01); // I2C repeater off
  }

  // ── R820T Frequency Tuning ──────────────────────────────

  private async r820tSetFreq(freqHz: number): Promise<void> {
    // VCO divider selection — keep VCO in 1770–3630 MHz range
    let div = 1;
    let vcoFreq = freqHz;
    while (vcoFreq < 1_770_000_000 && div <= 64) {
      div *= 2;
      vcoFreq = freqHz * div;
    }
    if (vcoFreq > 3_630_000_000) {
      div /= 2;
      vcoFreq = freqHz * div;
    }

    // Divider register mapping: bits 4-6 of reg 0x08
    const divCode: Record<number, number> = { 1: 0, 2: 1, 4: 2, 8: 3, 16: 4, 32: 5, 64: 6 };
    const code = divCode[div] ?? 2;

    // Fractional-N PLL
    const xtal = 16_000_000;
    const nint = Math.floor(vcoFreq / xtal);
    const frac = vcoFreq % xtal;
    const fracBits = Math.round((frac / xtal) * 4096);

    await this.i2cWrite(R820T_I2C_ADDR, 0x07, 0x00);
    await this.i2cWrite(R820T_I2C_ADDR, 0x08, 0x40 | (code << 4));
    await this.i2cWrite(R820T_I2C_ADDR, 0x09, nint & 0xff);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0a, ((nint >> 8) & 0x0f) | ((fracBits >> 4) & 0xf0));
    await this.i2cWrite(R820T_I2C_ADDR, 0x0b, ((fracBits & 0x0f) << 4) | 0x08);

    // Filter bandwidth
    let filt = 0;
    if (freqHz >= 900_000_000) filt = 0x60;
    else if (freqHz >= 600_000_000) filt = 0x50;
    else if (freqHz >= 400_000_000) filt = 0x40;
    else if (freqHz >= 200_000_000) filt = 0x30;
    else if (freqHz >= 100_000_000) filt = 0x20;
    else if (freqHz >= 50_000_000) filt = 0x10;
    await this.i2cWrite(R820T_I2C_ADDR, 0x0e, filt);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0f, filt);

    // Calibration
    await this.i2cWrite(R820T_I2C_ADDR, 0x13, 0x00);
    await this.sleep(5);
    await this.i2cWrite(R820T_I2C_ADDR, 0x13, 0x40);
    await this.sleep(10);

    this.currentFreqHz = freqHz;
  }

  // ── Utility ─────────────────────────────────────────

  private rms(buf: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// ─── FACTORY ──────────────────────────────────────────────

let controllerInstance: SdrController | null = null;

export function getSdrController(): SdrController {
  if (!controllerInstance) {
    controllerInstance = new SdrController();
  }
  return controllerInstance;
}

export function destroySdrController(): void {
  if (controllerInstance) {
    controllerInstance.disconnect();
    controllerInstance = null;
  }
}
