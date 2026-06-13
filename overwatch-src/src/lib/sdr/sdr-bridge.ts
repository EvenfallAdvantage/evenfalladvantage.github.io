const COMPANION_PORT = 8372;
const CONNECT_TIMEOUT = 2000;
const AUDIO_SAMPLE_RATE = 48000;

export class SdrBridge {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;
  private audioBuf: Float32Array[] = [];
  private signalLevel = 0;
  private _sampleRate = AUDIO_SAMPLE_RATE;

  get sampleRate(): number { return this._sampleRate; }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${COMPANION_PORT}`);
      ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("Companion service not found"));
      }, CONNECT_TIMEOUT);

      ws.onopen = () => clearTimeout(timer);

      ws.onmessage = (e) => {
        if (typeof e.data === "string") {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "ready") {
              if (msg.sample_rate) this._sampleRate = msg.sample_rate;
              this.active = true;
              this.ws = ws;
              this.setupAudio();
              resolve();
            }
          } catch {}
        } else if (e.data instanceof ArrayBuffer) {
          this.handleAudio(e.data);
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error("WebSocket error"));
      };

      ws.onclose = () => {
        clearTimeout(timer);
        if (!this.active) reject(new Error("Connection closed"));
      };
    });
  }

  disconnect(): void {
    this.active = false;
    this.audioBuf = [];
    if (this.scriptNode) { this.scriptNode.disconnect(); this.scriptNode = null; }
    if (this.audioCtx) { this.audioCtx.close(); this.audioCtx = null; this.gainNode = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
  }

  isConnected(): boolean {
    return this.active && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async setFrequency(freqHz: number): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "set_frequency", freq: freqHz }));
    }
  }

  async setGain(gainDb: number): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "set_gain", gain: gainDb }));
    }
  }

  setVolume(v: number): void {
    if (this.gainNode) this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  startStream(onLevel: (l: number) => void): void {
    if (!this.audioCtx) return;
    this.audioBuf = [];
    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
      const out = e.outputBuffer.getChannelData(0);
      const buf = this.audioBuf.shift();
      if (buf) {
        out.set(buf.subarray(0, out.length));
        let s = 0;
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        this.signalLevel = buf.length > 0 ? Math.sqrt(s / buf.length) : 0;
        onLevel(this.signalLevel);
      }
    };
    this.scriptNode.connect(this.gainNode!);
  }

  feedAudio(_s: Float32Array): void {} // NOP — audio comes via WebSocket

  async readBulk(): Promise<DataView | null> { return null; } // NOP

  private setupAudio(): void {
    this.audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 0.7;
    this.gainNode.connect(this.audioCtx.destination);
  }

  private handleAudio(data: ArrayBuffer): void {
    const audio = new Float32Array(data);
    this.audioBuf.push(audio);
  }
}
