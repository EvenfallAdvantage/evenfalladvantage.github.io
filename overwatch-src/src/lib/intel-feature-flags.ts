/**
 * Feature flags for Intel layers and panels ported from the Osiris OSS project
 * (https://github.com/simplifaisoul/osiris, MIT). Each flag gates a single
 * layer or panel on its license / legal-review status.
 *
 * Convention:
 *   - `gatedBy`: human-readable reason a flag is currently disabled.
 *   - `enabled`: when false, the corresponding UI control is rendered as
 *     disabled with a tooltip explaining the gate.
 *   - `attribution`: short string surfaced in the attribution modal whenever
 *     the layer is on screen. Required by some upstream T&Cs.
 *   - `commercialUseRequiresApiKey`: true → enabling in production needs an
 *     env-supplied API key from the source provider.
 *
 * Update `enabled` to true (and remove `gatedBy`) only AFTER legal review has
 * signed off for the relevant source.
 */

export type IntelLayerKey =
  | "earthquakes"
  | "fires"
  | "eonet_weather"
  | "space_weather"
  | "conflict_zones"
  | "nuclear_infrastructure"
  | "gdelt"
  | "live_news"
  | "sigint_news"
  | "cctv"
  | "maritime_static"
  | "maritime_ais"
  | "flights"
  | "satellites"
  | "country_risk"
  | "cyber_threats"
  | "region_dossier"
  | "recon_dns"
  | "recon_whois"
  | "recon_cve"
  | "recon_certs"
  | "recon_bgp"
  | "recon_ip"
  | "recon_threats"
  | "recon_sweep";

export interface IntelFlag {
  enabled: boolean;
  gatedBy?: string;
  attribution: string;
  /** True if commercial deployment requires a paid/registered API key. */
  commercialUseRequiresApiKey?: boolean;
  /** True if attribution string must be rendered while the layer is active. */
  attributionRequired?: boolean;
}

export const INTEL_LAYER_FLAGS: Record<IntelLayerKey, IntelFlag> = {
  // ─── Hazards: fully public, free, no restrictions ─────────────────
  earthquakes: {
    enabled: true,
    attribution: "USGS Earthquake Catalog",
  },
  fires: {
    enabled: true,
    attribution: "NASA FIRMS (VIIRS/MODIS)",
    attributionRequired: true,
  },
  eonet_weather: {
    enabled: true,
    attribution: "NASA EONET",
    attributionRequired: true,
  },
  space_weather: {
    enabled: true,
    attribution: "NOAA SWPC",
  },
  conflict_zones: {
    enabled: true,
    attribution: "Static OSINT (curated)",
  },
  nuclear_infrastructure: {
    enabled: true,
    attribution: "Static OSINT (curated)",
  },

  // ─── News / events ────────────────────────────────────────────────
  gdelt: {
    enabled: true,
    attribution: "GDELT Project / RSS aggregator",
  },
  live_news: {
    enabled: true,
    attribution: "Public YouTube broadcaster feeds",
  },
  sigint_news: {
    enabled: true,
    attribution: "Public RSS (BBC, AlJazeera, NPR, GDACS, NHK)",
  },

  // ─── Surveillance: gated pending legal review ─────────────────────
  cctv: {
    enabled: false,
    gatedBy: "Legal review pending (TfL JamCams + state DOT terms vary)",
    attribution: "TfL, WSDOT, Caltrans, NYC DOT, ASFINAG, et al.",
    attributionRequired: true,
  },

  // ─── Maritime ─────────────────────────────────────────────────────
  maritime_static: {
    enabled: true,
    attribution: "Static port + chokepoint OSINT",
  },
  maritime_ais: {
    enabled: false,
    gatedBy: "Requires aisstream.io API key + long-lived worker (Phase E)",
    attribution: "aisstream.io",
    commercialUseRequiresApiKey: true,
    attributionRequired: true,
  },

  // ─── Aviation / Space ─────────────────────────────────────────────
  flights: {
    enabled: true,
    attribution: "OpenSky Network / adsb.lol",
    attributionRequired: true,
  },
  satellites: {
    enabled: true,
    attribution: "CelesTrak TLE catalog",
    attributionRequired: true,
  },

  // ─── Status indicators ────────────────────────────────────────────
  country_risk: {
    enabled: true,
    attribution: "Curated risk index + USGS proximity boost",
  },
  cyber_threats: {
    enabled: true,
    attribution: "CISA KEV catalog",
    attributionRequired: true,
  },
  region_dossier: {
    enabled: true,
    attribution: "Nominatim, RestCountries, Wikipedia, Wikidata",
    attributionRequired: true,
  },

  // ─── RECON toolkit ────────────────────────────────────────────────
  recon_dns: {
    enabled: true,
    attribution: "Google DNS-over-HTTPS",
  },
  recon_whois: {
    enabled: true,
    attribution: "RDAP via rdap.org",
  },
  recon_cve: {
    enabled: true,
    attribution: "MITRE cveawg + CIRCL CVE",
  },
  recon_certs: {
    enabled: true,
    attribution: "crt.sh certificate transparency",
  },
  recon_bgp: {
    enabled: true,
    attribution: "bgpview.io",
  },
  recon_ip: {
    enabled: true,
    attribution: "ip-api.com",
  },
  recon_threats: {
    enabled: true,
    attribution: "AlienVault OTX + Tor exit list",
  },
  recon_sweep: {
    enabled: true,
    attribution: "Shodan InternetDB + ip-api.com",
  },
};

/** Returns the list of currently active layers (enabled=true). */
export function getEnabledIntelLayers(): IntelLayerKey[] {
  return (Object.keys(INTEL_LAYER_FLAGS) as IntelLayerKey[]).filter(
    (k) => INTEL_LAYER_FLAGS[k].enabled,
  );
}

/** Returns the attribution strings that must be rendered while the given layers are on screen. */
export function getRequiredAttributions(activeLayers: IntelLayerKey[]): string[] {
  return activeLayers
    .map((k) => INTEL_LAYER_FLAGS[k])
    .filter((f) => f.attributionRequired)
    .map((f) => f.attribution);
}
