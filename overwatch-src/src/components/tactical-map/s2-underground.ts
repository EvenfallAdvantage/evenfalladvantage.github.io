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
  /**
   * Optional field holding a separate time-of-day string (e.g. Tipline
   * `TimeOfEvent` = "09:00:00"). Shown verbatim next to a date-only value;
   * the upstream feed doesn't say which timezone it is in, so we never
   * merge it into a timestamp.
   */
  timeOfDayField?: string;
  /**
   * Whether features with no source/linked-post date survive the age
   * filter. Defaults to true. 
   */
  keepUndated?: boolean;
}

/** Fallback age window used when a feed doesn't declare its own. */
export const S2_DEFAULT_MAX_AGE_HOURS = 168; // 7 days

// Date-field candidate sets, ordered by likelihood per upstream feed.
const KINETIC_DATE_FIELDS = ["Date", "date", "EventDate", "event_date", "ReportDate", "report_date", "time", "Time"] as const;
const REPORT_DATE_FIELDS = ["ReportDate", "report_date", "Date", "date", "CreationDate", "EditDate"] as const;
// Tipline schema (verified against the live FeatureServer): DateOfEvent,
// TimeOfEvent (time-only string), DateOfReport. None of these were in the
// old candidate list, so every tipline pin showed "date not reported".
const TIPLINE_DATE_FIELDS = ["DateOfEvent", "DateOfReport", ...REPORT_DATE_FIELDS] as const;
/** Fields that carry links to the source post / article. */
const LINK_FIELDS = ["Research", "Research2", "Research3", "Research4", "Media"] as const;

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
    dateFields: TIPLINE_DATE_FIELDS,
    timeOfDayField: "TimeOfEvent",
    // 30-day window on the (now correctly parsed) event date. Undated
    // tipline items are dropped rather than kept, so they can't bypass the
    // window.
    defaultAgeHours: 30 * 24,
    keepUndated: false,
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
/** Dates further than this in the future are treated as invalid. */
const FUTURE_TOLERANCE_MS = 2 * 86_400_000;

export function parseFeatureDate(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // ArcGIS dates are epoch ms. Anything above 1e11 is ms (1e11 ms is
    // 1973; as seconds it would be the year 5138). This keeps pre-2001
    // dates such as 737510400000 (1993-05-16) from being read as seconds
    // and pushed tens of thousands of years into the future.
    let ms: number;
    if (value > 1e11) ms = value;
    else if (value > 1e9) ms = value * 1000;
    else return null;
    return ms > Date.now() + FUTURE_TOLERANCE_MS ? null : ms;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) || t > Date.now() + FUTURE_TOLERANCE_MS ? null : t;
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

// ─── Timestamp resolution (event date → linked post) ──

const DAY_MS = 86_400_000;
/** X/Twitter snowflake epoch (2010-11-04T01:42:54.657Z). */
const TWITTER_EPOCH = BigInt("1288834974657");

/**
 * ArcGIS `esriFieldTypeDate` values entered as a calendar date (no time)
 * are stored as midnight UTC. Rendering them in local time shifts them to
 * the previous evening in US timezones, so we treat them as date-only.
 */
export function isDateOnlyMs(ms: number): boolean {
  return ms % DAY_MS === 0;
}

/**
 * Derive the publish time of a linked post from its URL, without fetching:
 *  - x.com / twitter.com status IDs encode the exact post time (snowflake)
 *  - news URLs with a /YYYY/MM/DD/ path segment give the publish date
 */
export function parseLinkedPostDate(url: unknown): { ms: number; dateOnly: boolean } | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  const tw = u.match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/[^/]+\/status(?:es)?\/(\d{15,20})/i);
  if (tw) {
    const ms = Number((BigInt(tw[1]) >> BigInt(22)) + TWITTER_EPOCH);
    // Sanity: snowflakes started in late 2010; reject anything implausible.
    if (ms > Date.UTC(2010, 10, 4) && ms < Date.now() + DAY_MS) return { ms, dateOnly: false };
    return null;
  }
  const path = u.match(/^https?:\/\/[^/]+\/(?:.*\/)?(20\d{2})\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\/|$)/);
  if (path) {
    const ms = Date.UTC(Number(path[1]), Number(path[2]) - 1, Number(path[3]));
    if (ms < Date.now() + DAY_MS) return { ms, dateOnly: true };
  }
  return null;
}

export type S2TimeSource = "event" | "linked-post";

export interface S2ResolvedTime {
  ms: number;
  source: S2TimeSource;
  /** True when only a calendar date is known (render in UTC, no clock time). */
  dateOnly: boolean;
  /** Property the value came from (date field or link field). */
  field?: string;
  /** Verbatim time-of-day string from the feed, if any (timezone unknown). */
  timeOfDay?: string;
}

/** Authoritative source date, falling back to the earliest linked-post date. */
export function resolveSourceTime(
  properties: Record<string, unknown>,
  layer: Pick<S2Layer, "dateFields" | "timeOfDayField">,
): S2ResolvedTime | null {
  if (!layer.dateFields) return null;
  for (const field of layer.dateFields) {
    const t = parseFeatureDate(properties[field]);
    if (t === null) continue;
    const dateOnly = typeof properties[field] === "number" && isDateOnlyMs(t);
    const tod = layer.timeOfDayField ? properties[layer.timeOfDayField] : undefined;
    return {
      ms: t, source: "event", dateOnly, field,
      timeOfDay: dateOnly && typeof tod === "string" && tod.trim() ? tod.trim() : undefined,
    };
  }
  let best: S2ResolvedTime | null = null;
  for (const field of LINK_FIELDS) {
    const d = parseLinkedPostDate(properties[field]);
    if (d && (!best || d.ms < best.ms)) best = { ms: d.ms, source: "linked-post", dateOnly: d.dateOnly, field };
  }
  return best;
}

/**
 * Display time: source date, else linked-post date. Undated features show
 * "Date unknown" (we never substitute a client-side time).
 */
export function resolveFeatureTime(feature: S2Feature, layer: S2Layer): S2ResolvedTime | null {
  return resolveSourceTime(feature.properties, layer);
}

/** Format a resolved time for display, without shifting date-only values. */
export function formatResolvedTime(t: Pick<S2ResolvedTime, "ms" | "dateOnly" | "timeOfDay">): string {
  const d = new Date(t.ms);
  if (t.dateOnly) {
    const date = d.toLocaleDateString(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
    return t.timeOfDay ? `${date}, ${t.timeOfDay} (local time at event)` : date;
  }
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

// ─── GeoJSON Fetcher ──────────────────────────────────────

export interface S2Feature {
  lat: number;
  lng: number;
  properties: Record<string, unknown>;
  layerId: string;
  /** Resolved display time (set by fetchS2LayerFeatures). */
  time?: S2ResolvedTime | null;
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
        // Age-filter on the source date, else the linked-post date. Items
        // with neither are kept .
        const t = resolveSourceTime(feat.properties, layer)?.ms ?? null;
        if (t === null) return layer.keepUndated !== false;
        return t >= cutoff;
      })
      .map((feat: S2Feature) => ({ ...feat, time: resolveFeatureTime(feat, layer) }));
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
  ...TIPLINE_DATE_FIELDS,
  "StartDate", "start_date", "EndDate", "end_date",
]);

/**
 * Whether a popup property should be rendered as a date: a known date field,
 * or a name that looks like a date (ArcGIS esriFieldTypeDate fields are
 * delivered as epoch-ms numbers in GeoJSON, with no type info) holding an
 * epoch-ms number or date string.
 */
export function isDateLikeField(key: string, val: unknown): boolean {
  if (DATE_FIELDS.has(key)) return true;
  if (!/date|timestamp|_at$/i.test(key)) return false;
  if (typeof val === "number") return val > 1e11 && val < 1e14;
  return typeof val === "string" && !Number.isNaN(Date.parse(val));
}

/**
 * Format a timestamp (ms) as "N minutes/hours/days ago" for popup display.
 * Falls back to a compact locale date for older entries.
 */
function formatRelativeAge(ms: number, dateOnly = false): string {
  const diffMs = Date.now() - ms;
  if (dateOnly) {
    const days = Math.floor(diffMs / DAY_MS);
    if (days < 0) return "in the future";
    if (days === 0) return "today (UTC)";
    if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
    return "";
  }
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
  const t = feature.time !== undefined ? feature.time : resolveFeatureTime(feature, layer);
  const dateFieldShown = new Set<string>();
  if (layer.dateFields) {
    if (t) {
      const rel = formatRelativeAge(t.ms, t.dateOnly);
      const label = t.source === "event" ? "When" : "Linked post dated";
      const note = t.source === "linked-post" ? "event date not reported; taken from the linked post" : "";
      parts.push(
        `<br/><b style="opacity:0.9">${label}:</b> <span style="color:${layer.color};opacity:0.85">` +
        `${formatResolvedTime(t)}${rel ? ` <span style="opacity:0.5">(${rel})</span>` : ""}</span>` +
        (note ? `<br/><small style="opacity:0.5">${note}</small>` : "")
      );
      if (t.source === "event") {
        for (const f of layer.dateFields) if (f === t.field) dateFieldShown.add(f);
        if (t.timeOfDay && layer.timeOfDayField) dateFieldShown.add(layer.timeOfDayField);
      }
    } else {
      parts.push(`<br/><b style="opacity:0.7">When:</b> <span style="opacity:0.6">Date unknown</span>`);
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
    if (isDateLikeField(key, val)) {
      const ms = parseFeatureDate(val);
      // Merge: skip a line that just repeats the "When" value.
      if (ms !== null && t && t.source === "event" && ms === t.ms) continue;
      if (ms !== null) {
        const dateOnly = typeof val === "number" && isDateOnlyMs(ms);
        parts.push(`<br/><small style="opacity:0.7">${formatFieldName(key)}: ${formatResolvedTime({ ms, dateOnly })}</small>`);
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
