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
    });

    server.listen(port, () => {
      console.log(`SDR companion running on ws://localhost:${port}`);
    });
  }

  stop(): void {
    this.rtl.close();
    this.wss?.close();
  }

  private handleMessage(_ws: WsSocket, msg: Record<string, unknown>): void {
    switch (msg.cmd) {
      case "set_frequency":
        this.freqHz = msg.freq as number;
        this.rtl.setFrequency(this.freqHz);
        break;
      case "set_gain":
        this.gainDb = msg.gain as number;
        this.rtl.setGain(this.gainDb);
        break;
      case "set_mode":
        this.mode = msg.mode as string;
        this.rtl.setMode(this.mode);
        break;
    }
  }
}
