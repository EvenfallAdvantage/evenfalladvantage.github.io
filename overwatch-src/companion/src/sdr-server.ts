import { WebSocketServer, WebSocket as WsSocket } from "ws";
import { createServer } from "node:http";
import { RtlFmProcess } from "./rtl-fm-process.js";
import { AdsbProcessor } from "./adsb-processor.js";
import { DeviceManager, type SdrRole } from "./device-manager.js";

const SAMPLE_RATE = 48_000;

export class SdrServer {
  private wss: WebSocketServer | null = null;
  private rtl: RtlFmProcess;
  private adsb: AdsbProcessor;
  private deviceManager: DeviceManager;
  private clients: Set<WsSocket> = new Set();
  private freqHz = 162_550_000;
  private gainDb = 40;
  private mode = "fm";
  private adsbEnabled = false;

  constructor() {
    this.deviceManager = new DeviceManager();
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
    await this.deviceManager.enumerate();
    const initAssignments = this.deviceManager.getAssignments();
    if (initAssignments.radio !== null) {
      await this.rtl.setDevice(initAssignments.radio);
    } else {
      await this.rtl.start();
    }

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
      try { ws.send(JSON.stringify({ type: "ready", sample_rate: SAMPLE_RATE, freq: this.freqHz })); }
      catch (e) { console.error("SDR: failed to send ready", (e as Error).message); }
      this.sendDeviceCatalog(ws);
      console.log("SDR: client connected");

      ws.on("message", async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          await this.handleMessage(ws, msg);
        } catch (e) { console.error("SDR: msg error", (e as Error).message); }
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

  private sendDeviceCatalog(target?: WsSocket): void {
    const msg = JSON.stringify({
      type: "device_catalog",
      devices: this.deviceManager.getCatalog(),
      assignments: this.deviceManager.getAssignments(),
    });
    if (target) {
      try { target.send(msg); } catch { /* ignore */ }
    } else {
      for (const ws of this.clients) {
        try { ws.send(msg); } catch { /* ignore */ }
      }
    }
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
          console.log(`ADSB: starting on device ${this.adsb.getDevIndex()}`);
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
      case "assign_device":
        {
          const role = msg.role as SdrRole;
          const device = msg.device as number | null;
          if (role !== "radio" && role !== "adsb") {
            ws.send(JSON.stringify({ type: "device_assign_ack", success: false, error: "Invalid role" }));
            break;
          }
          const result = this.deviceManager.assignRole(role, device);
          if (!result.success) {
            ws.send(JSON.stringify({ type: "device_assign_ack", success: false, error: result.error }));
            break;
          }
          // Apply assignment to hardware
          if (role === "radio") {
            if (device !== null) {
              await this.rtl.setDevice(device);
            } else {
              this.rtl.close();
            }
            // Refresh rtl_fm start if adsb not running and radio freed a device
            if (device === null && this.rtl) {
              await this.rtl.start();
            }
          } else if (role === "adsb") {
            const wasRunning = this.adsbEnabled;
            if (wasRunning) this.adsb.stop();
            if (device !== null) {
              this.adsb = new AdsbProcessor(device);
              this.adsb.onAircraftData((batch) => {
                for (const w of this.clients) {
                  if (w.readyState === w.OPEN) {
                    try { w.send(JSON.stringify({ type: "adsb_batch", aircraft: batch })); } catch { /* ignore */ }
                  }
                }
              });
              if (wasRunning) await this.adsb.start();
            }
          }
          ws.send(JSON.stringify({ type: "device_assign_ack", success: true, role, device: device ?? null }));
          this.sendDeviceCatalog();
        }
        break;
      case "radio_set_device":
        {
          const index = msg.device as number;
          const result = this.deviceManager.assignRole("radio", index);
          if (!result.success) {
            ws.send(JSON.stringify({ type: "radio_device_set", device: index, success: false, error: result.error }));
            break;
          }
          console.log(`SDR: switching radio to device ${index}`);
          await this.rtl.setDevice(index);
          ws.send(JSON.stringify({ type: "radio_device_set", device: index }));
          this.sendDeviceCatalog();
        }
        break;
      case "adsb_set_device":
        {
          const index = msg.device as number;
          const result = this.deviceManager.assignRole("adsb", index);
          if (!result.success) {
            ws.send(JSON.stringify({ type: "adsb_status", error: result.error }));
            break;
          }
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
          this.sendDeviceCatalog();
        }
        break;
      case "enumerate_devices":
        {
          // Backward compat: return serial list
          const devices = this.deviceManager.getCatalog();
          ws.send(JSON.stringify({ type: "device_list", devices: devices.map((d) => d.serial) }));
        }
        break;
      default:
        console.error(`SDR: unknown cmd "${msg.cmd as string}"`);
        ws.send(JSON.stringify({ type: "error", error: `Unknown command: ${msg.cmd as string}` }));
    }
  }
}
