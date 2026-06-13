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
  private _volume = 0.7;
  private _companionFreq: number | null = null;

  get sampleRate(): number { return this._sampleRate; }
  get companionFreq(): number | null { return this._companionFreq; }

  async connect(): Promise<void> {
    this.setupAudio();
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${COMPANION_PORT}`);
      ws.binaryType = "arraybuffer";
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error("Companion service not found. Please install the SDR companion app from https://github.com/EvenfallAdvantage/evenfalladvantage.github.io"));
      }, CONNECT_TIMEOUT);

      ws.onopen = () => clearTimeout(timer);

      ws.onmessage = (e) => {
        if (typeof e.data === "string") {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "ready") {
              if (msg.sample_rate) this._sampleRate = msg.sample_rate;
              if (msg.freq) this._companionFreq = msg.freq;
              this.active = true;
              this.ws = ws;
              resolve();
            } else if (msg.type === "freq_set") {
              this.audioBuf = [];
            } else if (msg.type === "gain_set") {
              // gain acknowledgement
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
    if (this.ws) {
      try { this.ws.onmessage = null; this.ws.onerror = null; this.ws.onclose = null; this.ws.close(); } catch {}
      this.ws = null;
    }
    this.active = false;
    this.audioBuf = [];
    if (this.scriptNode) { try { this.scriptNode.disconnect(); } catch {} this.scriptNode = null; }
    if (this.gainNode) { try { this.gainNode.disconnect(); } catch {} this.gainNode = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
  }

  isConnected(): boolean {
    return this.active && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async setFrequency(freqHz: number): Promise<void> {
    if (this.isConnected()) {
      this.audioBuf = [];
      this.ws!.send(JSON.stringify({ cmd: "set_frequency", freq: freqHz }));
    }
  }

  async setSquelch(squelch: number): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "set_squelch", squelch }));
    }
  }

  async setGain(gainDb: number): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "set_gain", gain: gainDb }));
    }
  }

  setVolume(v: number): void {
    this._volume = Math.max(0, Math.min(1, v));
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  startStream(onLevel: (l: number) => void): void {
    if (!this.audioCtx) return;
    this.audioBuf = [];
    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.scriptNode.onaudioprocess = (e: AudioProcessingEvent) => {
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
      this.signalLevel = Math.sqrt(s / out.length);
      onLevel(this.signalLevel);

      const vol = this._volume;
      if (vol !== 1) for (let i = 0; i < out.length; i++) out[i] *= vol;
    };
    this.scriptNode.connect(this.gainNode!);
  }

  feedAudio(_s: Float32Array): void {} // NOP — audio comes via WebSocket

  async readBulk(): Promise<DataView | null> { return null; } // NOP

  private setupAudio(): void {
    this.audioCtx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.value = 1.0;
    this.gainNode.connect(this.audioCtx.destination);
  }

  private handleAudio(data: ArrayBuffer): void {
    if (!this.active) return;
    const audio = new Float32Array(data);
    this.audioBuf.push(audio);
  }
}
