/**
 * Type definitions for the Intel API responses returned by Supabase Edge
 * Functions in `supabase/functions/intel-*`. Clients (React components,
 * hooks) import these for type safety on the fetch result.
 *
 * Keep this file in sync with the JSON shapes returned by each function.
 *
 * Functions are deployed at `${SUPABASE_FUNCTIONS_URL}/intel-<name>`.
 */

// ─── Lightning (Blitzortung WebSocket → GeoJSON) ─────────────────
export interface IntelLightningStrike {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { time: number; id: number; src: number };
}
export interface IntelLightningResponse {
  type: "FeatureCollection";
  features: IntelLightningStrike[];
  error?: string;
}

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

// ─── OSINT: IP ───────────────────────────────────────────────────
export interface IntelIpResponse {
  ip: string;
  geo?: {
    country: string;
    country_code: string;
    region: string;
    city: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as_number: string;
    as_name: string;
    is_mobile: boolean;
    is_proxy: boolean;
    is_hosting: boolean;
  };
  reputation: {
    is_proxy: boolean;
    is_hosting: boolean;
    is_mobile: boolean;
    risk_level: "HIGH" | "MEDIUM" | "LOW";
  };
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

// ─── OSINT: BGP ──────────────────────────────────────────────────
export interface IntelBgpResponse {
  query: string;
  type: "ip" | "asn";
  ip?: unknown;
  asn?: unknown;
  prefixes?: {
    ipv4: unknown[];
    ipv6: unknown[];
    total_v4: number;
    total_v6: number;
  };
  peers?: { upstream: unknown[]; total: number };
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
