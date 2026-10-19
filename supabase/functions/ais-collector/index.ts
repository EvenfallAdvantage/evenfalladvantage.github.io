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

import { env, isCronCall, serviceClient } from "../_shared/integrations/http.ts";
import { ShipBuffer } from "./lib.ts";
import { collectAisstream, collectDigitraffic } from "./collect.ts";

// Provided by the Supabase edge runtime (typed here so local `deno check` passes).
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

let running = false; // one collection per worker at a time

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
