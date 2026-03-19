/**
 * Crime Incidents, Environmental Risk & Sex Offender Overlay — Geo-Risk Map Data
 *
 * OSINT Sources (crime incidents):
 *   1. Socrata SODA API (free, no key) — 60+ static cities + dynamic discovery
 *   2. OpenDataSoft (free, no key) — public safety datasets across ODS portals
 *   3. ArcGIS Open Data Hubs (free, no key) — FeatureServer queries for city ArcGIS portals
 *   4. Crimeometer API (free tier: 100 calls/mo, key-gated) — national geocoded incidents
 *   5. UK Police API (free, no key) — street-level crime for England/Wales/NI
 *   6. CityProtect / RAIDS Online (free, no key) — Motorola public incidents API
 *
 * Environmental risk (Overpass / OpenStreetMap):
 *   7. Overpass API (free, no key) — crime-correlated POIs (bars, clubs, liquor, pawn, etc.)
 *
 * Sex offender sources:
 *   8. Family Watchdog API (paid, key-gated) — registered sex offenders
 *   9. NSOPW fallback link (free, no API) — DOJ registry search
 *
 * All incident sources are queried in parallel, collated, and deduplicated by
 * proximity + date + category before being returned to the map.
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

export type RiskPOI = {
  lat: number;
  lon: number;
  name: string;
  poiType: string; // "bar" | "nightclub" | "liquor_store" | "pawnbroker" | "casino" | etc.
};

export type EnvironmentalRisk = {
  pois: RiskPOI[];
  summary: Record<string, number>; // { bar: 5, nightclub: 2, ... }
  total: number;
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
  "nashville, tennessee":         c("data.nashville.gov", "", "latitude", "longitude", "offense_description", "offense_description", "incident_occurred"), // dataset CORS-blocks; falls to discovery
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
  "knoxville, tennessee":         c("knoxvilletn.data.socrata.com", "", "latitude", "longitude", "offense", "offense", "date_occurred"), // dataset 404; falls to discovery
  "las vegas, nevada":            c("opendata.lasvegasnevada.gov", "jxi8-5vhu", "latitude", "longitude", "offense_description", "offense_description", "reported_date"),
  "lexington, kentucky":          c("data.lexingtonky.gov", "2c8e-sich", "latitude", "longitude", "crime_type", "crime_type", "date_reported"),
  "little rock, arkansas":        c("data.littlerock.gov", "btku-fw3r", "latitude", "longitude", "offense", "offense", "date_occurred"),
  "louisville, kentucky":         c("data.louisvilleky.gov", "vc2s-wp5y", "latitude", "longitude", "crime_type", "crime_type", "date_reported"),
  "mesa, arizona":                c("data.mesaaz.gov", "39rt-2rfj", "latitude", "longitude", "crime_type", "crime_type", "report_date"),
  "miami, florida":               c("datahub-miamigov.opendata.arcgis.com", "", "latitude", "longitude", "offense_type", "offense_type", "report_date"),
  "milwaukee, wisconsin":         c("data.milwaukee.gov", "9sys-4i3i", "latitude", "longitude", "weaponused", "weaponused", "reporteddatetime"),
  "minneapolis, minnesota":       c("opendata.minneapolismn.gov", "xbew-k5be", "latitude", "longitude", "offense", "description", "reporteddatetime"),
  "new orleans, louisiana":       c("data.nola.gov", "kwfr-m3hr", "latitude", "longitude", "type_text", "type_text", "occurrence_date"),
  "norfolk, virginia":            c("data.norfolk.gov", "r7mn-sp6h", "latitude", "longitude", "offense", "offense", "report_date"),
  "oakland, california":          c("data.oaklandca.gov", "ppgh-7dqv", "latitude", "longitude", "crimetype", "description", "datetime"),
  "oklahoma city, oklahoma":      c("data.okc.gov", "4fy5-iqpd", "latitude", "longitude", "offense", "offense", "date"),
  "omaha, nebraska":              c("data.cityofomaha.org", "586v-395x", "latitude", "longitude", "crime", "crime", "reported_date"),
  "orlando, florida":             c("data.cityoforlando.net", "ryhf-m453", "latitude", "longitude", "case_offense_charge_type", "case_offense_charge_type", "case_datetime"),
  "philadelphia, pennsylvania":   c("phl.carto.com", "", "lat", "lng", "text_general_code", "text_general_code", "dispatch_date"), // Carto, not Socrata; falls to discovery
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
const _poiCache: Record<string, { ts: number; data: EnvironmentalRisk }> = {};

// ────────────────────────────── Deduplication ──────────────────────────────

// Two incidents are considered duplicates if they are within ~50m of each other,
// occurred on the same date, and have the same classification.
function dedupeIncidents(all: CrimeIncident[]): CrimeIncident[] {
  const seen = new Set<string>();
  const result: CrimeIncident[] = [];
  for (const inc of all) {
    // Hash: round lat/lon to ~50m grid, same date prefix, same type
    const key = `${inc.lat.toFixed(3)}|${inc.lon.toFixed(3)}|${inc.date?.slice(0, 10)}|${inc.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(inc);
  }
  return result;
}

// ────────────────────────────── Bounding-box helper ──────────────────────────────

function bbox(lat: number, lon: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111000;
  const lonDelta = radiusMeters / (111000 * Math.cos((lat * Math.PI) / 180));
  return { minLat: lat - latDelta, maxLat: lat + latDelta, minLon: lon - lonDelta, maxLon: lon + lonDelta };
}

function oneYearAgoStr(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split("T")[0];
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

// ────────────────────────────── Source 1: Socrata Fetch ──────────────────────────────

function findSocrataCity(city: string, state: string): SocrataCity | null {
  const key = `${city.toLowerCase()}, ${state.toLowerCase()}`;
  return SOCRATA_CITIES[key] || null;
}

async function fetchSocrata(
  lat: number, lon: number, city: string, state: string, radiusMeters: number
): Promise<CrimeIncident[]> {
  let cfg = findSocrataCity(city, state);
  if (!cfg || !cfg.dataset) cfg = await discoverSocrataDataset(city, state);
  if (!cfg || !cfg.dataset) return [];

  try {
    let url: string;
    const dateStr = oneYearAgoStr();

    if (cfg.locationCol) {
      url =
        `https://${cfg.domain}/resource/${cfg.dataset}.json?` +
        `$where=within_circle(${cfg.locationCol},${lat},${lon},${radiusMeters})` +
        ` AND ${cfg.dateCol} > '${dateStr}'` +
        `&$limit=75&$order=${cfg.dateCol} DESC`;
    } else {
      const b = bbox(lat, lon, radiusMeters);
      url =
        `https://${cfg.domain}/resource/${cfg.dataset}.json?` +
        `$where=${cfg.latCol} between '${b.minLat.toFixed(6)}' and '${b.maxLat.toFixed(6)}'` +
        ` AND ${cfg.lonCol} between '${b.minLon.toFixed(6)}' and '${b.maxLon.toFixed(6)}'` +
        ` AND ${cfg.dateCol} > '${dateStr}'` +
        `&$limit=75&$order=${cfg.dateCol} DESC`;
    }

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];

    const raw: Record<string, unknown>[] = await res.json();
    return raw
      .map((r) => {
        const rLat = parseFloat(String(r[cfg.latCol] ?? "0"));
        const rLon = parseFloat(String(r[cfg.lonCol] ?? "0"));
        if (!rLat || !rLon) return null;
        const typeStr = String(r[cfg.typeCol] || "Unknown");
        const desc = String(r[cfg.descCol] || typeStr);
        const date = String(r[cfg.dateCol] || "");
        return {
          lat: rLat, lon: rLon,
          type: classifyIncident(typeStr),
          category: truncate(typeStr, 40),
          description: truncate(desc, 60),
          date: date ? new Date(date).toLocaleDateString() : "Unknown",
          source: `Socrata (${city})`,
        } as CrimeIncident;
      })
      .filter(Boolean) as CrimeIncident[];
  } catch (e) {
    console.warn("Socrata fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 2: OpenDataSoft ──────────────────────────────

// ODS public search — queries the global ODS catalog for crime/public-safety
// datasets geofiltered to the target location.
async function fetchOpenDataSoft(
  lat: number, lon: number, city: string, radiusMeters: number
): Promise<CrimeIncident[]> {
  try {
    const dist = Math.max(radiusMeters, 1609);
    const url =
      `https://public.opendatasoft.com/api/records/1.0/search/?` +
      `q=crime+OR+incident+OR+offense+OR+police` +
      `&geofilter.distance=${lat}%2C${lon}%2C${dist}` +
      `&rows=50`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];

    const data = await res.json();
    const records: Record<string, unknown>[] = data?.records || [];

    return records
      .map((rec) => {
        const fields = (rec as { fields?: Record<string, unknown> }).fields || {};
        const geo = (rec as { geometry?: { coordinates?: number[] } }).geometry;
        const rLat = geo?.coordinates?.[1];
        const rLon = geo?.coordinates?.[0];
        if (!rLat || !rLon) return null;

        const typeStr = String(
          fields.offense || fields.crime_type || fields.incident_category ||
          fields.primary_type || fields.offense_description || fields.type || "Unknown"
        );
        const desc = String(
          fields.description || fields.offense_description || fields.incident_description || typeStr
        );
        const date = String(
          fields.date || fields.report_date || fields.datetime || fields.incident_date || ""
        );

        return {
          lat: rLat, lon: rLon,
          type: classifyIncident(typeStr),
          category: truncate(typeStr, 40),
          description: truncate(desc, 60),
          date: date ? new Date(date).toLocaleDateString() : "Unknown",
          source: "OpenDataSoft",
        } as CrimeIncident;
      })
      .filter(Boolean) as CrimeIncident[];
  } catch (e) {
    console.warn("OpenDataSoft fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 3: ArcGIS Open Data Hubs ──────────────────────────────

// Many cities publish crime data via ArcGIS Hub. We search the ArcGIS Hub
// catalog for public-safety FeatureServer layers near the target.

type ArcGISHub = {
  hubUrl: string; // ArcGIS Hub dataset search URL
  serviceUrl: string; // Direct FeatureServer URL
  layerId: number;
};

const ARCGIS_HUBS: Record<string, ArcGISHub> = {
  "miami, florida":          { hubUrl: "", serviceUrl: "https://services1.arcgis.com/CvuPhqcTQpZPT9qE/arcgis/rest/services/Miami_Police_Incidents/FeatureServer", layerId: 0 },
  "tampa, florida":          { hubUrl: "", serviceUrl: "https://services1.arcgis.com/5GKDnBSgTMmMPrlB/arcgis/rest/services/Tampa_Police_Calls/FeatureServer", layerId: 0 },
  "atlanta, georgia":        { hubUrl: "", serviceUrl: "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/Atlanta_Police_Crime/FeatureServer", layerId: 0 },
  "portland, oregon":        { hubUrl: "", serviceUrl: "https://services.arcgis.com/quVN97tn06YNGj9s/arcgis/rest/services/PPB_CrimeData/FeatureServer", layerId: 0 },
  "charlotte, north carolina": { hubUrl: "", serviceUrl: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/CMPD_Incidents/FeatureServer", layerId: 0 },
  "las vegas, nevada":       { hubUrl: "", serviceUrl: "https://services.arcgis.com/YXdNFBt1GC7Jr0M6/arcgis/rest/services/Metro_Police_Open_Data/FeatureServer", layerId: 0 },
  "tucson, arizona":         { hubUrl: "", serviceUrl: "https://services2.arcgis.com/fs7zDCeBQzITSQjR/arcgis/rest/services/Tucson_Police_Incidents/FeatureServer", layerId: 0 },
  "raleigh, north carolina": { hubUrl: "", serviceUrl: "https://services.arcgis.com/v400IkDOw1ad7Yad/arcgis/rest/services/Raleigh_Police_Incidents/FeatureServer", layerId: 0 },
};

async function fetchArcGIS(
  lat: number, lon: number, city: string, state: string, radiusMeters: number
): Promise<CrimeIncident[]> {
  const hub = ARCGIS_HUBS[`${city.toLowerCase()}, ${state.toLowerCase()}`];
  if (!hub) return [];

  try {
    const b = bbox(lat, lon, radiusMeters);
    const where = encodeURIComponent(`1=1`);
    const geometry = encodeURIComponent(
      `{"xmin":${b.minLon},"ymin":${b.minLat},"xmax":${b.maxLon},"ymax":${b.maxLat},"spatialReference":{"wkid":4326}}`
    );
    const url =
      `${hub.serviceUrl}/${hub.layerId}/query?` +
      `where=${where}&geometry=${geometry}&geometryType=esriGeometryEnvelope` +
      `&inSR=4326&spatialRel=esriSpatialRelContains` +
      `&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=50`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];

    const data = await res.json();
    const features: { attributes: Record<string, unknown>; geometry?: { x: number; y: number } }[] =
      data?.features || [];

    return features
      .map((f) => {
        const a = f.attributes;
        const rLon = f.geometry?.x;
        const rLat = f.geometry?.y;
        if (!rLat || !rLon) return null;

        // Auto-detect common ArcGIS field names
        const typeStr = String(
          a.offense || a.Offense || a.OFFENSE || a.crime_type || a.CrimeType ||
          a.OFFENSE_DESCRIPTION || a.offense_description || a.incident_type ||
          a.Nature || a.nature || a.UCR_CRIME_CATEGORY || "Unknown"
        );
        const desc = String(
          a.description || a.Description || a.DESCRIPTION || a.offense_description || typeStr
        );
        const rawDate = String(
          a.report_date || a.Report_Date || a.date || a.DATE_ ||
          a.occurred_date || a.OCCURRED_DATE || a.incident_date || ""
        );
        const date = rawDate ? new Date(Number(rawDate) || rawDate).toLocaleDateString() : "Unknown";

        return {
          lat: rLat, lon: rLon,
          type: classifyIncident(typeStr),
          category: truncate(typeStr, 40),
          description: truncate(desc, 60),
          date,
          source: `ArcGIS (${city})`,
        } as CrimeIncident;
      })
      .filter(Boolean) as CrimeIncident[];
  } catch (e) {
    console.warn("ArcGIS fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 4: Crimeometer (key-gated) ──────────────────────────────

// Free tier: 100 calls/month at https://www.crimeometer.com
// Provides nationwide geocoded incident data.

export function hasCrimeometerKey(): boolean {
  if (typeof window === "undefined") return false;
  return !!(localStorage.getItem("crimeometer_key"));
}

export function setCrimeometerKey(key: string) {
  if (typeof window !== "undefined") localStorage.setItem("crimeometer_key", key);
}

export function getCrimeometerKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("crimeometer_key") || "";
}

async function fetchCrimeometer(
  lat: number, lon: number, radiusMeters: number
): Promise<CrimeIncident[]> {
  const key = getCrimeometerKey();
  if (!key) return [];

  try {
    const radiusMi = (radiusMeters / 1609).toFixed(2);
    const endDt = new Date().toISOString().split("T")[0];
    const startDt = oneYearAgoStr();
    const url =
      `https://api.crimeometer.com/v1/incidents/raw-data?` +
      `lat=${lat}&lon=${lon}&distance=${radiusMi}mi` +
      `&datetime_ini=${startDt}T00:00:00.000Z&datetime_end=${endDt}T23:59:59.999Z` +
      `&page=1`;

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", "x-api-key": key },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const incidents: Record<string, unknown>[] = data?.incidents || [];

    return incidents.slice(0, 50).map((inc) => {
      const typeStr = String(inc.incident_offense || inc.incident_offense_code || "Unknown");
      const desc = String(inc.incident_offense_detail_description || inc.incident_offense_description || typeStr);
      const date = String(inc.incident_date || "");
      return {
        lat: parseFloat(String(inc.incident_latitude || "0")),
        lon: parseFloat(String(inc.incident_longitude || "0")),
        type: classifyIncident(typeStr),
        category: truncate(typeStr, 40),
        description: truncate(desc, 60),
        date: date ? new Date(date).toLocaleDateString() : "Unknown",
        source: "Crimeometer",
      };
    }).filter((i) => i.lat && i.lon);
  } catch (e) {
    console.warn("Crimeometer fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 5: UK Police API ──────────────────────────────

// Free, no key. Street-level crime data for England, Wales, and Northern Ireland.
// Only fires if coordinates fall within UK bounding box.
// Docs: https://data.police.uk/docs/

async function fetchUKPolice(
  lat: number, lon: number
): Promise<CrimeIncident[]> {
  // Quick bounding-box check for UK coordinates
  if (lat < 49.5 || lat > 61 || lon < -8.2 || lon > 2) return [];

  try {
    // API returns last available month; use 2 months ago to ensure data exists
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const url = `https://data.police.uk/api/crimes-street/all-crime?lat=${lat}&lng=${lon}&date=${month}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const crimes: Record<string, unknown>[] = await res.json();
    if (!Array.isArray(crimes)) return [];

    // UK Police categories use kebab-case like "anti-social-behaviour", "violent-crime"
    const UK_VIOLENT = ["violent-crime", "robbery", "possession-of-weapons", "public-order"];
    const UK_PROPERTY = ["burglary", "vehicle-crime", "theft-from-the-person", "bicycle-theft", "shoplifting", "criminal-damage-arson", "other-theft"];

    function classifyUK(cat: string): "violent" | "property" | "other" {
      if (UK_VIOLENT.includes(cat)) return "violent";
      if (UK_PROPERTY.includes(cat)) return "property";
      return "other";
    }

    return crimes.slice(0, 75).map((c) => {
      const loc = c.location as { latitude?: string; longitude?: string; street?: { name?: string } } | undefined;
      const rLat = parseFloat(String(loc?.latitude || "0"));
      const rLon = parseFloat(String(loc?.longitude || "0"));
      if (!rLat || !rLon) return null;

      const cat = String(c.category || "other-crime");
      const street = String(loc?.street?.name || "");
      return {
        lat: rLat,
        lon: rLon,
        type: classifyUK(cat),
        category: truncate(cat.replace(/-/g, " "), 40),
        description: truncate(street || cat.replace(/-/g, " "), 60),
        date: String(c.month || month),
        source: "UK Police",
      } as CrimeIncident;
    }).filter(Boolean) as CrimeIncident[];
  } catch (e) {
    console.warn("UK Police fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 6: CityProtect (RAIDS Online) ──────────────────────────────

// Free, no key. Motorola Solutions CommandCentral public incidents API.
// Used by hundreds of US police departments. Returns geocoded incidents.

async function fetchCityProtect(
  lat: number, lon: number, radiusMeters: number
): Promise<CrimeIncident[]> {
  try {
    const b = bbox(lat, lon, radiusMeters);
    const endDt = new Date().toISOString().split("T")[0];
    const startDt = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0]; // 90 days

    const url =
      `https://ce-portal-service.commandcentral.com/api/v2.0/public/incidents?` +
      `bbox=${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}` +
      `&startDate=${startDt}&endDate=${endDt}&pageSize=50`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];

    const data = await res.json();
    const incidents: Record<string, unknown>[] = data?.incidents || data?.features || [];
    if (!Array.isArray(incidents)) return [];

    return incidents.slice(0, 50).map((inc) => {
      const geo = inc.geometry as { coordinates?: number[] } | undefined;
      const props = (inc.properties || inc) as Record<string, unknown>;
      const rLat = Number(props.latitude || props.lat || geo?.coordinates?.[1] || 0);
      const rLon = Number(props.longitude || props.lon || geo?.coordinates?.[0] || 0);
      if (!rLat || !rLon) return null;

      const typeStr = String(props.offense || props.type || props.offense_type ||
        props.incident_type || props.description || "Unknown");
      const desc = String(props.description || props.address || typeStr);
      const date = String(props.date || props.incident_date || props.reported_date || "");

      return {
        lat: rLat, lon: rLon,
        type: classifyIncident(typeStr),
        category: truncate(typeStr, 40),
        description: truncate(desc, 60),
        date: date ? new Date(date).toLocaleDateString() : "Unknown",
        source: "CityProtect",
      } as CrimeIncident;
    }).filter(Boolean) as CrimeIncident[];
  } catch (e) {
    console.warn("CityProtect fetch error:", e);
    return [];
  }
}

// ────────────────────────────── Source 7: Overpass API (Environmental Risk POIs) ──────────────────────────────

// Free, no key. Queries OpenStreetMap for crime-correlated points of interest:
// bars, nightclubs, pubs, liquor stores, pawn shops, casinos, check-cashing, etc.
// These are environmental risk indicators used in CPTED (Crime Prevention Through
// Environmental Design) methodology.

const POI_LABELS: Record<string, string> = {
  bar: "Bar",
  nightclub: "Nightclub",
  pub: "Pub",
  alcohol: "Liquor Store",
  pawnbroker: "Pawn Shop",
  casino: "Casino",
  strip_club: "Strip Club",
  money_transfer: "Check Cashing",
  gambling: "Gambling",
};

export async function fetchEnvironmentalRisk(
  lat: number, lon: number, radiusMeters = 1609
): Promise<EnvironmentalRisk> {
  const cacheKey = `poi_${lat.toFixed(4)}|${lon.toFixed(4)}`;
  const cached = _poiCache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const empty: EnvironmentalRisk = { pois: [], summary: {}, total: 0 };
  try {
    const r = Math.max(radiusMeters, 1609);
    const query = `[out:json][timeout:10];(` +
      `node["amenity"="bar"](around:${r},${lat},${lon});` +
      `node["amenity"="nightclub"](around:${r},${lat},${lon});` +
      `node["amenity"="pub"](around:${r},${lat},${lon});` +
      `node["shop"="alcohol"](around:${r},${lat},${lon});` +
      `node["shop"="pawnbroker"](around:${r},${lat},${lon});` +
      `node["amenity"="casino"](around:${r},${lat},${lon});` +
      `node["amenity"="strip_club"](around:${r},${lat},${lon});` +
      `node["shop"="money_transfer"](around:${r},${lat},${lon});` +
      `node["amenity"="gambling"](around:${r},${lat},${lon});` +
      `);out body;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!res.ok) { _poiCache[cacheKey] = { ts: Date.now(), data: empty }; return empty; }

    const data = await res.json();
    const elements: { lat: number; lon: number; tags?: Record<string, string> }[] =
      data?.elements || [];

    const pois: RiskPOI[] = elements.slice(0, 200).map((el) => ({
      lat: el.lat,
      lon: el.lon,
      name: el.tags?.name || POI_LABELS[el.tags?.amenity || el.tags?.shop || ""] || "Unknown",
      poiType: el.tags?.amenity || el.tags?.shop || "unknown",
    })).filter((p) => p.lat && p.lon);

    // Build summary counts
    const summary: Record<string, number> = {};
    for (const p of pois) {
      const label = POI_LABELS[p.poiType] || p.poiType;
      summary[label] = (summary[label] || 0) + 1;
    }

    const result: EnvironmentalRisk = { pois, summary, total: pois.length };
    _poiCache[cacheKey] = { ts: Date.now(), data: result };
    return result;
  } catch (e) {
    console.warn("Overpass POI fetch error:", e);
    _poiCache[cacheKey] = { ts: Date.now(), data: empty };
    return empty;
  }
}

// ────────────────────────────── Multi-Source Aggregator ──────────────────────────────

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

  // Fire all 6 incident sources in parallel — each handles its own errors gracefully
  const [socrata, ods, arcgis, crimeometer, ukpolice, cityprotect] = await Promise.all([
    fetchSocrata(lat, lon, city, state, radiusMeters),
    fetchOpenDataSoft(lat, lon, city, radiusMeters),
    fetchArcGIS(lat, lon, city, state, radiusMeters),
    fetchCrimeometer(lat, lon, radiusMeters),
    fetchUKPolice(lat, lon),
    fetchCityProtect(lat, lon, radiusMeters),
  ]);

  // Collate all results, dedup, cap at 200
  const all = [...socrata, ...ods, ...arcgis, ...crimeometer, ...ukpolice, ...cityprotect];
  const deduped = dedupeIncidents(all).slice(0, 200);

  _incidentCache[cacheKey] = { ts: Date.now(), data: deduped };
  return deduped;
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
  environmentalRisk: EnvironmentalRisk;
  sources: string[];
  hasOffenderKey: boolean;
};

export async function fetchMapOverlayData(
  lat: number,
  lon: number,
  city: string,
  state: string
): Promise<MapOverlayData> {
  const [incidents, offenders, environmentalRisk] = await Promise.all([
    fetchNearbyIncidents(lat, lon, city, state),
    fetchNearbyOffenders(lat, lon),
    fetchEnvironmentalRisk(lat, lon),
  ]);

  // Collect unique source names
  const sources = [...new Set(incidents.map((i) => i.source))];
  if (environmentalRisk.total > 0) sources.push("Overpass/OSM");

  return {
    incidents,
    offenders,
    environmentalRisk,
    sources,
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
