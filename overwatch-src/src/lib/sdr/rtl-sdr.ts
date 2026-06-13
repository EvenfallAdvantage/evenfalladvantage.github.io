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

// RTL2832U register block
const BLOCK_DEMOD = 0x00;

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

  // ── Connect + Full RTL2832U Init ─────────────────────

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

    // ── RTL2832U Initialization Sequence ──

    // 1. Reset USB endpoint pipes
    await this.ctrlTrx(0x01, 0x0000, 0x0000);
    await this.ctrlTrx(0x01, 0x0002, 0x0000);

    // 2. Set EP1 bulk max packet size to 512 bytes
    await this.ctrlTrxBuf(0x81, 0x0002, 0x0000, new Uint8Array([0x00, 0x02]));

    // 3. Bypass XTAL filter + enable AGC
    await this.ctrlTrxBuf(0x61, 0x0000, 0x0000, new Uint8Array([0x60, 0x00]));

    // 4. Initialize RTL2832U demod registers
    //    Set I/Q output format, disable decimation, configure filters
    await this.rtlWriteReg(0x01, 0x00); // demod output = I/Q interleaved
    await this.rtlWriteReg(0x06, 0x0f); // disable decimation
    await this.rtlWriteReg(0x15, 0x00); // disable DSP
    await this.rtlWriteReg(0x16, 0x00); // disable AGC
    await this.rtlWriteReg(0x17, 0x00);
    await this.rtlWriteReg(0x18, 0x00);
    await this.rtlWriteReg(0x19, 0x00); // I2C data output
    await this.rtlWriteReg(0x1a, 0x00); // I2C clock
    await this.rtlWriteReg(0x1b, 0x00); // I2C reg addr
    await this.rtlWriteReg(0x1c, 0x00); // I2C control

    // 5. Configure sample rate registers
    await this.setSampleRate(DEFAULT_SAMPLE_RATE);

    // 6. Set AGC parameters
    await this.rtlWriteReg(0x0c, 0x9b); // AGC target level
    await this.rtlWriteReg(0x0d, 0x82); // AGC threshold
    await this.rtlWriteReg(0x0e, 0x82);
    await this.rtlWriteReg(0x0f, 0x00); // AGC enable = manual
    await this.rtlWriteReg(0x10, 0x00);
    await this.rtlWriteReg(0x11, 0x00);
    await this.rtlWriteReg(0x12, 0x00);
    await this.rtlWriteReg(0x13, 0x00);
    await this.rtlWriteReg(0x14, 0x00);
    await this.rtlWriteReg(0x15, 0x00);

    // 7. Initialize R820T tuner via I2C
    await this.r820tInit();

    // 8. Set initial frequency (100 MHz)
    await this.r820tSetFreq(100_000_000);

    // 9. Enable I/Q streaming
    await this.rtlWriteReg(0x01, 0x01); // output enable

    // ── Set up audio pipeline ──

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

    // I2C repeater on (RTL2832U register 0x01 = 0x11)
    await this.rtlWriteReg(0x01, 0x11);

    await this.r820tSetFreq(freqHz);

    // I2C repeater off
    await this.rtlWriteReg(0x01, 0x01);
  }

  getFrequency(): number {
    return this.currentFreqHz;
  }

  async setGain(gainDb: number): Promise<void> {
    if (!this.device || !this.active) return;

    // R820T gain index: 0-49 maps to specific gain settings
    // The R820T uses LNA gain + mixer gain + VGA gain
    const gainIdx = Math.max(0, Math.min(49, Math.round(gainDb)));

    // I2C repeater on
    await this.rtlWriteReg(0x01, 0x11);

    // Set LNA gain (reg 0x0d): higher nibble
    // Set mixer gain (reg 0x0c): lower nibble
    // Simplified: map gainIdx to register values
    const lnaGain = Math.min(15, Math.floor(gainIdx / 3));
    const mixerGain = Math.min(15, gainIdx % 3 === 0 ? 0 : (gainIdx % 3) * 5 + 5);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0d, (lnaGain << 4) | 0x00);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0c, 0x9f | (mixerGain << 4));

    // I2C repeater off
    await this.rtlWriteReg(0x01, 0x01);
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

  // ── RTL2832U Register Access ─────────────────────────

  private async rtlWriteReg(addr: number, val: number, page: number = 0): Promise<void> {
    const wValue = ((page & 0xff) << 8) | (addr & 0xff);
    const wIndex = ((BLOCK_DEMOD & 0xff) << 8) | (val & 0xff);
    await this.device!.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request: 0x04,
      value: wValue,
      index: wIndex,
    });
  }

  private async rtlReadReg(addr: number, page: number = 0): Promise<number> {
    const wValue = ((page & 0xff) << 8) | (addr & 0xff);
    const result = await this.device!.controlTransferIn({
      requestType: "vendor",
      recipient: "device",
      request: 0x05,
      value: wValue,
      index: (BLOCK_DEMOD & 0xff) << 8,
    }, 1);
    return result.data?.getUint8(0) ?? 0;
  }

  // ── USB Bulk Control Transfers ───────────────────────

  /** Simple control transfer (no data phase) */
  private async ctrlTrx(request: number, value: number, index: number): Promise<void> {
    await this.device!.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    });
  }

  /** Control transfer with OUT data buffer */
  private async ctrlTrxBuf(request: number, value: number, index: number, data: Uint8Array): Promise<void> {
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
   * Write to a tuner register via the RTL2832U's I2C master.
   * Register layout:
   *   0x1B = I2C register address (tuner reg)
   *   0x19 = I2C data byte
   *   0x1C = I2C control (bits 6:0 = slave addr, bit 7 = start/stop)
   */
  private async i2cWrite(i2cAddr: number, reg: number, val: number): Promise<void> {
    await this.rtlWriteReg(0x1b, reg);
    await this.rtlWriteReg(0x19, val);
    await this.rtlWriteReg(0x1c, (i2cAddr << 1) | 0x01); // write, start
    await this.sleep(1);
  }

  private async i2cRead(i2cAddr: number, reg: number): Promise<number> {
    await this.rtlWriteReg(0x1b, reg);
    await this.rtlWriteReg(0x1c, (i2cAddr << 1) | 0x01); // write reg addr first
    await this.sleep(1);
    await this.rtlWriteReg(0x1c, (i2cAddr << 1) | 0x11); // restart + read
    await this.sleep(1);
    return this.rtlReadReg(0x19);
  }

  // ── Sample Rate Configuration ──────────────────────────

  private async setSampleRate(sampleRate: number): Promise<void> {
    // RTL2832U sample rate = 28.8 MHz / (rsamp_ratio + 1)
    // rsamp_ratio = (28_800_000 / sampleRate) - 1
    const rsampRatio = Math.round(28_800_000 / sampleRate) - 1;

    const rsampHi = (rsampRatio >> 16) & 0xff;
    const rsampMid = (rsampRatio >> 8) & 0xff;
    const rsampLo = rsampRatio & 0xff;

    await this.rtlWriteReg(0x9f, rsampHi);
    await this.rtlWriteReg(0x9e, rsampMid);
    await this.rtlWriteReg(0x9d, rsampLo);

    // Set high-speed ADC mode if needed
    if (sampleRate > 2_400_000) {
      await this.rtlWriteReg(0x06, 0x13);
    } else {
      await this.rtlWriteReg(0x06, 0x0f);
    }
  }

  // ── R820T Tuner Initialization ──────────────────────────

  private async r820tInit(): Promise<void> {
    // Enable I2C repeater
    await this.rtlWriteReg(0x01, 0x11);

    // R820T init register table (from librtlsdr)
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

    // Write init table (skip reg 0x05 which is AFC)
    for (const [reg, val] of initRegs) {
      await this.i2cWrite(R820T_I2C_ADDR, reg, val);
    }

    // The R820T needs some settling time
    await this.sleep(10);

    // Check chip ID
    const chipId = await this.i2cRead(R820T_I2C_ADDR, 0x00);
    if ((chipId & 0xF0) !== 0x50) {
      console.warn(`R820T chip ID mismatch: got 0x${chipId.toString(16)}, expected 0x5x`);
    }

    // Disable I2C repeater
    await this.rtlWriteReg(0x01, 0x01);
  }

  // ── R820T Frequency Tuning ──────────────────────────────

  private async r820tSetFreq(freqHz: number): Promise<void> {
    // R820T PLL calculation:
    // VCO frequency = freq * divider
    // The R820T has selectable dividers: 1, 2, 4, 8, 16, 32, 64
    // VCO range is approx 1770-3630 MHz

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

    // PLL divider select register (0x08 bits 4-6)
    const divMap: Record<number, number> = { 1: 0, 2: 1, 4: 2, 8: 3, 16: 4, 32: 5, 64: 6 };
    const divCode = divMap[div] ?? 2;

    // Crystal frequency = 16 MHz for R820T
    const xtalFreq = 16_000_000;

    // Calculate PLL register values (fractional-N)
    // N_int = floor(VCO_freq / crystal_freq), frac_12bit = round(frac * 4096 / crystal_freq)
    const Nint = Math.floor(vcoFreq / xtalFreq);
    const frac = vcoFreq % xtalFreq;
    const fracBits = Math.round((frac / xtalFreq) * 4096); // 12-bit fractional

    const nLo = Nint & 0xff;
    const nHi = (Nint >> 8) & 0x0f;
    const fracHi = (fracBits >> 4) & 0xff;
    const fracLo = (fracBits & 0x0f) << 4;

    // Write PLL registers
    await this.i2cWrite(R820T_I2C_ADDR, 0x07, 0x00);
    await this.i2cWrite(R820T_I2C_ADDR, 0x08, 0x40 | (divCode << 4));
    await this.i2cWrite(R820T_I2C_ADDR, 0x09, nLo);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0a, nHi | (fracHi & 0xf0));
    await this.i2cWrite(R820T_I2C_ADDR, 0x0b, fracLo | 0x08); // charge pump + frac

    // Set filter bandwidth based on frequency
    // Note: this is simplified; real calc is more complex
    let filterCode = 0;
    if (freqHz < 50_000_000) filterCode = 0;
    else if (freqHz < 100_000_000) filterCode = 0x10;
    else if (freqHz < 200_000_000) filterCode = 0x20;
    else if (freqHz < 400_000_000) filterCode = 0x30;
    else if (freqHz < 600_000_000) filterCode = 0x40;
    else if (freqHz < 900_000_000) filterCode = 0x50;
    else filterCode = 0x60;

    await this.i2cWrite(R820T_I2C_ADDR, 0x0e, filterCode);
    await this.i2cWrite(R820T_I2C_ADDR, 0x0f, filterCode);

    // Calibration trigger
    await this.i2cWrite(R820T_I2C_ADDR, 0x13, 0x00); // stop cal
    await this.sleep(5);
    await this.i2cWrite(R820T_I2C_ADDR, 0x13, 0x40); // start cal
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
