// Network collectors for ais-collector (no Supabase imports, testable locally).
import {
  AISSTREAM_URL, DIGITRAFFIC_LOCATIONS, DIGITRAFFIC_USER, DIGITRAFFIC_VESSELS, MESSAGE_CAP, STREAM_MS,
  ShipBuffer, decodeFrame, parseAisstream, parseDigitrafficLocations, parseDigitrafficVessels, subscription,
} from "./lib.ts";

const FETCH_TIMEOUT_MS = 10_000;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "Digitraffic-User": DIGITRAFFIC_USER, "Accept-Encoding": "gzip", Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export async function collectDigitraffic(buf: ShipBuffer, now = Date.now()): Promise<{ positions: number; vessels: number }> {
  const since = now - 10 * 60_000;
  const [loc, ves] = await Promise.allSettled([
    fetchJson(`${DIGITRAFFIC_LOCATIONS}?from=${since}`),
    fetchJson(`${DIGITRAFFIC_VESSELS}?from=${now - 6 * 3600_000}`),
  ]);
  let positions = 0, vessels = 0;
  if (ves.status === "fulfilled") for (const s of parseDigitrafficVessels(ves.value)) { buf.addStat(s); vessels++; }
  if (loc.status === "fulfilled") for (const r of parseDigitrafficLocations(loc.value, now)) { buf.addPos(r); positions++; }
  else console.log("[ais-collector] digitraffic locations failed", String(loc.reason).slice(0, 120));
  return { positions, vessels };
}

export function collectAisstream(buf: ShipBuffer, apiKey: string, windowMs = STREAM_MS, cap = MESSAGE_CAP): Promise<{ messages: number; closed: string }> {
  return new Promise((resolve) => {
    let done = false;
    let ws: WebSocket;
    const finish = (closed: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws?.close(); } catch { /* ignore */ }
      resolve({ messages: buf.messages, closed });
    };
    const timer = setTimeout(() => finish("window"), windowMs);
    try { ws = new WebSocket(AISSTREAM_URL); } catch (e) { finish(`connect:${String(e).slice(0, 80)}`); return; }
    ws.binaryType = "arraybuffer";
    ws.onopen = () => ws.send(JSON.stringify(subscription(apiKey)));
    ws.onmessage = (ev) => {
      if (done) return;
      const text = decodeFrame(ev.data);
      if (!text) return;
      let msg: unknown;
      try { msg = JSON.parse(text); } catch { return; }
      // deno-lint-ignore no-explicit-any
      if ((msg as any)?.error) { finish(`error:${String((msg as any).error).slice(0, 80)}`); return; }
      const parsed = parseAisstream(msg, new Date().toISOString());
      if (!parsed) return;
      buf.messages++;
      if (parsed.pos) buf.addPos(parsed.pos);
      if (parsed.stat) buf.addStat(parsed.stat);
      if (buf.messages >= cap) finish("cap");
    };
    ws.onerror = () => finish("error");
    ws.onclose = (ev) => finish(`close:${ev.code}`);
  });
}

