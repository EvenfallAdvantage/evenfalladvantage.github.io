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
}

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
  },
  // Power plants
  {
    id: "s2-power-plants",
    label: "US Power Plants",
    category: "infrastructure",
    url: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Power_Plants_in_the_US/FeatureServer/0",
    color: "#eab308",
    icon: "P",
    refreshMinutes: 1440, // daily
    defaultOn: false,
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
  },
];

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
 */
export async function fetchS2LayerFeatures(
  layer: S2Layer,
  maxFeatures = 500
): Promise<S2Feature[]> {
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

    return geojson.features
      .filter((f: { geometry?: { type?: string; coordinates?: number[] } }) =>
        f.geometry?.type === "Point" && (f.geometry?.coordinates?.length ?? 0) >= 2
      )
      .map((f: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }) => ({
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        properties: f.properties ?? {},
        layerId: layer.id,
      }));
  } catch (err) {
    logger.swallow("s2-underground:fetch", err, "warn");
    return [];
  }
}

/**
 * Build a description HTML string from feature properties for Cesium popups.
 */
export function buildS2Description(feature: S2Feature, layer: S2Layer): string {
  const p = feature.properties;
  const parts: string[] = [];

  parts.push(`<b style="color:${layer.color}">${layer.label}</b>`);

  // Common ArcGIS field names
  const title = p.IncidentName ?? p.incident_name ?? p.Name ?? p.name ?? p.OBJECTID ?? "";
  if (title) parts.push(`<br/><b>${String(title)}</b>`);

  const desc = p.Description ?? p.description ?? p.Comments ?? p.comments ?? "";
  if (desc) parts.push(`<br/>${String(desc).slice(0, 300)}`);

  const date = p.FireDiscoveryDateTime ?? p.Date ?? p.date ?? p.CreationDate ?? p.created_date ?? "";
  if (date) {
    const d = new Date(typeof date === "number" ? date : String(date));
    if (!isNaN(d.getTime())) parts.push(`<br/><small>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</small>`);
  }

  // Magnitude for earthquakes
  const mag = p.mag ?? p.Magnitude ?? p.magnitude;
  if (mag != null) parts.push(`<br/>Magnitude: <b>${mag}</b>`);

  // Fire-specific
  const acres = p.DailyAcres ?? p.GISAcres ?? p.area_acres;
  if (acres != null) parts.push(`<br/>Acres: ${Number(acres).toLocaleString()}`);

  parts.push(`<br/><small style="opacity:0.5">Source: S2 Underground CIP</small>`);

  return parts.join("");
}
