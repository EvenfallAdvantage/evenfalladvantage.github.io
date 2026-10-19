// ais-collector: live AIS ships for the Air & Sea layer.
//
// Called by pg_cron every minute (migration 20261019160000_live_ships) with the
// Vault cron secret (x-integrations-cron-secret, checked by
// integration_cron_secret_matches). Replies 202 at once, then in the
// background (EdgeRuntime.waitUntil):
//   1. Digitraffic (Finland/Baltic, keyless, CC BY 4.0) REST snapshot;
//   2. aisstream.io WebSocket for ~40 s (only if AISSTREAM_API_KEY is set),
//      capped at MESSAGE_CAP messages (CPU limit 2 s/request);
// and writes the latest fix per MMSI with ships_upsert / ships_static_upsert.
// Without AISSTREAM_API_KEY it runs Digitraffic-only. The key is never logged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { env, isCronCall, serviceClient } from "../_shared/integrations/http.ts";
import {
  AISSTREAM_URL, DIGITRAFFIC_LOCATIONS, DIGITRAFFIC_USER, DIGITRAFFIC_VESSELS, MESSAGE_CAP, STREAM_MS,
  ShipBuffer, decodeFrame, parseAisstream, parseDigitrafficLocations, parseDigitrafficVessels, subscription,
} from "./lib.ts";

const FETCH_TIMEOUT_MS = 10_000;
let running = false; // one collection per worker at a time

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

async function write(buf: ShipBuffer) {
  const admin = serviceClient();
  const rows = buf.rows();
  let upserted = 0, statics = 0;
  for (let i = 0; i < rows.length; i += 5000) {
    const { data, error } = await admin.rpc("ships_upsert", { p_rows: rows.slice(i, i + 5000) });
    if (error) console.log("[ais-collector] ships_upsert failed", error.message);
    else upserted += Number(data ?? 0);
  }
  const st = buf.staticOnly();
  for (let i = 0; i < st.length; i += 5000) {
    const { data, error } = await admin.rpc("ships_static_upsert", { p_rows: st.slice(i, i + 5000) });
    if (!error) statics += Number(data ?? 0);
  }
  return { upserted, statics };
}

async function run() {
  if (running) return;
  running = true;
  const t0 = Date.now();
  try {
    const buf = new ShipBuffer();
    const key = env("AISSTREAM_API_KEY");
    const [dt, as] = await Promise.all([
      collectDigitraffic(buf).catch((e) => ({ positions: 0, vessels: 0, error: String(e).slice(0, 80) })),
      key ? collectAisstream(buf, key) : Promise.resolve({ messages: 0, closed: "no-key" }),
    ]);
    const w = await write(buf);
    console.log("[ais-collector] done", { ms: Date.now() - t0, digitraffic: dt, aisstream: as, ships: buf.pos.size, ...w });
  } finally {
    running = false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!(await isCronCall(req, serviceClient()))) return new Response("unauthorized", { status: 401 });
  if (running) return new Response(JSON.stringify({ skipped: "already running" }), { status: 202 });
  EdgeRuntime.waitUntil(run());
  return new Response(JSON.stringify({ accepted: true, aisstream: !!env("AISSTREAM_API_KEY") }), { status: 202, headers: { "Content-Type": "application/json" } });
});
