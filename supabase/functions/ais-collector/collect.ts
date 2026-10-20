// Network collectors for ais-collector (no Supabase imports, testable locally).
// npm:ws because Deno's built-in WebSocket client cannot negotiate permessage-deflate,
// and aisstream limits bandwidth on uncompressed connections (from Sept 2026).
import NodeWebSocket from "npm:ws@8.18.3";
import {
  AISSTREAM_URL, DIGITRAFFIC_LOCATIONS, DIGITRAFFIC_USER, DIGITRAFFIC_VESSELS, MESSAGE_CAP, STREAM_MS,
  ShipBuffer, StreamSession, decodeFrame, parseAisstream, parseDigitrafficLocations, parseDigitrafficVessels, subscription,
  type SessionSummary,
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

/** After an `error` event, wait this long for the `close` event that carries the code/reason. */
export const ERROR_CLOSE_GRACE_MS = 1_500;

// deno-lint-ignore no-explicit-any
type WsLike = any;

/** ws client with permessage-deflate offered (browser-style on* handlers, close/error events). */
export const defaultWsFactory = (url: string): WsLike => new NodeWebSocket(url, { perMessageDeflate: true });

export interface AisstreamResult extends SessionSummary {
  /** Back-compat with the old log shape: window | cap | error | close:<code> | connect:… */
  closed: string;
}

/**
 * Read the aisstream world feed for `windowMs` (or until `cap` messages) and
 * report how the session ended (see StreamSession). `wsFactory` is for tests.
 */
export function collectAisstream(
  buf: ShipBuffer, apiKey: string, windowMs = STREAM_MS, cap = MESSAGE_CAP,
  wsFactory: (url: string) => WsLike = defaultWsFactory,
  clock: () => number = Date.now,
): Promise<AisstreamResult> {
  return new Promise((resolve) => {
    const sess = new StreamSession(clock());
    let ws: WsLike;
    let resolved = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer); if (graceTimer) clearTimeout(graceTimer);
      const sum = sess.summary(clock());
      const closed = sum.ended_by === "client:window" ? "window" : sum.ended_by === "client:cap" ? "cap"
        : sum.ended_by === "server_close" ? `close:${sum.close_code ?? "none"}` : sum.ended_by === "connect_failed" ? "connect" : "error";
      resolve({ ...sum, closed });
    };
    const clientClose = (why: "window" | "cap") => {
      if (sess.ended) return;
      sess.clientClose(clock(), why);
      try { ws?.close(1000, why); } catch { /* ignore */ }
      done();
    };
    const timer = setTimeout(() => clientClose("window"), windowMs);
    try { ws = wsFactory(AISSTREAM_URL); } catch (e) { sess.onError(clock(), e); done(); return; }
    ws.binaryType = "arraybuffer";
    ws.onopen = () => { sess.open(clock(), ws.extensions); ws.send(JSON.stringify(subscription(apiKey))); };
    ws.onmessage = (ev: { data: unknown }) => {
      if (sess.ended) return;
      const text = decodeFrame(ev.data);
      if (!text) return;
      let msg: unknown;
      try { msg = JSON.parse(text); } catch { return; }
      // deno-lint-ignore no-explicit-any
      if ((msg as any)?.MessageType === "SubscriptionConfirmation") { sess.confirmation((msg as any)?.Message?.CompressionEnabled); return; }
      // deno-lint-ignore no-explicit-any
      if ((msg as any)?.error) { sess.serverErrorMessage(clock(), (msg as any).error); try { ws.close(); } catch { /* ignore */ } done(); return; }
      const parsed = parseAisstream(msg, new Date().toISOString());
      if (!parsed) return;
      sess.message(clock());
      buf.messages++;
      if (parsed.pos) buf.addPos(parsed.pos);
      if (parsed.stat) buf.addStat(parsed.stat);
      if (buf.messages >= cap) clientClose("cap");
    };
    ws.onerror = (ev: { message?: string; error?: unknown }) => {
      if (resolved) return;
      sess.onError(clock(), ev?.message ?? ev?.error ?? null);
      if (sess.ended) { done(); return; }
      // The close event (code/reason) usually follows; give it a moment.
      graceTimer = setTimeout(() => { sess.errorTimeout(clock()); done(); }, ERROR_CLOSE_GRACE_MS);
    };
    ws.onclose = (ev: { code?: number; reason?: string; wasClean?: boolean }) => {
      sess.onClose(clock(), ev?.code, ev?.reason, ev?.wasClean);
      done();
    };
  });
}
