// CCTV source registry shared by intel-cctv (legacy region= mode) and
// intel-cctv-ingest (scheduled cache fill). Each source declares its
// attribution string, stored on every row and shown on the map in view.

import {
  CALTRANS_DISTRICTS, caltransUrl, parseCaltrans, parseNyc, parseSingapore, type CctvCamera,
} from "./parsers.ts";
import {
  fetchArcgisAll, parseAustin, parseDriveBC, parseHongKong, parseIllinois, parseIowa, parseNzta, parseTfl, parseTripCheck,
} from "./parsers_more.ts";
import { FIVE11, five11Url, parse511, parseDigitraffic, parseNps } from "./parsers_keyed.ts";

export type GetJson = (url: string, timeoutMs: number) => Promise<unknown | null>;
export type GetText = (url: string, timeoutMs: number) => Promise<string | null>;
export interface Fetchers { json: GetJson; text: GetText }

export interface CctvSource {
  /** Stable key stored in cctv_cameras.source (matches parser `source`). */
  id: string;
  /** Legacy region key for intel-cctv?region= (only original 3 sources). */
  region?: string;
  attribution: string;
  /** Terms still need the user's confirmation before go-live. */
  termsPending?: boolean;
  /**
   * Needs a signed agreement with the provider: enabled only when listed by
   * id in CCTV_ENABLE_PENDING_SOURCES ("all" does NOT include it).
   */
  agreementRequired?: boolean;
  /**
   * Name of a function secret holding a free API key. The source runs only
   * when that secret is set; the key is passed to fetch and never logged.
   */
  secret?: string;
  fetch: (f: Fetchers, key?: string) => Promise<CctvCamera[]>;
}

export const CCTV_SOURCES: CctvSource[] = [
  {
    id: "LTA Singapore", region: "sg",
    attribution: "Traffic images: Land Transport Authority, data.gov.sg (Singapore Open Data Licence)",
    fetch: async ({ json }) => parseSingapore(await json("https://api.data.gov.sg/v1/transport/traffic-images", 10_000)),
  },
  {
    id: "Caltrans", region: "us-ca",
    attribution: "Caltrans CWWP2 traffic cameras",
    fetch: async ({ json }) => {
      const r = await Promise.allSettled(CALTRANS_DISTRICTS.map(async (d) => parseCaltrans(await json(caltransUrl(d), 10_000), d)));
      return r.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    },
  },
  {
    // Disabled by default: NYC DOT's camera feed requires a signed data-sharing
    // agreement. Enable with CCTV_ENABLE_PENDING_SOURCES="NYC DOT" once signed.
    id: "NYC DOT", region: "us-ny", termsPending: true, agreementRequired: true,
    attribution: "NYC DOT traffic cameras (webcams.nyctmc.org)",
    fetch: async ({ json }) => parseNyc(await json("https://webcams.nyctmc.org/api/cameras", 10_000)),
  },
  // ── PR B: no-key sources (IL / IA / OR terms approved 2026-10-22) ──────────────────────────────────────────────
  {
    id: "Travel Midwest (IL)",
    attribution: "Illinois cameras: Travel Midwest / IDOT",
    fetch: async ({ json }) => parseIllinois(await fetchArcgisAll(json,
      "https://services2.arcgis.com/aIrBD8yn1TDTEXoz/arcgis/rest/services/TrafficCamerasTM_Public/FeatureServer/0")),
  },
  {
    id: "Iowa DOT",
    attribution: "Iowa DOT traffic cameras",
    fetch: async ({ json }) => parseIowa(await fetchArcgisAll(json,
      "https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0")),
  },
  {
    id: "ODOT TripCheck",
    attribution: "Oregon DOT TripCheck",
    fetch: async ({ json }) => parseTripCheck(await json("https://tripcheck.com/Scripts/map/data/cctvinventory.js", 15_000)),
  },
  {
    id: "DriveBC",
    attribution: "DriveBC, Government of British Columbia (Open Government Licence – BC)",
    fetch: async ({ json }) => parseDriveBC(await json("https://www.drivebc.ca/api/webcams/", 15_000)),
  },
  {
    id: "HK Transport Department",
    attribution: "Transport Department, HKSAR (DATA.GOV.HK)",
    fetch: async ({ text }) => parseHongKong(await text(
      "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml", 15_000)),
  },
  {
    id: "City of Austin",
    attribution: "City of Austin Transportation open data",
    fetch: async ({ json }) => parseAustin(await json("https://data.austintexas.gov/resource/b4k4-adkb.json?$limit=5000", 15_000)),
  },
  {
    id: "TfL JamCams",
    attribution: "Powered by TfL Open Data",
    fetch: async ({ json }) => parseTfl(await json("https://api.tfl.gov.uk/Place/Type/JamCam", 15_000)),
  },
  {
    id: "NZTA",
    attribution: "Waka Kotahi NZ Transport Agency (CC BY 4.0)",
    fetch: async ({ json }) => parseNzta(await json("https://www.journeys.nzta.govt.nz/assets/map-data-cache/cameras.json", 15_000)),
  },
  // ── No-key / free-key additions ──────────────────────────────────────
  {
    id: "Digitraffic (FI)",
    attribution: "Fintraffic / digitraffic.fi, CC BY 4.0",
    fetch: async ({ json }) => parseDigitraffic(await json("https://tie.digitraffic.fi/api/weathercam/v1/stations", 20_000)),
  },
  {
    id: "NPS Webcams", secret: "NPS_API_KEY",
    attribution: "U.S. National Park Service (NPS Data API)",
    fetch: async ({ json }, key) => parseNps(await json(
      `https://developer.nps.gov/api/v1/webcams?limit=1000&api_key=${encodeURIComponent(key ?? "")}`, 20_000)),
  },
  // One request per host per ingest run (every 15 min): well under the ~10 calls/min limit.
  ...FIVE11.map((h): CctvSource => ({
    id: h.id, secret: h.secret, attribution: h.attribution,
    fetch: async ({ json }, key) => parse511(await json(five11Url(h.host, key ?? ""), 20_000), h.id, h.prefix, h.region, h.country),
  })),
];

/**
 * Key-gated sources. Implemented above (secret-gated): NPS_API_KEY, GA511_API_KEY,
 * WI511_API_KEY, ID511_API_KEY, ONTARIO511_API_KEY, ALBERTA511_API_KEY.
 * Not implemented yet (listed so go-live can pick them up):
 * ONTARIO511_API_KEY, ALBERTA511_API_KEY, GA511_API_KEY, AZ511_API_KEY,
 * NVROADS_API_KEY, UDOT_API_KEY, PA511_API_KEY, WI511_API_KEY, FL511_API_KEY,
 * NY511_API_KEY, WSDOT_ACCESS_CODE, OHGO_API_KEY, COTRIP_API_KEY, TFNSW_API_KEY.
 */
export const KEY_GATED_SOURCE_SECRETS = [
  "ONTARIO511_API_KEY", "ALBERTA511_API_KEY", "GA511_API_KEY", "AZ511_API_KEY", "NVROADS_API_KEY", "UDOT_API_KEY",
  "PA511_API_KEY", "WI511_API_KEY", "FL511_API_KEY", "NY511_API_KEY", "WSDOT_ACCESS_CODE", "OHGO_API_KEY",
  "COTRIP_API_KEY", "TFNSW_API_KEY",
] as const;

/**
 * Sources the ingest runs. Terms-pending sources are skipped unless
 * CCTV_ENABLE_PENDING_SOURCES lists them (comma ids) or is "all";
 * agreement-required sources must be listed by id explicitly.
 */
export type GetEnv = (name: string) => string | undefined;
const noEnv: GetEnv = () => undefined;

export function enabledSources(pendingEnv: string | undefined, getEnv: GetEnv = noEnv): CctvSource[] {
  const allow = new Set((pendingEnv ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return CCTV_SOURCES.filter((s) =>
    (!s.secret || !!getEnv(s.secret)?.trim()) &&
    (!s.termsPending || allow.has(s.id) || (allow.has("all") && !s.agreementRequired))
  );
}

/** Source ids that must not be served (so stale DB rows are hidden too). */
export function disabledSourceIds(pendingEnv: string | undefined, getEnv: GetEnv = noEnv): Set<string> {
  const on = new Set(enabledSources(pendingEnv, getEnv).map((s) => s.id));
  return new Set(CCTV_SOURCES.filter((s) => !on.has(s.id)).map((s) => s.id));
}

export const CCTV_ATTRIBUTION: Record<string, string> = Object.fromEntries(CCTV_SOURCES.map((s) => [s.id, s.attribution]));

const UA = "EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)";

/** Hide API keys in logged URLs. */
export const redactUrl = (url: string) => url.replace(/([?&](?:key|api_key)=)[^&]*/gi, "$1***");

export function makeFetchers(userAgent = UA): Fetchers {
  const go = async (url: string, timeoutMs: number, accept: string) => {
    const res = await fetch(url, { headers: { "User-Agent": userAgent, Accept: accept }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { console.warn("[cctv]", redactUrl(url), res.status); await res.body?.cancel(); return null; }
    return res;
  };
  return {
    json: async (url, t) => { const r = await go(url, t, "application/json, text/javascript, */*;q=0.1"); return r ? await r.json() : null; },
    text: async (url, t) => { const r = await go(url, t, "application/xml,text/xml,*/*"); return r ? await r.text() : null; },
  };
}

/** Back-compat for callers that only need JSON. */
export function makeGetJson(userAgent = UA): GetJson { return makeFetchers(userAgent).json; }
