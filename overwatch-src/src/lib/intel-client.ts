/**
 * Client helpers for the Supabase Edge Functions that proxy public OSINT
 * data. Each helper returns a typed promise; errors are caught and surfaced
 * via the standard `{ error?: string }` field on the response.
 *
 * All functions deploy under `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/intel-*`.
 * They do NOT require auth (no JWT) — see the per-function definitions in
 * supabase/functions/intel-*.
 */

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

function buildHeaders(): HeadersInit {
  // Edge functions accept the anon key as bearer for rate-limit accounting.
  // If unset, requests still succeed because the functions deploy with
  // `--no-verify-jwt`.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (anonKey) headers["Authorization"] = `Bearer ${anonKey}`;
  return headers;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  return (await res.json()) as T;
}

// ─── Hazards & events ────────────────────────────────────────────
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
