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
  | "lightning"
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
  | "recon_sweep"
  | "nws_warnings"
  | "wildfire_perimeters"
  | "tropical_cyclones"
  | "weather_radar"
  | "satellite_clouds"
  | "surface_wind"
  | "gnss_interference"
  | "osm_3d_buildings";

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
  nws_warnings: {
    enabled: true,
    attribution: "NOAA/NWS watches, warnings & advisories (public domain)",
  },
  wildfire_perimeters: {
    enabled: true,
    attribution: "NIFC / WFIGS Interagency Fire Perimeters (public domain)",
  },
  tropical_cyclones: {
    enabled: true,
    attribution: "NOAA National Hurricane Center (public domain)",
  },
  weather_radar: {
    enabled: true,
    attribution: "NOAA/NWS nowCOAST MRMS radar (public domain)",
  },
  satellite_clouds: {
    enabled: true,
    attribution: "NOAA/NWS nowCOAST GOES/global infrared imagery (public domain)",
  },
  surface_wind: {
    enabled: true,
    attribution: "NOAA/NWS surface observations (public domain)",
  },
  gnss_interference: {
    enabled: true,
    attribution: "Derived from adsb.lol aircraft accuracy reports (ODbL 1.0)",
    attributionRequired: true,
  },
  osm_3d_buildings: {
    enabled: true,
    attribution: "3D buildings: © OpenMapTiles © OpenStreetMap contributors (ODbL 1.0), tiles by OpenFreeMap",
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
    attribution: "Geotagged world-news RSS (BBC, Reuters, Al Jazeera, etc.)",
  },
  live_news: {
    enabled: true,
    attribution: "Public YouTube broadcaster feeds",
  },
  sigint_news: {
    enabled: true,
    attribution: "Public RSS (BBC, AlJazeera, NPR, GDACS, NHK)",
  },

  // ─── Surveillance: legal review cleared (May 2026) ────────────────
  // Enabled scope: Singapore LTA traffic-images, Caltrans California
  // districts 1–12, and the other open-data sources below. NYC DOT webcams
  // are OFF by default (Phase 0) until a signed NYC DOT data-sharing
  // agreement exists; enable server-side with CCTV_ENABLE_PENDING_SOURCES. (FL-511 dropped: needs an API key.) All are public open-data sources cleared
  // for the Overwatch user base. Additional regions (TfL JamCams, WSDOT, NYC
  // DOT, ASFINAG, Bulgaria, Greece, Serbia, Macedonia, Romania, Turkey) are
  // available in the upstream Osiris implementation and can be added per
  // region as their individual ToS are reviewed.
  cctv: {
    enabled: true,
    attribution:
      "Caltrans, LTA Singapore (data.gov.sg, SODL 1.0), DriveBC (OGL-BC), HK Transport Dept (DATA.GOV.HK), City of Austin, Powered by TfL Open Data, NZ Transport Agency Waka Kotahi",
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
    attribution: "Aircraft data © adsb.lol contributors (ODbL 1.0)",
    attributionRequired: true,
  },
  lightning: {
    enabled: true,
    attribution: "Lightning strike density: NOAA/NWS nowCOAST",
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
    attribution: "OpenStreetMap (Nominatim, Photon), Wikidata, Wikipedia",
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
    attribution: "Regional Internet Registries (RDAP) + PeeringDB",
  },
  recon_ip: {
    enabled: true,
    attribution: "Regional Internet Registries (RDAP) + Google DNS-over-HTTPS",
  },
  recon_threats: {
    enabled: true,
    attribution: "AlienVault OTX + Tor exit list",
  },
  recon_sweep: {
    // Off unless NEXT_PUBLIC_INTEL_SWEEP_ENABLED=true (and the function's
    // INTEL_SWEEP_ENABLED secret) — Shodan InternetDB is "free for
    // non-commercial use"; confirm before enabling.
    enabled: process.env.NEXT_PUBLIC_INTEL_SWEEP_ENABLED === "true",
    gatedBy: "Shodan InternetDB terms are non-commercial; pending confirmation",
    attribution: "Shodan InternetDB + RDAP",
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
