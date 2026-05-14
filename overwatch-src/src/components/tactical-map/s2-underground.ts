/**
 * S2 Underground Common Intelligence Picture (CIP) Integration
 *
 * Fetches live intelligence data from S2 Underground's public ArcGIS
 * feature services and renders them as Cesium entities on the tactical map.
 *
 * Data categories:
 *   - Kinetic events (domestic incidents, last 7/30 days)
 *   - Wildfires (current perimeters + incidents)
 *   - Earthquakes (USGS seismic data)
 *   - Critical infrastructure (power plants, pipelines, submarine cables)
 *
 * Source: https://s2underground.maps.arcgis.com
 * License: CC BY-NC-SA 4.0
 */

import { logger } from "@/lib/logger";

// ─── ArcGIS Feature Service URLs ──────────────────────────

export interface S2Layer {
  id: string;
  label: string;
  category: "kinetic" | "fire" | "earthquake" | "infrastructure" | "weather";
  url: string;
  color: string;         // Cesium Color CSS string
  icon: string;          // Emoji or marker label
  refreshMinutes: number; // auto-refresh interval
  defaultOn: boolean;
  /**
   * Candidate property names that carry the feature's authoritative date.
   * The first one found on a feature is used for age filtering. If no
   * candidate is found, the feature is kept (assumed static / not time-aware).
   * If `undefined`, the layer is treated as static (no age filter applied).
   */
  dateFields?: readonly string[];
}

/** Default age window — pins older than this are hidden unless Time Machine extends it. */
export const S2_DEFAULT_MAX_AGE_HOURS = 72;

// Date-field candidate sets, ordered by likelihood per upstream feed.
// Verified against actual popup output: the kinetic feed uses literal "Date"
// (rendered as "Date: 3/29/2025 8:00:00 PM" in feature popups).
const KINETIC_DATE_FIELDS = ["Date", "date", "EventDate", "event_date", "ReportDate", "report_date", "time", "Time"] as const;
const WILDFIRE_DATE_FIELDS = ["FireDiscoveryDateTime", "IrwinModifiedDate", "ModifiedDate", "ModifiedOnDateTime_dt"] as const;
const THERMAL_DATE_FIELDS = ["acq_date", "ACQ_DATE", "AcquisitionDate", "acquisition_date", "Date", "date"] as const;
const EARTHQUAKE_DATE_FIELDS = ["time", "Time", "Date", "date", "eventTime", "OriginTime"] as const;
const REPORT_DATE_FIELDS = ["ReportDate", "report_date", "Date", "date", "CreationDate", "EditDate"] as const;

export const S2_LAYERS: S2Layer[] = [
  // Kinetic Events
  {
    id: "s2-kinetic-30d",
    label: "Kinetic Events (30 Days)",
    category: "kinetic",
    url: "https://services.arcgis.com/OeCRCKr7XFYQNdyJ/arcgis/rest/services/Domestic_Terrorism_Tracker/FeatureServer/1",
    color: "#ef4444",
    icon: "K",
    refreshMinutes: 30,
    defaultOn: true,
    dateFields: KINETIC_DATE_FIELDS,
  },
  // Wildfires
  {
    id: "s2-wildfires",
    label: "Active Wildfires",
    category: "fire",
    url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0",
    color: "#f97316",
    icon: "F",
    refreshMinutes: 60,
    defaultOn: true,
    dateFields: WILDFIRE_DATE_FIELDS,
  },
  // Thermal hotspots
  {
    id: "s2-thermal",
    label: "Satellite Thermal Hotspots",
    category: "fire",
    url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/Satellite_VIIRS_Thermal_Hotspots_and_Fire_Activity/FeatureServer/0",
    color: "#fb923c",
    icon: "T",
    refreshMinutes: 60,
    defaultOn: false,
    dateFields: THERMAL_DATE_FIELDS,
  },
  // Earthquakes
  {
    id: "s2-earthquakes",
    label: "Recent Earthquakes",
    category: "earthquake",
    url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USGS_Seismic_Data_v1/FeatureServer/0",
    color: "#a855f7",
    icon: "E",
    refreshMinutes: 15,
    defaultOn: true,
    dateFields: EARTHQUAKE_DATE_FIELDS,
  },
  // Power plants — static infrastructure, no age filter
  {
    id: "s2-power-plants",
    label: "US Power Plants",
    category: "infrastructure",
    url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0",
    color: "#eab308",
    icon: "P",
    refreshMinutes: 1440, // daily
    defaultOn: false,
    // dateFields intentionally omitted — static infrastructure
  },
  // Drone reports
  {
    id: "s2-drones",
    label: "Drone Reports",
    category: "kinetic",
    url: "https://services.arcgis.com/OeCRCKr7XFYQNdyJ/arcgis/rest/services/Drone_Reports/FeatureServer/23",
    color: "#06b6d4",
    icon: "D",
    refreshMinutes: 30,
    defaultOn: false,
    dateFields: REPORT_DATE_FIELDS,
  },
  // Tipline
  {
    id: "s2-tipline",
    label: "Tipline Reports",
    category: "kinetic",
    url: "https://services.arcgis.com/OeCRCKr7XFYQNdyJ/arcgis/rest/services/Tipline_Reports/FeatureServer/24",
    color: "#22c55e",
    icon: "I",
    refreshMinutes: 30,
    defaultOn: false,
    dateFields: REPORT_DATE_FIELDS,
  },
];

/**
 * Parse a date value from a feature property. Handles:
 *  - ISO strings (`"2024-05-14T..."`)
 *  - Epoch milliseconds (USGS earthquakes, ArcGIS Date)
 *  - Epoch seconds (some feeds)
 *  - Locale-style strings
 *
 * Returns timestamp in ms, or null if unparseable.
 */
export function parseFeatureDate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Heuristic: values > 1e12 are ms; values > 1e9 are seconds (post-2001).
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Extract the first parseable date from a feature's properties using the
 * layer's `dateFields` allowlist. Returns null if none parse.
 */
export function getFeatureTimestamp(
  properties: Record<string, unknown>,
  dateFields: readonly string[] | undefined,
): number | null {
  if (!dateFields) return null;
  for (const field of dateFields) {
    const v = properties[field];
    const t = parseFeatureDate(v);
    if (t !== null) return t;
  }
  return null;
}

// ─── GeoJSON Fetcher ──────────────────────────────────────

export interface S2Feature {
  lat: number;
  lng: number;
  properties: Record<string, unknown>;
  layerId: string;
}

/**
 * Fetch features from an ArcGIS FeatureServer layer as GeoJSON.
 * Uses the `/query` endpoint with `f=geojson`.
 *
 * Filtering rules:
 *  - If the layer has `dateFields` and `maxAgeHours` is finite, features
 *    older than `now - maxAgeHours` are dropped client-side. A feature with
 *    no parseable date in any allowlisted field is kept (defensive: better
 *    to over-show than silently hide).
 *  - Static layers (no `dateFields`) are never age-filtered.
 *  - `maxAgeHours = Infinity` disables age filtering entirely.
 */
export async function fetchS2LayerFeatures(
  layer: S2Layer,
  options: { maxFeatures?: number; maxAgeHours?: number } = {},
): Promise<S2Feature[]> {
  const maxFeatures = options.maxFeatures ?? 500;
  const maxAgeHours = options.maxAgeHours ?? S2_DEFAULT_MAX_AGE_HOURS;

  try {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      resultRecordCount: String(maxFeatures),
      f: "geojson",
      orderByFields: "ObjectId DESC",
    });

    const res = await fetch(`${layer.url}/query?${params.toString()}`);
    if (!res.ok) {
      logger.warn("s2-underground", `Failed to fetch ${layer.label}: ${res.status}`);
      return [];
    }

    const geojson = await res.json();
    if (!geojson?.features?.length) return [];

    const cutoff = Number.isFinite(maxAgeHours) && layer.dateFields
      ? Date.now() - maxAgeHours * 60 * 60 * 1000
      : null;

    return geojson.features
      .filter((f: { geometry?: { type?: string; coordinates?: number[] } }) =>
        f.geometry?.type === "Point" && (f.geometry?.coordinates?.length ?? 0) >= 2
      )
      .map((f: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        properties: f.properties ?? {},
        layerId: layer.id,
      }))
      .filter((feat: S2Feature) => {
        if (cutoff === null) return true;
        const t = getFeatureTimestamp(feat.properties, layer.dateFields);
        // Kept if no parseable date OR within window
        return t === null || t >= cutoff;
      });
  } catch (err) {
    logger.swallow("s2-underground:fetch", err, "warn");
    return [];
  }
}

// Fields to skip in the "show all properties" dump (internal/boring fields)
const SKIP_FIELDS = new Set([
  "OBJECTID", "ObjectId", "objectid", "FID", "fid", "Shape", "shape",
  "Shape__Area", "Shape__Length", "GlobalID", "globalid", "CreationDate",
  "Creator", "EditDate", "Editor", "created_user", "last_edited_user",
  "last_edited_date", "created_date",
]);

// Fields that look like names/titles (show as bold header)
const TITLE_FIELDS = [
  "IncidentName", "incident_name", "Name", "name", "Title", "title",
  "EventName", "event_name", "CallSign", "callsign", "PlaceName",
  "Location", "location", "City", "city", "State", "state",
];

// Fields that look like dates (format as date in popups).
// Derived from the union of all per-layer dateFields plus a few common extras.
const DATE_FIELDS = new Set<string>([
  ...KINETIC_DATE_FIELDS, ...WILDFIRE_DATE_FIELDS, ...THERMAL_DATE_FIELDS,
  ...EARTHQUAKE_DATE_FIELDS, ...REPORT_DATE_FIELDS,
  "StartDate", "start_date", "EndDate", "end_date",
]);

/**
 * Build a description HTML string from feature properties for Cesium popups.
 * Shows ALL non-empty, non-internal fields for maximum information.
 */
export function buildS2Description(feature: S2Feature, layer: S2Layer): string {
  const p = feature.properties;
  const parts: string[] = [];

  parts.push(`<b style="color:${layer.color}">${layer.label}</b>`);

  // Find and show the best title field
  for (const field of TITLE_FIELDS) {
    if (p[field] != null && String(p[field]).trim()) {
      parts.push(`<br/><b>${String(p[field])}</b>`);
      break;
    }
  }

  // Show all meaningful properties as a compact list
  const shown = new Set<string>();
  for (const [key, val] of Object.entries(p)) {
    if (val == null || val === "" || val === 0 || val === "null" || val === "None") continue;
    if (SKIP_FIELDS.has(key)) continue;
    if (TITLE_FIELDS.includes(key) && shown.size === 0) { shown.add(key); continue; } // already shown as title
    if (shown.has(key)) continue;
    shown.add(key);

    const strVal = String(val);
    if (strVal.length > 500) continue; // skip huge blobs

    // Format dates nicely
    if (DATE_FIELDS.has(key)) {
      const d = new Date(typeof val === "number" ? val : strVal);
      if (!isNaN(d.getTime())) {
        parts.push(`<br/><small style="opacity:0.7">${formatFieldName(key)}: ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</small>`);
        continue;
      }
    }

    // Format numbers
    if (typeof val === "number") {
      const formatted = Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2);
      parts.push(`<br/><small>${formatFieldName(key)}: <b>${formatted}</b></small>`);
      continue;
    }

    // URLs — render as clickable embed links
    if (strVal.match(/^https?:\/\//)) {
      const domain = strVal.replace(/^https?:\/\//, "").split("/")[0];
      parts.push(`<br/><small>${formatFieldName(key)}: <a href="${strVal}" target="_blank" rel="noopener noreferrer" data-embed-url="${strVal}" style="color:#dd8c33;text-decoration:underline;cursor:pointer">${domain}</a></small>`);
      continue;
    }

    // Regular string
    parts.push(`<br/><small>${formatFieldName(key)}: ${strVal.slice(0, 200)}</small>`);
  }

  parts.push(`<br/><small style="opacity:0.3">Source: S2 Underground CIP</small>`);

  return parts.join("");
}

/** Convert camelCase/snake_case field names to readable labels */
function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
