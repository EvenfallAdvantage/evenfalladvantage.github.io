import { WebSocketServer, WebSocket as WsSocket } from "ws";
import { createServer } from "node:http";
import { RtlFmProcess } from "./rtl-fm-process.js";
import { AdsbProcessor, enumerateAdsbDevices } from "./adsb-processor.js";

const SAMPLE_RATE = 48_000;

export class SdrServer {
  private wss: WebSocketServer | null = null;
  private rtl: RtlFmProcess;
  private adsb: AdsbProcessor;
  private clients: Set<WsSocket> = new Set();
  private freqHz = 162_550_000;
  private gainDb = 40;
  private mode = "fm";
  private adsbEnabled = false;

  constructor() {
    this.rtl = new RtlFmProcess(this.freqHz);
    this.adsb = new AdsbProcessor(1);
    this.adsb.onAircraftData((batch) => {
      for (const ws of this.clients) {
        if (ws.readyState === ws.OPEN) {
          try { ws.send(JSON.stringify({ type: "adsb_batch", aircraft: batch })); } catch { /* ignore */ }
        }
      }
    });
  }

  async start(port = 8372): Promise<void> {
    await this.rtl.start();

    this.rtl.onAudioData((audio) => {
      for (const ws of this.clients) {
        if (ws.readyState === ws.OPEN) {
          const bin = Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
          try { ws.send(bin); } catch { /* ignore */ }
        }
      }
    });

    const server = createServer();
    this.wss = new WebSocketServer({ server });
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "ready", sample_rate: SAMPLE_RATE, freq: this.freqHz }));
      console.log("SDR: client connected");

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          await this.handleMessage(ws, msg);
        } catch { /* ignore malformed */ }
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
    this.adsb.stop();
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
      case "adsb_start":
        if (!this.adsbEnabled) {
          this.adsbEnabled = true;
          const deviceIndex = (msg.device as number) ?? 1;
          console.log(`ADSB: starting on device ${deviceIndex}`);
          await this.adsb.start();
          ws.send(JSON.stringify({ type: "adsb_status", enabled: true }));
        }
        break;
      case "adsb_stop":
        if (this.adsbEnabled) {
          this.adsbEnabled = false;
          console.log("ADSB: stopping");
          this.adsb.stop();
          ws.send(JSON.stringify({ type: "adsb_status", enabled: false }));
        }
        break;
      case "adsb_set_device":
        {
          const index = msg.device as number;
          console.log(`ADSB: switching to device ${index}`);
          const wasRunning = this.adsbEnabled;
          if (wasRunning) this.adsb.stop();
          this.adsb = new AdsbProcessor(index);
          this.adsb.onAircraftData((batch) => {
            for (const w of this.clients) {
              if (w.readyState === w.OPEN) {
                try { w.send(JSON.stringify({ type: "adsb_batch", aircraft: batch })); } catch { /* ignore */ }
              }
            }
          });
          if (wasRunning) await this.adsb.start();
        }
        break;
      case "enumerate_devices":
        {
          const devices = await enumerateAdsbDevices();
          ws.send(JSON.stringify({ type: "device_list", devices }));
        }
        break;
    }
  }
}
