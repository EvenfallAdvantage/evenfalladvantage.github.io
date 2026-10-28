/**
 * Client helpers for the Supabase Edge Functions that proxy public OSINT
 * data. Each helper returns a typed promise; errors are caught and surfaced
 * via the standard `{ error?: string }` field on the response.
 *
 * All functions deploy under `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intel-*`.
 * They require a signed-in user: the caller's Supabase session access token
 * is sent as the bearer and checked in-function (_shared/intel-auth.ts),
 * which also applies a per-user rate limit. The functions still deploy with
 * verify_jwt=false so CORS preflight works; auth is enforced in code.
 */

import { createClient } from "@/lib/supabase/client";
import type {
  IntelEarthquakesResponse,
  IntelFiresResponse,
  IntelEonetResponse,
  IntelSpaceWeatherResponse,
  IntelNewsResponse,
  IntelGdeltResponse,
  IntelLiveNewsResponse,
  IntelInfrastructureResponse,
  IntelConflictZonesResponse,
  IntelMaritimeResponse,
  IntelCountryRiskResponse,
  IntelCyberThreatsResponse,
  IntelRegionDossierResponse,
  IntelCctvResponse,
  IntelCctvBboxResponse,
  IntelTrafficIncidentsResponse,
  IntelDnsResponse,
  IntelWhoisResponse,
  IntelIpResponse,
  IntelCveResponse,
  IntelThreatsResponse,
  IntelBgpResponse,
  IntelCertsResponse,
  SweepResult,
} from "./intel-types";

function getBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  }
  return `${base.replace(/\/$/, "")}/functions/v1`;
}

async function buildHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) headers["apikey"] = anonKey;
  const token = await getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/** Current user's access token (null when signed out or in non-browser tests). */
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: await buildHeaders(),
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  // Edge function gateway returns 401 with a non-JSON body if verify_jwt is
  // enabled on a function that's meant to be public. Detect non-JSON before
  // calling .json() so callers get a clean Error instead of a parse stack
  // trace polluting Sentry.
  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      throw new Error(
        `Intel function ${path} returned ${res.status} (${ct || "no content-type"}) — ` +
        `check sign-in, or verify_jwt=true on the function (redeploy with --no-verify-jwt)`,
      );
    }
  }
  return (await res.json()) as T;
}

// ─── Hazards & events ────────────────────────────────────────────
export function fetchIntelHazards(kinds: readonly import("./intel-types").HazardSource[], near?: { points: string; km: number }) {
  const q = near && near.points ? `&near=${encodeURIComponent(near.points)}&near_km=${Math.round(near.km)}` : "";
  return call<import("./intel-types").IntelHazardsResponse>(`/intel-hazards?kinds=${encodeURIComponent(kinds.join(","))}${q}`);
}
export function fetchIntelEarthquakes() {
  return call<IntelEarthquakesResponse>("/intel-earthquakes");
}
export function fetchIntelFires() {
  return call<IntelFiresResponse>("/intel-fires");
}
export function fetchIntelEonetWeather() {
  return call<IntelEonetResponse>("/intel-eonet-weather");
}
export function fetchIntelSpaceWeather() {
  return call<IntelSpaceWeatherResponse>("/intel-space-weather");
}
export function fetchIntelNews() {
  return call<IntelNewsResponse>("/intel-news");
}
export function fetchIntelGdelt() {
  return call<IntelGdeltResponse>("/intel-gdelt");
}

// ─── Static curated ──────────────────────────────────────────────
export function fetchIntelInfrastructure() {
  return call<IntelInfrastructureResponse>("/intel-infrastructure");
}
export function fetchIntelConflictZones() {
  return call<IntelConflictZonesResponse>("/intel-conflict-zones");
}
export function fetchIntelLiveNews() {
  return call<IntelLiveNewsResponse>("/intel-live-news");
}
export function fetchIntelMaritime() {
  return call<IntelMaritimeResponse>("/intel-maritime");
}

// ─── Status indicators ───────────────────────────────────────────
export function fetchIntelCountryRisk() {
  return call<IntelCountryRiskResponse>("/intel-country-risk");
}
export function fetchIntelCyberThreats() {
  return call<IntelCyberThreatsResponse>("/intel-cyber-threats");
}
export function fetchIntelRegionDossier(lat: number, lng: number) {
  return call<IntelRegionDossierResponse>(
    `/intel-region-dossier?lat=${lat}&lng=${lng}`,
  );
}

// ─── Surveillance (gated) ────────────────────────────────────────
export function fetchIntelCctv(region: string = "all") {
  return call<IntelCctvResponse>(`/intel-cctv?region=${encodeURIComponent(region)}`);
}
/** Caller abort OR timeout (no AbortSignal.any: older Safari lacks it). */
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(new DOMException("Timeout", "TimeoutError")), ms);
  const done = () => { clearTimeout(t); ctl.abort(signal?.reason); };
  if (signal?.aborted) done(); else signal?.addEventListener("abort", done, { once: true });
  return ctl.signal;
}
/** Viewport mode (cctv_cameras cache). West > east = crosses antimeridian. */
export function fetchIntelCctvBbox(
  b: { west: number; south: number; east: number; north: number },
  zoom: number,
  limit: number,
  signal?: AbortSignal,
) {
  const q = `bbox=${b.west},${b.south},${b.east},${b.north}&zoom=${zoom}&limit=${limit}`;
  return call<IntelCctvBboxResponse>(`/intel-cctv?${q}`, {
    signal: withTimeout(signal, 20_000),
  });
}

// ─── OSINT / RECON ───────────────────────────────────────────────
export function fetchOsintDns(domain: string) {
  return call<IntelDnsResponse>(`/intel-osint-dns?domain=${encodeURIComponent(domain)}`);
}
export function fetchOsintWhois(domain: string) {
  return call<IntelWhoisResponse>(`/intel-osint-whois?domain=${encodeURIComponent(domain)}`);
}
export function fetchOsintIp(ip: string) {
  return call<IntelIpResponse>(`/intel-osint-ip?ip=${encodeURIComponent(ip)}`);
}
export function fetchOsintCve(cve: string) {
  return call<IntelCveResponse>(`/intel-osint-cve?cve=${encodeURIComponent(cve)}`);
}
export function fetchOsintThreats(query?: string) {
  const qs = query ? `?query=${encodeURIComponent(query)}` : "";
  return call<IntelThreatsResponse>(`/intel-osint-threats${qs}`);
}
export function fetchOsintBgp(query: string) {
  return call<IntelBgpResponse>(`/intel-osint-bgp?query=${encodeURIComponent(query)}`);
}
export function fetchOsintCerts(domain: string) {
  return call<IntelCertsResponse>(`/intel-osint-certs?domain=${encodeURIComponent(domain)}`);
}
export function fetchOsintSweep(ip: string, cidr = 24) {
  return call<SweepResult>(
    `/intel-osint-sweep?ip=${encodeURIComponent(ip)}&cidr=${cidr}`,
  );
}

// ─── Traffic Flow & Road Incidents (intel-traffic) ───────────────
export function fetchIntelTrafficIncidents(opts?: {
  bbox?: { west: number; south: number; east: number; north: number };
  near?: string;
  nearKm?: number;
  limit?: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (opts?.bbox) {
    params.set(
      "bbox",
      `${opts.bbox.west.toFixed(4)},${opts.bbox.south.toFixed(4)},${opts.bbox.east.toFixed(4)},${opts.bbox.north.toFixed(4)}`,
    );
  }
  if (opts?.near) {
    params.set("near", opts.near);
  }
  if (opts?.nearKm !== undefined) {
    params.set("near_km", String(Math.round(opts.nearKm)));
  }
  if (opts?.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }
  const qs = params.toString();
  return call<IntelTrafficIncidentsResponse>(
    `/intel-traffic${qs ? `?${qs}` : ""}`,
    opts?.signal ? { signal: withTimeout(opts.signal, 20_000) } : {},
  );
}

/**
 * URL template (`{z}`, `{x}`, `{y}`) for Cesium `UrlTemplateImageryProvider`
 * displaying live road congestion speeds. Uses `NEXT_PUBLIC_TOMTOM_API_KEY` directly
 * when configured, or falls back to the `intel-traffic` Edge Function tile proxy
 * (which uses server-side `TOMTOM_API_KEY`).
 */
export function trafficFlowTileUrlTemplate(style = "relative0-dark"): string {
  const directKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY?.trim();
  if (directKey) {
    return `https://api.tomtom.com/traffic/map/4/tile/flow/${encodeURIComponent(style)}/{z}/{x}/{y}.png?tileSize=256&key=${encodeURIComponent(directKey)}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/functions/v1/intel-traffic?tile={z}/{x}/{y}&style=${encodeURIComponent(style)}`;
}
