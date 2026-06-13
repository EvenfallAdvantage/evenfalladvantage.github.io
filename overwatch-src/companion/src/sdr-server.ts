import { WebSocketServer, WebSocket as WsSocket } from "ws";
import { createServer } from "node:http";
import { SdrDevice } from "./sdr-device.js";
import { Demodulator } from "./demodulator.js";

const SAMPLE_RATE = 48_000;

export class SdrServer {
  private wss: WebSocketServer | null = null;
  private sdr: SdrDevice;
  private demod: Demodulator;
  private clients: Set<WsSocket> = new Set();
  private freqHz = 100_000_000;
  private gainDb = 30;

  constructor() {
    this.sdr = new SdrDevice();
    this.demod = new Demodulator();
  }

  async start(port = 8372): Promise<void> {
    await this.demod.load();

    await this.sdr.open();
    this.sdr.onBulkData((buf) => this.onBulkData(buf));
    console.log("SDR: device initialized");

    const server = createServer();
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "ready", sample_rate: SAMPLE_RATE }));
      console.log("SDR: client connected");

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleMessage(ws, msg);
        } catch {}
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("SDR: client disconnected");
      });

      this.sdr.startStream();
    });

    server.listen(port, () => {
      console.log(`SDR companion running on ws://localhost:${port}`);
    });
  }

  stop(): void {
    this.sdr.close();
    this.wss?.close();
  }

  private handleMessage(_ws: WsSocket, msg: Record<string, unknown>): void {
    switch (msg.cmd) {
      case "set_frequency":
        this.freqHz = msg.freq as number;
        this.sdr.setFrequency(this.freqHz);
        break;
      case "set_gain":
        this.gainDb = msg.gain as number;
        this.sdr.setGain(this.gainDb);
        break;
    }
  }

  private iqBuffer = Buffer.alloc(0);

  private onBulkData(buf: Buffer): void {
    this.iqBuffer = Buffer.concat([this.iqBuffer, buf]);

    // Process in 8192-sample chunks
    const chunkBytes = 8192 * 2; // 8192 8-bit I/Q pairs = 16384 bytes
    while (this.iqBuffer.length >= chunkBytes) {
      const chunk = this.iqBuffer.subarray(0, chunkBytes);
      this.iqBuffer = this.iqBuffer.subarray(chunkBytes);

      const audio = this.demod.demodulate(chunk, SAMPLE_RATE, this.freqHz);
      if (audio) this.broadcastAudio(audio);
    }
  }

  private broadcastAudio(audio: Float32Array): void {
    const bin = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(bin); } catch {}
      }
    }
  }
}
