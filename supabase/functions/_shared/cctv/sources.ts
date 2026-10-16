// CCTV source registry shared by intel-cctv (legacy region= mode) and
// intel-cctv-ingest (scheduled cache fill). Each source declares its
// attribution string, which is stored on every camera row and shown on the
// map for sources in view.

import {
  CALTRANS_DISTRICTS, caltransUrl, parseCaltrans, parseNyc, parseSingapore, type CctvCamera,
} from "./parsers.ts";

export type GetJson = (url: string, timeoutMs: number) => Promise<unknown | null>;

export interface CctvSource {
  /** Stable source key stored in cctv_cameras.source (matches parser `source`). */
  id: string;
  /** Legacy region key for intel-cctv?region= */
  region: string;
  attribution: string;
  fetch: (getJson: GetJson) => Promise<CctvCamera[]>;
}

export const CCTV_SOURCES: CctvSource[] = [
  {
    id: "LTA Singapore", region: "sg",
    attribution: "Traffic images: Land Transport Authority, data.gov.sg (Singapore Open Data Licence)",
    fetch: async (get) => parseSingapore(await get("https://api.data.gov.sg/v1/transport/traffic-images", 10_000)),
  },
  {
    id: "Caltrans", region: "us-ca",
    attribution: "Caltrans CWWP2 traffic cameras",
    fetch: async (get) => {
      const r = await Promise.allSettled(CALTRANS_DISTRICTS.map(async (d) => parseCaltrans(await get(caltransUrl(d), 10_000), d)));
      return r.flatMap((x) => (x.status === "fulfilled" ? x.value : []));
    },
  },
  {
    id: "NYC DOT", region: "us-ny",
    attribution: "NYC DOT traffic cameras (webcams.nyctmc.org)",
    fetch: async (get) => parseNyc(await get("https://webcams.nyctmc.org/api/cameras", 10_000)),
  },
];

export const CCTV_ATTRIBUTION: Record<string, string> = Object.fromEntries(CCTV_SOURCES.map((s) => [s.id, s.attribution]));

export function makeGetJson(userAgent = "EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)"): GetJson {
  return async (url, timeoutMs) => {
    const res = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) { console.warn("[cctv]", url, res.status); await res.body?.cancel(); return null; }
    return await res.json();
  };
}
