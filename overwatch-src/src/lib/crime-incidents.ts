/**
 * Crime Incidents & Sex Offender Overlay — Geo-Risk Map Data
 *
 * Phase 1: Socrata SODA API (free, no key) — crime incidents from city open data portals
 * Phase 2: Family Watchdog API (paid, key-gated) — registered sex offenders
 * Phase 3: NSOPW fallback link (free, no API)
 */

// ────────────────────────────── Types ──────────────────────────────

export type CrimeIncident = {
  lat: number;
  lon: number;
  type: "violent" | "property" | "other";
  category: string;
  description: string;
  date: string;
  source: string;
};

export type SexOffender = {
  lat: number;
  lon: number;
  name: string;
  address: string;
  offenses: string;
  source: string;
};

// ────────────────────────────── Socrata City Registry ──────────────────────────────

type SocrataCity = {
  domain: string;
  dataset: string;
  latCol: string;
  lonCol: string;
  typeCol: string;
  descCol: string;
  dateCol: string;
  locationCol?: string;
};

const SOCRATA_CITIES: Record<string, SocrataCity> = {
  "chicago, illinois": {
    domain: "data.cityofchicago.org",
    dataset: "ijzp-q8t2",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "primary_type",
    descCol: "description",
    dateCol: "date",
  },
  "new york, new york": {
    domain: "data.cityofnewyork.us",
    dataset: "5uac-w243",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "ofns_desc",
    descCol: "pd_desc",
    dateCol: "cmplnt_fr_dt",
  },
  "los angeles, california": {
    domain: "data.lacity.org",
    dataset: "2nrs-mtv8",
    latCol: "lat",
    lonCol: "lon",
    typeCol: "crm_cd_desc",
    descCol: "crm_cd_desc",
    dateCol: "date_occ",
  },
  "seattle, washington": {
    domain: "data.seattle.gov",
    dataset: "tazs-3rd5",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "offense_parent_group",
    descCol: "offense",
    dateCol: "report_datetime",
  },
  "austin, texas": {
    domain: "data.austintexas.gov",
    dataset: "fdj4-gpfu",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "crime_type",
    descCol: "description",
    dateCol: "rep_date",
  },
  "denver, colorado": {
    domain: "data.denvergov.org",
    dataset: "v8rs-65ij",
    latCol: "geo_lat",
    lonCol: "geo_lon",
    typeCol: "offense_category_id",
    descCol: "offense_type_id",
    dateCol: "reported_date",
  },
  "san francisco, california": {
    domain: "data.sfgov.org",
    dataset: "wg3w-h783",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "incident_category",
    descCol: "incident_subcategory",
    dateCol: "incident_date",
  },
  "nashville, tennessee": {
    domain: "data.nashville.gov",
    dataset: "2u6v-ujjs",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "offense_description",
    descCol: "offense_description",
    dateCol: "incident_occurred",
  },
  "dallas, texas": {
    domain: "www.dallasopendata.com",
    dataset: "qv6i-rri7",
    latCol: "geocoded_column.latitude",
    lonCol: "geocoded_column.longitude",
    typeCol: "nibrs_crime_category",
    descCol: "type_of_incident",
    dateCol: "date1_of_occurrence",
    locationCol: "geocoded_column",
  },
  "portland, oregon": {
    domain: "public.tableau.com",
    dataset: "",
    latCol: "lat",
    lonCol: "lon",
    typeCol: "offense_type",
    descCol: "offense_type",
    dateCol: "report_date",
  },
  "kansas city, missouri": {
    domain: "data.kcmo.org",
    dataset: "pxaa-ahcm",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "description",
    descCol: "description",
    dateCol: "reported_date",
  },
  "cincinnati, ohio": {
    domain: "data.cincinnati-oh.gov",
    dataset: "k59e-2pvf",
    latCol: "latitude_x",
    lonCol: "longitude_x",
    typeCol: "offense",
    descCol: "offense",
    dateCol: "date_reported",
  },
  "baltimore, maryland": {
    domain: "data.baltimorecity.gov",
    dataset: "wsfq-mvij",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "description",
    descCol: "description",
    dateCol: "crimedate",
  },
  "detroit, michigan": {
    domain: "data.detroitmi.gov",
    dataset: "6gdg-y3kf",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "offense_category",
    descCol: "offense_description",
    dateCol: "incident_timestamp",
  },
  "atlanta, georgia": {
    domain: "dpcd-coah.data.socrata.com",
    dataset: "wazb-q6gm",
    latCol: "lat",
    lonCol: "long",
    typeCol: "crime",
    descCol: "crime",
    dateCol: "occur_date",
  },
  "memphis, tennessee": {
    domain: "data.memphistn.gov",
    dataset: "ybsi-jur4",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "agency_crimetype",
    descCol: "agency_crimetype",
    dateCol: "offense_date",
  },
  "philadelphia, pennsylvania": {
    domain: "phl.carto.com",
    dataset: "",
    latCol: "lat",
    lonCol: "lng",
    typeCol: "text_general_code",
    descCol: "text_general_code",
    dateCol: "dispatch_date",
  },
  "washington, district of columbia": {
    domain: "opendata.dc.gov",
    dataset: "89t7-jcup",
    latCol: "latitude",
    lonCol: "longitude",
    typeCol: "offense",
    descCol: "offense",
    dateCol: "report_dat",
  },
};

// ────────────────────────────── Classification ──────────────────────────────

const VIOLENT_KEYWORDS = [
  "assault", "battery", "homicide", "murder", "robbery", "rape",
  "kidnap", "manslaughter", "shooting", "stabbing", "weapon",
  "arson", "sex offense", "sexual", "domestic", "aggravated",
  "carjacking", "intimidation", "threat",
];

const PROPERTY_KEYWORDS = [
  "theft", "burglary", "larceny", "motor vehicle", "shoplifting",
  "vandalism", "criminal damage", "trespass", "fraud", "forgery",
  "stolen", "breaking", "entering", "property",
];

function classifyIncident(typeStr: string): "violent" | "property" | "other" {
  const lower = typeStr.toLowerCase();
  if (VIOLENT_KEYWORDS.some((k) => lower.includes(k))) return "violent";
  if (PROPERTY_KEYWORDS.some((k) => lower.includes(k))) return "property";
  return "other";
}

// ────────────────────────────── Cache ──────────────────────────────

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const _incidentCache: Record<string, { ts: number; data: CrimeIncident[] }> = {};
const _offenderCache: Record<string, { ts: number; data: SexOffender[] }> = {};

// ────────────────────────────── Phase 1: Socrata Fetch ──────────────────────────────

function findSocrataCity(city: string, state: string): SocrataCity | null {
  const key = `${city.toLowerCase()}, ${state.toLowerCase()}`;
  return SOCRATA_CITIES[key] || null;
}

export async function fetchNearbyIncidents(
  lat: number,
  lon: number,
  city: string,
  state: string,
  radiusMeters = 1609
): Promise<CrimeIncident[]> {
  const cacheKey = `${lat.toFixed(4)}|${lon.toFixed(4)}|${city}`;
  const cached = _incidentCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const cfg = findSocrataCity(city, state);
  if (!cfg || !cfg.dataset) {
    _incidentCache[cacheKey] = { ts: Date.now(), data: [] };
    return [];
  }

  try {
    // Build SoQL query using within_circle if locationCol exists, otherwise lat/lon bounding box
    let url: string;
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateStr = oneYearAgo.toISOString().split("T")[0];

    if (cfg.locationCol) {
      url =
        `https://${cfg.domain}/resource/${cfg.dataset}.json?` +
        `$where=within_circle(${cfg.locationCol},${lat},${lon},${radiusMeters})` +
        ` AND ${cfg.dateCol} > '${dateStr}'` +
        `&$limit=75&$order=${cfg.dateCol} DESC`;
    } else {
      // Bounding box approximation: 1 degree lat ≈ 111km
      const latDelta = radiusMeters / 111000;
      const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));
      url =
        `https://${cfg.domain}/resource/${cfg.dataset}.json?` +
        `$where=${cfg.latCol} between '${(lat - latDelta).toFixed(6)}' and '${(lat + latDelta).toFixed(6)}'` +
        ` AND ${cfg.lonCol} between '${(lon - lonDelta).toFixed(6)}' and '${(lon + lonDelta).toFixed(6)}'` +
        ` AND ${cfg.dateCol} > '${dateStr}'` +
        `&$limit=75&$order=${cfg.dateCol} DESC`;
    }

    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      console.warn(`Socrata ${cfg.domain}: HTTP ${res.status}`);
      _incidentCache[cacheKey] = { ts: Date.now(), data: [] };
      return [];
    }

    const raw: Record<string, unknown>[] = await res.json();

    const incidents: CrimeIncident[] = raw
      .map((r) => {
        const rLat = parseFloat(String(r[cfg.latCol] ?? "0"));
        const rLon = parseFloat(String(r[cfg.lonCol] ?? "0"));
        if (!rLat || !rLon) return null;

        const typeStr = String(r[cfg.typeCol] || "Unknown");
        const desc = String(r[cfg.descCol] || typeStr);
        const date = String(r[cfg.dateCol] || "");

        return {
          lat: rLat,
          lon: rLon,
          type: classifyIncident(typeStr),
          category: typeStr.length > 40 ? typeStr.slice(0, 37) + "..." : typeStr,
          description: desc.length > 60 ? desc.slice(0, 57) + "..." : desc,
          date: date ? new Date(date).toLocaleDateString() : "Unknown",
          source: `${city} Open Data (Socrata)`,
        } as CrimeIncident;
      })
      .filter(Boolean) as CrimeIncident[];

    _incidentCache[cacheKey] = { ts: Date.now(), data: incidents };
    return incidents;
  } catch (e) {
    console.warn("Socrata fetch error:", e);
    _incidentCache[cacheKey] = { ts: Date.now(), data: [] };
    return [];
  }
}

// ────────────────────────────── Phase 2: Family Watchdog ──────────────────────────────

export function hasFamilyWatchdogKey(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("fw_api_key"));
}

export function setFamilyWatchdogKey(key: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("fw_api_key", key);
  }
}

export function getFamilyWatchdogKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("fw_api_key") || "";
}

export async function fetchNearbyOffenders(
  lat: number,
  lon: number,
  radiusMiles = 1
): Promise<SexOffender[]> {
  const key = getFamilyWatchdogKey();
  if (!key) return [];

  const cacheKey = `off_${lat.toFixed(4)}|${lon.toFixed(4)}`;
  const cached = _offenderCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    // Convert radius to lat/lon bounding box
    const delta = radiusMiles * 0.0145; // ~1 mile ≈ 0.0145 degrees
    const minLat = lat - delta;
    const maxLat = lat + delta;
    const minLon = lon - delta;
    const maxLon = lon + delta;

    const url =
      `https://services.familywatchdog.us/rest/json.asp?` +
      `key=${encodeURIComponent(key)}&type=searchbylatlong` +
      `&lat=${lat}&long=${lon}` +
      `&minlat=${minLat.toFixed(6)}&maxlat=${maxLat.toFixed(6)}` +
      `&minlong=${minLon.toFixed(6)}&maxlong=${maxLon.toFixed(6)}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Family Watchdog: HTTP ${res.status}`);
      _offenderCache[cacheKey] = { ts: Date.now(), data: [] };
      return [];
    }

    const raw = await res.json();

    // FW returns an array of offender objects or an error object
    if (!Array.isArray(raw)) {
      console.warn("Family Watchdog: unexpected response", raw);
      _offenderCache[cacheKey] = { ts: Date.now(), data: [] };
      return [];
    }

    const offenders: SexOffender[] = raw
      .slice(0, 50) // cap at 50
      .map((o: Record<string, unknown>) => ({
        lat: parseFloat(String(o.lat || o.latitude || "0")),
        lon: parseFloat(String(o.lng || o.lon || o.longitude || "0")),
        name: String(o.name || "Unknown"),
        address: String(o.address || ""),
        offenses: String(o.offenses || o.offense || "Registered Sex Offender"),
        source: "Family Watchdog",
      }))
      .filter((o) => o.lat && o.lon);

    _offenderCache[cacheKey] = { ts: Date.now(), data: offenders };
    return offenders;
  } catch (e) {
    console.warn("Family Watchdog fetch error:", e);
    _offenderCache[cacheKey] = { ts: Date.now(), data: [] };
    return [];
  }
}

// ────────────────────────────── Phase 3: NSOPW Link ──────────────────────────────

export function getNSOPWSearchUrl(address: string, city: string, state: string): string {
  return `https://www.nsopw.gov/search-public-sex-offender-registries?SearchAddress=${encodeURIComponent(`${address} ${city} ${state}`.trim())}`;
}

// ────────────────────────────── Aggregate Fetch ──────────────────────────────

export type MapOverlayData = {
  incidents: CrimeIncident[];
  offenders: SexOffender[];
  hasSocrataData: boolean;
  hasOffenderKey: boolean;
};

export async function fetchMapOverlayData(
  lat: number,
  lon: number,
  city: string,
  state: string
): Promise<MapOverlayData> {
  const [incidents, offenders] = await Promise.all([
    fetchNearbyIncidents(lat, lon, city, state),
    fetchNearbyOffenders(lat, lon),
  ]);

  return {
    incidents,
    offenders,
    hasSocrataData: incidents.length > 0,
    hasOffenderKey: hasFamilyWatchdogKey(),
  };
}

// ────────────────────────────── Available Cities List ──────────────────────────────

export function getSocrataCities(): string[] {
  return Object.keys(SOCRATA_CITIES)
    .filter((k) => SOCRATA_CITIES[k].dataset !== "")
    .map((k) => k.split(", ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(", "));
}
