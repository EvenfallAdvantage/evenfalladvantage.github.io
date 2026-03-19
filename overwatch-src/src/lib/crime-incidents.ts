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

// ── Helper: shorthand to define a city entry ──
function c(domain: string, dataset: string, latCol: string, lonCol: string, typeCol: string, descCol: string, dateCol: string, locationCol?: string): SocrataCity {
  return { domain, dataset, latCol, lonCol, typeCol, descCol, dateCol, locationCol };
}

// 60+ known Socrata-powered city crime datasets
const SOCRATA_CITIES: Record<string, SocrataCity> = {
  // ── Major metros ──
  "chicago, illinois":            c("data.cityofchicago.org", "ijzp-q8t2", "latitude", "longitude", "primary_type", "description", "date"),
  "new york, new york":           c("data.cityofnewyork.us", "5uac-w243", "latitude", "longitude", "ofns_desc", "pd_desc", "cmplnt_fr_dt"),
  "los angeles, california":      c("data.lacity.org", "2nrs-mtv8", "lat", "lon", "crm_cd_desc", "crm_cd_desc", "date_occ"),
  "san francisco, california":    c("data.sfgov.org", "wg3w-h783", "latitude", "longitude", "incident_category", "incident_subcategory", "incident_date"),
  "seattle, washington":          c("data.seattle.gov", "tazs-3rd5", "latitude", "longitude", "offense_parent_group", "offense", "report_datetime"),
  "austin, texas":                c("data.austintexas.gov", "fdj4-gpfu", "latitude", "longitude", "crime_type", "description", "rep_date"),
  "denver, colorado":             c("data.denvergov.org", "v8rs-65ij", "geo_lat", "geo_lon", "offense_category_id", "offense_type_id", "reported_date"),
  "dallas, texas":                c("www.dallasopendata.com", "qv6i-rri7", "geocoded_column.latitude", "geocoded_column.longitude", "nibrs_crime_category", "type_of_incident", "date1_of_occurrence", "geocoded_column"),
  "nashville, tennessee":         c("data.nashville.gov", "2u6v-ujjs", "latitude", "longitude", "offense_description", "offense_description", "incident_occurred"),
  "kansas city, missouri":        c("data.kcmo.org", "pxaa-ahcm", "latitude", "longitude", "description", "description", "reported_date"),
  "cincinnati, ohio":             c("data.cincinnati-oh.gov", "k59e-2pvf", "latitude_x", "longitude_x", "offense", "offense", "date_reported"),
  "baltimore, maryland":          c("data.baltimorecity.gov", "wsfq-mvij", "latitude", "longitude", "description", "description", "crimedate"),
  "detroit, michigan":            c("data.detroitmi.gov", "6gdg-y3kf", "latitude", "longitude", "offense_category", "offense_description", "incident_timestamp"),
  "memphis, tennessee":           c("data.memphistn.gov", "ybsi-jur4", "latitude", "longitude", "agency_crimetype", "agency_crimetype", "offense_date"),
  "washington, district of columbia": c("opendata.dc.gov", "89t7-jcup", "latitude", "longitude", "offense", "offense", "report_dat"),
  // ── Additional cities (A-Z) ──
  "albuquerque, new mexico":      c("data.cabq.gov", "bxgq-28vz", "latitude", "longitude", "crime_type", "description", "date"),
  "anchorage, alaska":            c("data.muni.org", "n5cg-knpm", "latitude", "longitude", "offense", "offense", "reported_date"),
  "arlington, texas":             c("data.arlingtontx.gov", "bsq9-gfcm", "latitude", "longitude", "ucr_offense_description", "ucr_offense_description", "date_of_report"),
  "baton rouge, louisiana":       c("data.brla.gov", "5rji-ddnu", "latitude", "longitude", "offense_desc", "offense_desc", "offense_date"),
  "birmingham, alabama":          c("data.birminghamal.gov", "2yav-gsjn", "latitude", "longitude", "nature", "nature", "reportdatetime"),
  "boise, idaho":                 c("opendata.cityofboise.org", "bkka-u5b7", "latitude", "longitude", "offense_description", "offense_description", "report_date"),
  "boston, massachusetts":         c("data.boston.gov", "63ix-e4xh", "lat", "long", "offense_description", "offense_description", "occurred_on_date"),
  "buffalo, new york":            c("data.buffalony.gov", "d6g9-xbgu", "latitude", "longitude", "incident_type", "incident_description", "incident_datetime"),
  "chandler, arizona":            c("data.chandleraz.gov", "iu6b-vt9t", "latitude", "longitude", "crime_type", "crime_type", "report_date"),
  "charlotte, north carolina":    c("data.charlottenc.gov", "va7u-rfhk", "latitude", "longitude", "nibrs_description", "nibrs_description", "date_reported"),
  "chattanooga, tennessee":       c("www.chattadata.org", "eaae-be9t", "latitude", "longitude", "offense_description", "offense_description", "date_occurred"),
  "colorado springs, colorado":   c("data.coloradosprings.gov", "2t87-5bvi", "latitude", "longitude", "offense_type", "offense_type", "reported_date"),
  "columbus, ohio":               c("opendata.columbus.gov", "7xri-n2za", "latitude", "longitude", "offense", "offense", "report_date"),
  "fort worth, texas":            c("data.fortworthtexas.gov", "k6ic-7kp7", "latitude", "longitude", "nature_of_call", "nature_of_call", "reported_date"),
  "honolulu, hawaii":             c("data.honolulu.gov", "a96q-gyhq", "latitude", "longitude", "type", "type", "date"),
  "houston, texas":               c("data.houstontx.gov", "78g2-2znh", "latitude", "longitude", "offense_type", "offense_type", "occurrence_date"),
  "indianapolis, indiana":        c("data.indy.gov", "2tqx-pawd", "latitude", "longitude", "ucr_description", "ucr_description", "occurred_dt"),
  "jacksonville, florida":        c("data.coj.net", "rvhk-4bte", "latitude", "longitude", "crime_type", "crime_type", "date"),
  "jersey city, new jersey":      c("data.jerseycitynj.gov", "5tai-ywdh", "latitude", "longitude", "offense_description", "offense_description", "date_reported"),
  "knoxville, tennessee":         c("knoxvilletn.data.socrata.com", "bx7k-zc3b", "latitude", "longitude", "offense", "offense", "date_occurred"),
  "las vegas, nevada":            c("opendata.lasvegasnevada.gov", "jxi8-5vhu", "latitude", "longitude", "offense_description", "offense_description", "reported_date"),
  "lexington, kentucky":          c("data.lexingtonky.gov", "2c8e-sich", "latitude", "longitude", "crime_type", "crime_type", "date_reported"),
  "little rock, arkansas":        c("data.littlerock.gov", "btku-fw3r", "latitude", "longitude", "offense", "offense", "date_occurred"),
  "louisville, kentucky":         c("data.louisvilleky.gov", "vc2s-wp5y", "latitude", "longitude", "crime_type", "crime_type", "date_reported"),
  "mesa, arizona":                c("data.mesaaz.gov", "39rt-2rfj", "latitude", "longitude", "crime_type", "crime_type", "report_date"),
  "miami, florida":               c("datahub-miamigov.opendata.arcgis.com", "", "latitude", "longitude", "offense_type", "offense_type", "report_date"),
  "milwaukee, wisconsin":         c("data.milwaukee.gov", "9sys-4i3i", "latitude", "longitude", "arson", "arson", "reporteddatetime"),
  "minneapolis, minnesota":       c("opendata.minneapolismn.gov", "xbew-k5be", "latitude", "longitude", "offense", "description", "reporteddatetime"),
  "new orleans, louisiana":       c("data.nola.gov", "kwfr-m3hr", "latitude", "longitude", "type_text", "type_text", "occurrence_date"),
  "norfolk, virginia":            c("data.norfolk.gov", "r7mn-sp6h", "latitude", "longitude", "offense", "offense", "report_date"),
  "oakland, california":          c("data.oaklandca.gov", "ppgh-7dqv", "latitude", "longitude", "crimetype", "description", "datetime"),
  "oklahoma city, oklahoma":      c("data.okc.gov", "4fy5-iqpd", "latitude", "longitude", "offense", "offense", "date"),
  "omaha, nebraska":              c("data.cityofomaha.org", "586v-395x", "latitude", "longitude", "crime", "crime", "reported_date"),
  "orlando, florida":             c("data.cityoforlando.net", "ryhf-m453", "latitude", "longitude", "case_offense_charge_type", "case_offense_charge_type", "case_datetime"),
  "philadelphia, pennsylvania":   c("phl.carto.com", "incidents_part1_part2", "lat", "lng", "text_general_code", "text_general_code", "dispatch_date"),
  "phoenix, arizona":             c("www.phoenixopendata.com", "b735-sfvu", "latitude", "longitude", "ucr_crime_category", "ucr_crime_category", "occurred_on"),
  "pittsburgh, pennsylvania":     c("data.wprdc.org", "35mq-hcnf", "latitude", "longitude", "offenses", "offenses", "incidenttime"),
  "portland, oregon":             c("public.tableau.com", "", "lat", "lon", "offense_type", "offense_type", "report_date"),
  "raleigh, north carolina":      c("data.raleighnc.gov", "e36f-impa", "latitude", "longitude", "lcr_desc", "lcr_desc", "reported_date"),
  "richmond, virginia":           c("data.richmondgov.com", "2caw-efnr", "latitude", "longitude", "offense", "offense", "dateoccured"),
  "sacramento, california":       c("data.cityofsacramento.org", "vkec-f4c4", "latitude", "longitude", "offense", "offense", "datetime"),
  "salt lake city, utah":         c("opendata.utah.gov", "c7wg-irea", "latitude", "longitude", "offense_type", "offense_type", "reported_date"),
  "san antonio, texas":           c("data.sanantonio.gov", "f9ak-q5uy", "latitude", "longitude", "category", "category", "report_date"),
  "san diego, california":        c("data.sandiego.gov", "tg35-8zvt", "latitude", "longitude", "charge_description", "charge_description", "date_time"),
  "san jose, california":         c("data.sanjoseca.gov", "59v3-gxh5", "latitude", "longitude", "stat_type", "stat_type", "date"),
  "savannah, georgia":            c("data.savannahga.gov", "mght-rmx4", "latitude", "longitude", "offense_description", "offense_description", "report_date"),
  "st. louis, missouri":          c("data.stlouis-mo.gov", "smqh-kdh7", "latitude", "longitude", "crime", "description", "dateoccur"),
  "st. petersburg, florida":      c("stat.stpete.org", "2eks-pg5j", "latitude", "longitude", "offense", "offense", "occurred_date"),
  "tampa, florida":               c("tempgis-tampagov.opendata.arcgis.com", "", "latitude", "longitude", "offense_desc", "offense_desc", "report_date"),
  "tucson, arizona":              c("data.tucsonaz.gov", "frax-hbhw", "latitude", "longitude", "statutdesc", "statutdesc", "date"),
  "tulsa, oklahoma":              c("www.cityoftulsa.org", "xqmf-hyeb", "latitude", "longitude", "crime_description", "crime_description", "report_date"),
  "virginia beach, virginia":     c("data.vbgov.com", "efbw-s5vm", "latitude", "longitude", "offense", "offense", "report_date"),
  "wichita, kansas":              c("data.wichita.gov", "hz7q-t3rs", "latitude", "longitude", "offense_description", "offense_description", "report_date"),
};

// ────────────────────────────── Socrata Discovery API (dynamic fallback) ──────────────────────────────

const _discoveryCache: Record<string, { ts: number; data: SocrataCity | null }> = {};
const DISCOVERY_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Common column name patterns for auto-detection
const LAT_PATTERNS = ["latitude", "lat", "geo_lat", "y", "latitude_x"];
const LON_PATTERNS = ["longitude", "lon", "long", "geo_lon", "x", "longitude_x", "lng"];
const TYPE_PATTERNS = ["offense", "primary_type", "crime_type", "offense_description", "crime", "crimetype", "nibrs_description", "description", "ofns_desc", "incident_category", "charge_description", "offense_type", "nature", "ucr_crime_category", "category", "type"];
const DATE_PATTERNS = ["date", "datetime", "report_date", "reported_date", "date_reported", "occurred_on_date", "incident_date", "occurrence_date", "report_datetime", "crimedate", "date_occ", "incident_timestamp", "reporteddatetime", "date_occurred"];

function matchColumn(columns: string[], patterns: string[]): string | null {
  // Exact match first
  for (const p of patterns) {
    if (columns.includes(p)) return p;
  }
  // Partial match
  for (const p of patterns) {
    const found = columns.find((col) => col.includes(p));
    if (found) return found;
  }
  return null;
}

async function discoverSocrataDataset(city: string, state: string): Promise<SocrataCity | null> {
  const key = `${city.toLowerCase()}, ${state.toLowerCase()}`;
  const cached = _discoveryCache[key];
  if (cached && Date.now() - cached.ts < DISCOVERY_TTL) return cached.data;

  try {
    // Search Socrata catalog for crime datasets matching this city
    const q = encodeURIComponent(`${city} crime incidents`);
    const url = `https://api.us.socrata.com/api/catalog/v1?q=${q}&categories=Public+Safety&only=datasets&limit=5`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) { _discoveryCache[key] = { ts: Date.now(), data: null }; return null; }

    const data = await res.json();
    const results = data?.results || [];

    for (const result of results) {
      const resource = result?.resource;
      if (!resource) continue;

      const domain = result?.metadata?.domain || "";
      const dataset = resource.id || "";
      const columns: string[] = (resource.columns_field_name || []).map((s: string) => s.toLowerCase());

      if (!dataset || columns.length === 0) continue;

      const latCol = matchColumn(columns, LAT_PATTERNS);
      const lonCol = matchColumn(columns, LON_PATTERNS);
      const typeCol = matchColumn(columns, TYPE_PATTERNS);
      const dateCol = matchColumn(columns, DATE_PATTERNS);

      if (latCol && lonCol && typeCol && dateCol) {
        const found: SocrataCity = {
          domain, dataset, latCol, lonCol,
          typeCol, descCol: typeCol, dateCol,
        };
        _discoveryCache[key] = { ts: Date.now(), data: found };
        return found;
      }
    }

    _discoveryCache[key] = { ts: Date.now(), data: null };
    return null;
  } catch (e) {
    console.warn("Socrata Discovery error:", e);
    _discoveryCache[key] = { ts: Date.now(), data: null };
    return null;
  }
}

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

  // Try static registry first, then dynamic discovery
  let cfg = findSocrataCity(city, state);
  if (!cfg || !cfg.dataset) {
    cfg = await discoverSocrataDataset(city, state);
  }
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

export const SOCRATA_CITY_COUNT = Object.keys(SOCRATA_CITIES).filter((k) => SOCRATA_CITIES[k].dataset !== "").length;
