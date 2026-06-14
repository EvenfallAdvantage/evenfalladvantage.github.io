const WORKLET_CODE = `
class SdrOutputProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(0);
    this._counter = 0;
    this._signalAccum = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === "audio") {
        const chunk = e.data.data;
        const nb = new Float32Array(this._buf.length + chunk.length);
        nb.set(this._buf, 0);
        nb.set(chunk, this._buf.length);
        this._buf = nb;
      }
    };
  }

  process(_inputs, outputs, _params) {
    const out = outputs[0];
    if (!out || !out[0]) return true;
    const ch = out[0];
    const len = ch.length;

    if (this._buf.length >= len) {
      ch.set(this._buf.subarray(0, len));
      this._buf = this._buf.subarray(len);
    }

    let sum = 0;
    for (let i = 0; i < len; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / len);
    if (rms > this._signalAccum) this._signalAccum = rms;
    this._counter++;

    if (this._counter >= 32) {
      this.port.postMessage({ type: "signal", level: this._signalAccum });
      this._signalAccum = 0;
      this._counter = 0;
    }

    return true;
  }
}
registerProcessor("sdr-output-processor", SdrOutputProcessor);
`;

let registered = false;

export async function registerSdrWorklet(audioCtx: AudioContext): Promise<void> {
  if (registered) return;
  const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  await audioCtx.audioWorklet.addModule(url);
  registered = true;
}
