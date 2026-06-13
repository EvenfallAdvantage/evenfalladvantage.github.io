import { WebSocketServer, WebSocket as WsSocket } from "ws";
import { createServer } from "node:http";
import { RtlFmProcess } from "./rtl-fm-process.js";

const SAMPLE_RATE = 48_000;

export class SdrServer {
  private wss: WebSocketServer | null = null;
  private rtl: RtlFmProcess;
  private clients: Set<WsSocket> = new Set();
  private freqHz = 162_550_000;
  private gainDb = 40;
  private mode = "fm";

  constructor() {
    this.rtl = new RtlFmProcess();
  }

  async start(port = 8372): Promise<void> {
    await this.rtl.start();

    this.rtl.onAudioData((audio) => {
      for (const ws of this.clients) {
        if (ws.readyState === ws.OPEN) {
          const bin = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
          try { ws.send(bin); } catch {}
        }
      }
    });

    const server = createServer();
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "ready", sample_rate: SAMPLE_RATE }));
      console.log("SDR: client connected");

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          await this.handleMessage(ws, msg);
        } catch {}
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("SDR: client disconnected");
      });
    });

    server.listen(port, () => {
      console.log(`SDR companion running on ws://localhost:${port}`);
    });
  }

  stop(): void {
    this.rtl.close();
    this.wss?.close();
  }

  private async handleMessage(ws: WsSocket, msg: Record<string, unknown>): Promise<void> {
    switch (msg.cmd) {
      case "set_frequency":
        this.freqHz = msg.freq as number;
        console.log(`SDR: changing freq to ${this.freqHz} Hz`);
        await this.rtl.setFrequency(this.freqHz);
        console.log(`SDR: freq set to ${this.freqHz} Hz`);
        ws.send(JSON.stringify({ type: "freq_set", freq: this.freqHz }));
        break;
      case "set_gain":
        this.gainDb = msg.gain as number;
        console.log(`SDR: changing gain to ${this.gainDb} dB`);
        await this.rtl.setGain(this.gainDb);
        ws.send(JSON.stringify({ type: "gain_set", gain: this.gainDb }));
        break;
      case "set_squelch":
        console.log(`SDR: changing squelch to ${msg.squelch}`);
        await this.rtl.setSquelch(msg.squelch as number);
        break;
      case "set_mode":
        this.mode = msg.mode as string;
        console.log(`SDR: changing mode to ${this.mode}`);
        await this.rtl.setMode(this.mode);
        break;
    }
  }
}
