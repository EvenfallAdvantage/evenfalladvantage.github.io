import { registerSdrWorklet } from "./sdr-worklet";
import type { AdsbAircraftMap } from "./adsb-types";
import type { DeviceInfo, DeviceAssignment, SdrRoleKey } from "./device-types";

const COMPANION_PORT = 8372;
const CONNECT_TIMEOUT = 2000;
const AUDIO_SAMPLE_RATE = 48000;

export class SdrBridge {
  onAudio: ((chunk: Float32Array) => void) | null = null;
  onAdsbData: ((aircraft: AdsbAircraftMap) => void) | null = null;
  onDeviceCatalog: ((devices: DeviceInfo[], assignments: DeviceAssignment) => void) | null = null;
  onDeviceAssignAck: ((success: boolean, role: string, device: number | null, error?: string) => void) | null = null;
  analyserNode: AnalyserNode | null = null;
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private active = false;
  private _sampleRate = AUDIO_SAMPLE_RATE;
  private _companionFreq: number | null = null;
  private _deviceCatalog: DeviceInfo[] = [];
  private _deviceAssignment: DeviceAssignment = { radio: null, adsb: null };

  get sampleRate(): number { return this._sampleRate; }
  get companionFreq(): number | null { return this._companionFreq; }
  get deviceCatalog(): DeviceInfo[] { return this._deviceCatalog; }
  get deviceAssignment(): DeviceAssignment { return { ...this._deviceAssignment }; }

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
              // frequency acknowledged
            } else if (msg.type === "gain_set") {
              // gain acknowledged
            } else if (msg.type === "adsb_batch") {
              this.onAdsbData?.(msg.aircraft);
            } else if (msg.type === "adsb_status") {
              // ADSB start/stop acknowledged
            } else if (msg.type === "device_catalog") {
              this._deviceCatalog = msg.devices ?? [];
              this._deviceAssignment = msg.assignments ?? { radio: null, adsb: null };
              this.onDeviceCatalog?.(this._deviceCatalog, this._deviceAssignment);
            } else if (msg.type === "device_assign_ack") {
              this.onDeviceAssignAck?.(msg.success, msg.role, msg.device ?? null, msg.error);
            } else if (msg.type === "radio_device_set") {
              // backward compat — already handled via device_catalog
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
    if (this.workletNode) { try { this.workletNode.disconnect(); } catch {} this.workletNode = null; }
    this.analyserNode = null;
    if (this.gainNode) { try { this.gainNode.disconnect(); } catch {} this.gainNode = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
    this._deviceCatalog = [];
    this._deviceAssignment = { radio: null, adsb: null };
  }

  isConnected(): boolean {
    return this.active && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async setFrequency(freqHz: number): Promise<void> {
    if (this.isConnected()) {
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

  async assignDevice(role: SdrRoleKey, deviceIndex: number | null): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "assign_device", role, device: deviceIndex }));
    }
  }

  async adsbStart(): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "adsb_start" }));
    }
  }

  async adsbStop(): Promise<void> {
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "adsb_stop" }));
    }
  }

  async radioSetDevice(deviceIndex: number): Promise<void> {
    // Legacy — prefer assignDevice
    if (this.isConnected()) {
      this.ws!.send(JSON.stringify({ cmd: "radio_set_device", device: deviceIndex }));
    }
  }

  async enumerateDevices(): Promise<string[]> {
    return new Promise((resolve) => {
      if (!this.isConnected()) { resolve([]); return; }
      const handler = (e: MessageEvent) => {
        if (typeof e.data === "string") {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "device_list") {
              this.ws?.removeEventListener("message", handler);
              resolve(msg.devices);
            }
          } catch { /* ignore */ }
        }
      };
      this.ws!.addEventListener("message", handler);
      this.ws!.send(JSON.stringify({ cmd: "enumerate_devices" }));
      setTimeout(() => {
        this.ws?.removeEventListener("message", handler);
        resolve([]);
      }, 5000);
    });
  }

  setVolume(v: number): void {
    v = Math.max(0, Math.min(1, v));
    if (this.gainNode) this.gainNode.gain.value = v;
  }

  resumeAudio(): void {
    this.audioCtx?.resume();
  }

  async startStream(onLevel: (l: number) => void): Promise<void> {
    if (!this.audioCtx) return;
    await registerSdrWorklet(this.audioCtx);
    this.workletNode = new AudioWorkletNode(this.audioCtx, "sdr-output-processor", {
      outputChannelCount: [1],
    });
    this.workletNode.port.onmessage = (e) => {
      if (e.data.type === "signal") onLevel(e.data.level);
    };
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.workletNode.connect(this.analyserNode);
    this.analyserNode.connect(this.gainNode!);
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
    if (!this.active || !this.workletNode) return;
    const audio = new Float32Array(data);
    this.onAudio?.(audio);
    this.workletNode.port.postMessage({ type: "audio", data: audio });
  }
}
