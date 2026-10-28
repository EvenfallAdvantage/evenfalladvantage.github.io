/**
 * Type definitions for the Intel API responses returned by Supabase Edge
 * Functions in `supabase/functions/intel-*`. Clients (React components,
 * hooks) import these for type safety on the fetch result.
 *
 * Keep this file in sync with the JSON shapes returned by each function.
 *
 * Functions are deployed at `${SUPABASE_FUNCTIONS_URL}/intel-<name>`.
 */

// ─── Earthquakes ─────────────────────────────────────────────────
export interface IntelEarthquake {
  id: string;
  lat: number;
  lng: number;
  depth: number;
  magnitude: number;
  place: string;
  time: number;
  url: string;
  tsunami: number;
  type: string;
  felt: number | null;
  alert: string | null;
}
export interface IntelEarthquakesResponse {
  earthquakes: IntelEarthquake[];
  total: number;
  timestamp: string;
  error?: string;
}

// ─── Fires (NASA FIRMS + EONET volcanoes) ────────────────────────
export interface IntelFire {
  lat: number;
  lng: number;
  brightness: number;
  confidence: string;
  date: string;
  time: string;
  frp: number;
  type: "fire" | "volcano";
  title?: string;
}
export interface IntelFiresResponse {
  fires: IntelFire[];
  total: number;
  source: string;
  timestamp: string;
  error?: string;
}

// ─── EONET weather (severe storms, volcanoes, sea ice) ───────────
export interface IntelEonetEvent {
  id: string;
  title: string;
  category: string;
  type: string;
  icon: "alert" | "cyclone" | "volcano" | "ice";
  severity: "low" | "medium" | "high";
  lat: number;
  lng: number;
  date: string;
  source: string;
}
export interface IntelEonetResponse {
  events: IntelEonetEvent[];
  total: number;
  timestamp: string;
  error?: string;
}

// ─── Space weather (NOAA SWPC) ───────────────────────────────────
export interface IntelSpaceWeatherAlert {
  id: string;
  issue_datetime: string;
  message: string;
}
export interface IntelSpaceWeatherFlare {
  class: string;
  begin: string;
  peak: string;
  end: string;
}
export interface IntelSpaceWeatherResponse {
  kp_index: number;
  storm_level: string;
  storm_color: string;
  kp_timestamp: string;
  alerts: IntelSpaceWeatherAlert[];
  solar_flares: IntelSpaceWeatherFlare[];
  timestamp: string;
  error?: string;
}

// ─── News & GDELT ────────────────────────────────────────────────
export interface IntelNewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
  risk_score: number;
  coords: [number, number] | null;
  coords_default: boolean;
}
export interface IntelNewsResponse {
  news: IntelNewsItem[];
  total: number;
  timestamp: string;
  error?: string;
}

export interface IntelGdeltEvent {
  id: string;
  lat: number;
  lng: number;
  title: string;
  source: string;
  url: string;
  type: "conflict";
}
export interface IntelGdeltResponse {
  events: IntelGdeltEvent[];
  total: number;
  source: string;
  timestamp: string;
  error?: string;
}

// ─── Live news broadcasters (static curated list) ────────────────
export interface IntelLiveNewsFeed {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  url: string;
  embed_allowed: boolean;
  category: "mainstream" | "government" | "finance" | "conflict" | "state";
  language: string;
}
export interface IntelLiveNewsResponse {
  feeds: IntelLiveNewsFeed[];
  total: number;
  categories: string[];
  timestamp: string;
}

// ─── Nuclear infrastructure (static) ─────────────────────────────
export interface IntelNuclearFacility {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  status: string;
  reactors: number;
  capacityMW: number;
  owner: string;
}
export interface IntelInfrastructureResponse {
  infrastructure: IntelNuclearFacility[];
  total: number;
  timestamp: string;
}

// ─── Conflict zones (static curated) ─────────────────────────────
export interface IntelConflictZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  severity: "active_war" | "high_tension" | "elevated";
  tags: string[];
}
export interface IntelConflictZonesResponse {
  zones: IntelConflictZone[];
  total: number;
  timestamp: string;
}

// ─── Maritime (static ports + chokepoints, live AIS gated) ───────
export interface IntelMaritimePort {
  name: string;
  country: string;
  lat: number;
  lng: number;
  type: "container" | "energy" | "naval";
  volume?: string;
  rank?: number;
  fleet?: string;
}
export interface IntelMaritimeChokepoint {
  name: string;
  lat: number;
  lng: number;
  traffic: string;
  risk: "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";
}
export interface IntelMaritimeResponse {
  ports: IntelMaritimePort[];
  chokepoints: IntelMaritimeChokepoint[];
  ships: never[]; // populated later by side worker; empty here.
  total_ports: number;
  total_chokepoints: number;
  total_ships: 0;
  ais_live: false;
  timestamp: string;
}

// ─── Country risk + exchanges ────────────────────────────────────
export interface IntelCountryRow {
  code: string;
  risk_score: number;
  risk_level: "CRITICAL" | "HIGH" | "ELEVATED" | "LOW";
  tags: string[];
}
export interface IntelExchangeRow {
  name: string;
  country: string;
  open: boolean;
}
export interface IntelCountryRiskResponse {
  countries: IntelCountryRow[];
  exchanges: IntelExchangeRow[];
  open_exchanges: number;
  total_exchanges: number;
  timestamp: string;
  error?: string;
}

// ─── Cyber threats (CISA KEV) ────────────────────────────────────
export interface IntelCyberThreat {
  id: string;
  name: string;
  vendor: string;
  product: string;
  severity: "CRITICAL";
  date: string;
  due: string;
  source: "CISA KEV";
}
export interface IntelCyberThreatsResponse {
  threats: IntelCyberThreat[];
  stats: {
    cisa_total?: number;
    shadowserver?: "active" | "unavailable";
    active_cves: number;
    threat_level: "CRITICAL" | "HIGH" | "ELEVATED";
  };
  timestamp: string;
  error?: string;
}

// ─── Region dossier ──────────────────────────────────────────────
export interface IntelRegionDossierResponse {
  coordinates: { lat: number; lng: number };
  location: {
    city?: string;
    state?: string;
    country?: string;
    country_code?: string;
    display_name?: string;
  };
  country: {
    name: string;
    official_name: string;
    capital: string;
    population: number;
    area: number;
    region: string;
    subregion: string;
    languages: string[];
    currencies: string[];
    flag: string;
    flag_url: string;
    timezones: string[];
  } | null;
  head_of_state: { name?: string; position?: string } | null;
  wikipedia: { title?: string; extract?: string; thumbnail?: string } | null;
  timestamp: string;
}

// ─── CCTV ────────────────────────────────────────────────────────
export type CctvStreamType = "jpg" | "hls" | "iframe";

export interface CctvCamera {
  id: string;
  lat: number;
  lng: number;
  name: string;
  city: string;
  country: string;
  feed_url?: string;
  stream_url?: string;
  stream_type?: CctvStreamType;
  external_url?: string;
  source: string;
  /** Provider credit (client-attached from the bbox response's attribution map). */
  attribution?: string;
  /** Compass facing, when the catalog serves one (not yet: see camera-cone.ts). */
  heading_deg?: number | null;
  /** Horizontal field of view in degrees, when served. */
  fov_deg?: number | null;
}
export interface IntelCctvResponse {
  cameras: CctvCamera[];
  total: number;
  sources: Record<string, number>;
  regions: string[];
  timestamp: string;
  gated_by?: string;
  error?: string;
}
export interface CctvCluster { id: string; lat: number; lng: number; count: number; sample_id: string }
/**
 * intel-cctv?bbox= response. `mode` is absent when an older deployment
 * ignored bbox and returned the legacy full list (handled by the client).
 */
export interface IntelCctvBboxResponse {
  mode?: "clusters" | "points";
  total: number;
  sources: Record<string, number>;
  attribution?: Record<string, string>;
  truncated?: boolean;
  cameras?: CctvCamera[];
  clusters?: CctvCluster[];
  zoom?: number;
  timestamp?: string;
  gated_by?: string;
  error?: string;
}

// ─── OSINT: DNS ──────────────────────────────────────────────────
export interface IntelDnsRecord {
  name: string;
  type: number;
  ttl: number;
  data: string;
}
export interface IntelDnsResponse {
  domain: string;
  records: Record<string, IntelDnsRecord[]>;
  summary: {
    ip_addresses: string[];
    mail_servers: string[];
    nameservers: string[];
    total_records: number;
  };
  timestamp: string;
}

// ─── OSINT: WHOIS ────────────────────────────────────────────────
export interface IntelWhoisResponse {
  domain: string;
  rdap?: {
    handle: string;
    name: string;
    status: string[];
    events: Array<{ action: string; date: string }>;
    nameservers: string[];
    entities: Array<{ handle: string; roles: string[]; name?: string; org?: string }>;
  };
  registration?: string;
  expiration?: string;
  last_changed?: string;
  http?: {
    status: number;
    headers: Record<string, string>;
    redirected: boolean;
    final_url: string;
  };
  security_score?: { score: number; max: number; grade: "A" | "B" | "C" | "F" };
  timestamp: string;
}

// ─── OSINT: IP (RIR RDAP + reverse DNS) ──────────────────────────
export interface IntelRdapNetwork {
  handle: string;
  name: string;
  cidr: string[];
  start: string;
  end: string;
  type: string;
  country: string;
  org: string;
  abuse_email: string;
  registry_url: string;
}
export interface IntelIpResponse {
  ip: string;
  source?: "rdap";
  network?: IntelRdapNetwork;
  ptr?: string[];
  error?: string;
  timestamp: string;
}

// ─── OSINT: CVE ──────────────────────────────────────────────────
export interface IntelCveResponse {
  id: string;
  description: string;
  cvss: number | null;
  cvss_vector?: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  cwe: string | null;
  affected: Array<{ vendor: string; product: string; versions: string[] }>;
  references: string[];
  published: string | null;
  modified: string | null;
  source: "mitre" | "circl" | "unavailable";
}

// ─── OSINT: Threats (OTX) ────────────────────────────────────────
export interface IntelThreatsResponse {
  pulses?: Array<{
    name: string;
    description: string;
    created: string;
    modified: string;
    tags: string[];
    adversary: string;
    targeted_countries: string[];
    indicators_count: number;
  }>;
  tor_exit_node?: boolean | null;
  otx?: {
    reputation?: number;
    pulse_count: number;
    country?: string;
    asn?: string;
    whois?: { registrar?: string; creation_date?: string; expiration_date?: string };
  };
  threat_level: "HIGH" | "MEDIUM" | "LOW";
  timestamp: string;
}

// ─── OSINT: ASN (RIR RDAP + PeeringDB) ───────────────────────────
export interface IntelRdapAutnum {
  number: number;
  handle: string;
  name: string;
  country: string;
  org: string;
  abuse_email: string;
  registry_url: string;
}
export interface IntelPeeringDbNet {
  name: string;
  aka: string;
  website: string;
  type: string;
  scope: string;
  policy: string;
  prefixes4: number | null;
  prefixes6: number | null;
  ix_count: number;
  fac_count: number;
  irr_as_set: string;
  url: string;
}
export interface IntelBgpResponse {
  query: string;
  type: "ip" | "asn";
  asn?: IntelRdapAutnum;
  peeringdb?: IntelPeeringDbNet;
  network?: IntelRdapNetwork;
  error?: string;
  timestamp: string;
}

// ─── OSINT: Certs ────────────────────────────────────────────────
export interface IntelCertsResponse {
  domain: string;
  certificates: Array<{
    id: number;
    issuer: string;
    common_name: string;
    name_value: string;
    not_before: string;
    not_after: string;
    serial: string;
  }>;
  subdomains: string[];
  total_certs: number;
  unique_subdomains: number;
  timestamp: string;
  error?: string;
}

// ─── OSINT: Sweep ────────────────────────────────────────────────
export interface SweepDevice {
  ip: string;
  ports: number[];
  hostnames: string[];
  cpes: string[];
  vulns: string[];
  tags: string[];
  device_type: string;
  device_icon: string;
  device_color: string;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
}
export interface SweepResult {
  center: {
    lat: number;
    lng: number;
    city: string;
    region: string;
    country: string;
    countryCode: string;
    isp: string;
    asn: string;
    org: string;
  };
  subnet: string;
  cidr: number;
  target_ip: string;
  devices: SweepDevice[];
  summary: {
    total_hosts: number;
    total_responsive: number;
    device_breakdown: Record<string, number>;
  };
  sweep_time_ms: number;
}

// ─── Natural hazards (intel-hazards, normalized) ─────────────────
export type HazardKind =
  | "warning" | "watch" | "advisory"
  | "quake" | "fire" | "perimeter"
  | "cyclone" | "cyclone_cone" | "cyclone_track"
  | "volcano";
export type HazardSource = "warnings" | "quakes" | "fires" | "perimeters" | "tropical" | "volcanoes";
export type HazardGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };
export interface IntelHazard {
  id: string;
  kind: HazardKind;
  severity: 1 | 2 | 3 | 4;
  title: string;
  geometry: HazardGeometry;
  starts_at: string | null;
  ends_at: string | null;
  source: string;
  url: string | null;
  updated_at: string | null;
  props?: Record<string, string | number | boolean | null>;
}
export interface IntelHazardsResponse {
  hazards: IntelHazard[];
  sources: Partial<Record<HazardSource, { ok: boolean; count: number; stale?: boolean; error?: string }>>;
  timestamp: string;
}

// ─── Traffic Flow & Road Incidents (intel-traffic) ───────────────
export type RoadIncidentKind = "closure" | "crash" | "construction" | "hazard" | "congestion";
export type RoadIncidentSeverity = "minor" | "moderate" | "major" | "critical";

export interface IntelRoadIncident {
  id: string;
  source: string;
  kind: RoadIncidentKind;
  severity: RoadIncidentSeverity;
  title: string;
  description: string;
  road: string | null;
  direction: string | null;
  lat: number;
  lng: number;
  startTime: string | null;
  endTime: string | null;
  updatedAt: string | null;
  attribution: string;
}

export interface IntelTrafficIncidentsResponse {
  incidents: IntelRoadIncident[];
  total: number;
  bbox: [number, number, number, number];
  sources: Record<string, { ok: boolean; count: number; error?: string }>;
  attributions: string[];
  flowTilesAvailable?: boolean;
  timestamp: string;
  error?: string;
}
