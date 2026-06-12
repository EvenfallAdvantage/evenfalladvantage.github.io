/**
 * S2 Underground Common Intelligence Picture (CIP) Integration
 *
 * Fetches live intelligence data from S2 Underground's public ArcGIS
 * feature services and renders them as Cesium entities on the tactical map.
 *
 * Data categories:
 *   - Kinetic events (domestic incidents, last 30 days)
 *   - Drone reports
 *   - Tipline reports
 *
 * Source: https://s2underground.maps.arcgis.com
 * License: CC BY-NC-SA 4.0
 */

import { logger } from "@/lib/logger";

// ─── ArcGIS Feature Service URLs ──────────────────────────

export interface S2Layer {
  id: string;
  label: string;
  category: "kinetic";
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
  /**
   * Per-feed age window (hours). Matched to the upstream feed's actual
   * update cadence and content — e.g. the kinetic events feed is literally
   * titled "(30 Days)" so a 72h cutoff would surface only 0–1 features.
   * `Infinity` disables age filtering. Defaults to S2_DEFAULT_MAX_AGE_HOURS
   * when omitted.
   */
  defaultAgeHours?: number;
}

/** Fallback age window used when a feed doesn't declare its own. */
export const S2_DEFAULT_MAX_AGE_HOURS = 168; // 7 days

// Date-field candidate sets, ordered by likelihood per upstream feed.
const KINETIC_DATE_FIELDS = ["Date", "date", "EventDate", "event_date", "ReportDate", "report_date", "time", "Time"] as const;
const REPORT_DATE_FIELDS = ["ReportDate", "report_date", "Date", "date", "CreationDate", "EditDate"] as const;

export const S2_LAYERS: S2Layer[] = [
  // Kinetic Events — feed name says "30 Days"; cadence is ~1 event per few days
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
    defaultAgeHours: 30 * 24,
  },
  // Drone reports — sporadic; 7 days catches a reasonable window
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
    defaultAgeHours: 7 * 24,
  },
  // Tipline — sporadic; 7 days
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
    defaultAgeHours: 7 * 24,
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
  // Resolution order: explicit options → per-feed default → fallback constant
  const maxAgeHours = options.maxAgeHours
    ?? layer.defaultAgeHours
    ?? S2_DEFAULT_MAX_AGE_HOURS;

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
  ...KINETIC_DATE_FIELDS, ...REPORT_DATE_FIELDS,
  "StartDate", "start_date", "EndDate", "end_date",
]);

/**
 * Format a timestamp (ms) as "N minutes/hours/days ago" for popup display.
 * Falls back to a compact locale date for older entries.
 */
function formatRelativeAge(ms: number): string {
  const diffMs = Date.now() - ms;
  if (diffMs < 0) return "in the future";
  const min = diffMs / 60000;
  if (min < 60) return `${Math.round(min)} min ago`;
  const hr = min / 60;
  if (hr < 48) return `${hr.toFixed(1)} hours ago`;
  const days = hr / 24;
  if (days < 30) return `${days.toFixed(1)} days ago`;
  return new Date(ms).toLocaleDateString();
}

/**
 * Build a description HTML string from feature properties for Cesium popups.
 * Shows ALL non-empty, non-internal fields for maximum information.
 *
 * For time-aware feeds (those with a `dateFields` allowlist) the popup
 * always opens with the authoritative timestamp — even if the underlying
 * field is missing/null — so analysts always know how old an intel point is.
 */
export function buildS2Description(feature: S2Feature, layer: S2Layer): string {
  const p = feature.properties;
  const parts: string[] = [];

  parts.push(`<b style="color:${layer.color}">${layer.label}</b>`);

  // Always show the authoritative timestamp for time-aware layers, even
  // when missing — this is the most important field for kinetic intel.
  const featureTs = getFeatureTimestamp(p, layer.dateFields);
  const dateFieldShown = new Set<string>();
  if (layer.dateFields) {
    if (featureTs !== null) {
      const d = new Date(featureTs);
      parts.push(
        `<br/><b style="opacity:0.9">When:</b> <span style="color:${layer.color};opacity:0.85">` +
        `${d.toLocaleDateString()} ${d.toLocaleTimeString()} <span style="opacity:0.5">(${formatRelativeAge(featureTs)})</span></span>`
      );
      // Mark every dateField as "already shown" so the iterator below doesn't
      // re-emit the same value under a different field name.
      for (const f of layer.dateFields) dateFieldShown.add(f);
    } else {
      parts.push(`<br/><b style="opacity:0.7">When:</b> <span style="opacity:0.4">date not reported by source</span>`);
    }
  }

  // Find and show the best title field
  for (const field of TITLE_FIELDS) {
    if (p[field] != null && String(p[field]).trim()) {
      parts.push(`<br/><b>${String(p[field])}</b>`);
      break;
    }
  }

  // Show all meaningful properties as a compact list
  const shown = new Set<string>(dateFieldShown);
  for (const [key, val] of Object.entries(p)) {
    if (val == null || val === "" || val === 0 || val === "null" || val === "None") continue;
    if (SKIP_FIELDS.has(key)) continue;
    if (TITLE_FIELDS.includes(key) && shown.size === dateFieldShown.size) { shown.add(key); continue; } // already shown as title
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
