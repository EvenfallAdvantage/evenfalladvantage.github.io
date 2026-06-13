import type { WasmSdrModule } from "./types";
import { BUFFER_SIZE, AUDIO_SAMPLE_RATE } from "./types";

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

// ─── SDR CONTROLLER ───────────────────────────────────────

export class SdrController {
  private device: USBDevice | null = null;
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;
  private streamRequest: Promise<void> | null = null;
  private audioBuf: Float32Array[] = [];

  async connect(): Promise<void> {
    if (!navigator.usb) throw new Error("WebUSB not available");

    const device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x0bda, productId: 0x2832 },
        { vendorId: 0x0bda, productId: 0x2838 },
        { vendorId: 0x0bda, productId: 0x2830 },
        { vendorId: 0x0bda, productId: 0x2820 },
        { vendorId: 0x0bda, productId: 0x2812 },
      ],
    });

    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    this.device = device;

    // Set up audio pipeline
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

  // ── USB Control Transfers ─────────────────────────────

  async ctrlWrite(request: number, value: number, index: number, data?: Uint8Array): Promise<void> {
    if (!this.device) return;
    await this.device.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    }, data as BufferSource);
  }

  async ctrlRead(request: number, value: number, index: number, length: number): Promise<DataView | null> {
    if (!this.device) return null;
    const result = await this.device.controlTransferIn({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    }, length);
    return result.data ?? null;
  }

  // ── Bulk read (I/Q samples from SDR) ──────────────────

  async readBulk(): Promise<DataView | null> {
    if (!this.device) return null;
    try {
      const result = await this.device.transferIn(EP_BULK_IN, BUFFER_SIZE);
      return result.data ?? null;
    } catch {
      return null;
    }
  }

  // ── Start streaming audio pipeline ─────────────────────

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

  // ── Feed demodulated audio ─────────────────────────────

  feedAudio(samples: Float32Array): void {
    this.audioBuf.push(samples);
  }

  // ── Audio pipeline control ─────────────────────────────

  setVolume(v: number): void {
    if (this.gainNode) this.gainNode.gain.value = v;
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  // ── Utility ─────────────────────────────────────────────

  private rms(buf: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
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
