/**
 * 24 h track history for the tracked aircraft.
 *
 * adsb.lol publishes per-aircraft readsb traces (ODbL 1.0). They have no
 * browser CORS, so the `opensky-proxy` Edge Function fetches and normalizes
 * them (`?trace=<hex>`). Pattern from gods-eye-view
 * (server/providers/aircraft/tracks.js), © 2026 Bilawal Sidhu, MIT — see
 * docs/THIRD-PARTY-NOTICES.md. Best effort: when history is unavailable the
 * map simply keeps the live trail.
 */
import { getAccessToken } from "@/lib/intel-client";
import { distanceM } from "./aircraft-motion";

/** [epoch ms, lat, lon, altitude m | null] */
export type TracePoint = [number, number, number, number | null];

export const TRACE_CREDIT = "Track history: adsb.lol (ODbL 1.0)";
/** A gap longer than this (no reports) breaks the line instead of drawing a straight jump. */
export const TRACE_GAP_MS = 10 * 60_000;
/** ...as does an implausible jump (bad position) between two consecutive points. */
export const TRACE_JUMP_M = 150_000;

export function isTracePoint(v: unknown): v is TracePoint {
  return Array.isArray(v) && v.length >= 3
    && typeof v[0] === "number" && Number.isFinite(v[0])
    && typeof v[1] === "number" && Math.abs(v[1]) <= 90
    && typeof v[2] === "number" && Math.abs(v[2]) <= 180
    && (v[3] == null || typeof v[3] === "number");
}

/** Split a time-ordered trace into drawable segments (≥ 2 points each). */
export function splitTraceSegments(points: readonly TracePoint[], gapMs = TRACE_GAP_MS, jumpM = TRACE_JUMP_M): TracePoint[][] {
  const out: TracePoint[][] = [];
  let cur: TracePoint[] = [];
  for (const p of points) {
    const prev = cur[cur.length - 1];
    if (prev && (p[0] - prev[0] > gapMs || distanceM({ lat: prev[1], lng: prev[2] }, { lat: p[1], lng: p[2] }) > jumpM)) {
      if (cur.length >= 2) out.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length >= 2) out.push(cur);
  return out;
}

export interface TraceResult { points: TracePoint[]; error?: string }

/** Fetch the last 24 h for `hex` via the proxy. Never throws. */
export async function fetchAircraftTrace(
  hex: string,
  opts: { fetchImpl?: typeof fetch; token?: string | null; baseUrl?: string; signal?: AbortSignal } = {},
): Promise<TraceResult> {
  const clean = hex.trim().toLowerCase();
  if (!/^~?[0-9a-f]{6}$/.test(clean)) return { points: [], error: "invalid id" };
  const base = opts.baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const headers: Record<string, string> = {};
    const token = opts.token !== undefined ? opts.token : await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anon) headers.apikey = anon;
    const res = await doFetch(`${base}/functions/v1/opensky-proxy?trace=${encodeURIComponent(clean)}`, {
      headers, signal: opts.signal ?? AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { points: [], error: `history unavailable (${res.status})` };
    const body = (await res.json()) as { points?: unknown; error?: unknown };
    const points = Array.isArray(body.points) ? body.points.filter(isTracePoint) : [];
    return { points, ...(typeof body.error === "string" ? { error: body.error } : {}) };
  } catch {
    return { points: [], error: "history unavailable" };
  }
}
