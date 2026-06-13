import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = resolve(__dirname, "../../public/wasm/rtl-sdr.wasm");
const IQ_BUF_LEN = 8192; // I/Q samples per call (power of 2)

interface WasmModule {
  sdr_init: () => void;
  fm_demodulate: (bufPtr: number, len: number, outPtr: number, sampleRate: number, freq: number) => void;
  memory: WebAssembly.Memory;
}

export class Demodulator {
  private wasm: WasmModule | null = null;
  private iqPtr = 0;
  private audioPtr = 0;
  private audioLen = 0;

  async load(): Promise<void> {
    const bytes = readFileSync(WASM_PATH);
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 4 });
    const result = await WebAssembly.instantiate(bytes, {
      env: { memory },
    });
    this.wasm = result.instance.exports as unknown as WasmModule;
    this.wasm.sdr_init();

    // Allocate WASM heaps: I/Q buffer + audio buffer
    this.iqPtr = this.alloc(IQ_BUF_LEN * 2); // 16-bit I/Q samples
    this.audioLen = IQ_BUF_LEN / 2; // decimated audio samples
    this.audioPtr = this.alloc(this.audioLen * 4); // float32 audio
  }

  demodulate(rawIq: Buffer, sampleRate: number, freq: number): Float32Array | null {
    if (!this.wasm) return null;
    const mem = this.wasm.memory;
    const count = Math.min(rawIq.length, IQ_BUF_LEN * 2);
    const view = new Float32Array(mem.buffer, this.iqPtr, count);
    for (let i = 0; i < count; i++) {
      view[i] = (rawIq[i] - 127.5) / 127.5;
    }
    this.wasm.fm_demodulate(this.iqPtr, count / 2, this.audioPtr, sampleRate, freq);
    const out = new Float32Array(this.audioLen);
    out.set(new Float32Array(mem.buffer, this.audioPtr, this.audioLen));
    return out;
  }

  private heapTop = 0;

  private alloc(size: number): number {
    const wasm = this.wasm!;
    const mem = wasm.memory;
    const currentPages = mem.buffer.byteLength >>> 16;
    const needed = Math.ceil((currentPages * 65536 + size) / 65536);
    while (mem.buffer.byteLength < needed * 65536) {
      mem.grow(1);
    }
    const ptr = this.heapTop;
    this.heapTop = ptr + size;
    return ptr;
  }
}
