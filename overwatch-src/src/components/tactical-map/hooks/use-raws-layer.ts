import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const ARCGIS_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/PublicView_RAWS/FeatureServer/1/query";

const REFRESH_MS = 30 * 60_000;

interface RawsStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  county: string;
  agency: string;
  unit: string;
  elevation: number;
  temp: string;
  windSpeed: string;
  windDir: string;
  humidity: string;
  solar: string;
  battery: string;
  fuelMoisture: string;
  mesoWestUrl: string;
  noaaUrl: string;
}

let iconCache: HTMLCanvasElement | null = null;

function buildTowerIcon(): HTMLCanvasElement {
  if (iconCache) return iconCache;
  const w = 18, h = 24;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const cx = w / 2;
  const color = "#94a3b8";

  const g = ctx.createRadialGradient(cx, 12, 0, cx, 12, 14);
  g.addColorStop(0, "rgba(148,163,184,0.12)");
  g.addColorStop(1, "rgba(148,163,184,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, 12, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx, 19);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx, 1);
  ctx.lineTo(cx - 3, 5);
  ctx.lineTo(cx + 3, 5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 6, 8);
  ctx.lineTo(cx + 6, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 6, 8, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 6, 8, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - 5, 13);
  ctx.lineTo(cx + 5, 13);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - 5, 13, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 5, 13, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillRect(cx - 4, 18, 8, 4);
  ctx.strokeRect(cx - 4, 18, 8, 4);

  iconCache = c;
  return c;
}

function buildPopup(station: RawsStation): string {
  const parts: string[] = [`<div style="font-family:monospace;font-size:11px;line-height:1.7">`];
  parts.push(`<b style="color:#94a3b8">${escapeHtml(station.name)}</b>`);
  if (station.agency || station.unit) {
    parts.push(`<div style="opacity:0.7">${escapeHtml(station.agency)}${station.agency && station.unit ? " · " : ""}${escapeHtml(station.unit)}</div>`);
  }
  const loc = [station.county, station.state].filter(Boolean).join(", ");
  if (loc || station.elevation) {
    parts.push(`<div style="opacity:0.5;font-size:10px">${escapeHtml(loc)}${loc && station.elevation ? " · " : ""}${station.elevation ? `${station.elevation} ft` : ""}</div>`);
  }
  parts.push(`<hr style="border-color:rgba(255,255,255,0.08);margin:4px 0"/>`);
  if (station.temp) parts.push(`<div>🌡️ <b>${escapeHtml(station.temp)}</b></div>`);
  if (station.windSpeed || station.windDir) {
    parts.push(`<div>💨 <b>${escapeHtml(station.windSpeed || "—")}</b>${station.windDir ? ` (${escapeHtml(station.windDir)})` : ""}</div>`);
  }
  if (station.humidity) parts.push(`<div>💧 <b>${escapeHtml(station.humidity)}</b> RH</div>`);
  if (station.solar) parts.push(`<div>☀️ <b>${escapeHtml(station.solar)}</b></div>`);
  if (station.battery) parts.push(`<div>🔋 <b>${escapeHtml(station.battery)}</b></div>`);
  if (station.fuelMoisture) parts.push(`<div>🔥 Fuel M: <b>${escapeHtml(station.fuelMoisture)}</b></div>`);
  parts.push(`<hr style="border-color:rgba(255,255,255,0.08);margin:4px 0"/>`);
  const mw = safeHttpUrl(station.mesoWestUrl);
  if (mw) parts.push(`<div><a href="${mw}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa">MesoWest →</a></div>`);
  const nl = safeHttpUrl(station.noaaUrl);
  if (nl) parts.push(`<div><a href="${nl}" target="_blank" rel="noopener noreferrer" style="color:#60a5fa">NOAA Time Series →</a></div>`);
  parts.push(`</div>`);
  return parts.join("\n");
}

function toDeg(r: number) { return r * 180 / Math.PI; }

export function useRawsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < Date.now() - 5_000;
  const allStationsRef = useRef<RawsStation[]>([]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const existing = (entityGroupsRef.current.raws ?? []) as Array<{ id: string }>;
    existing.forEach((e) => { try { viewer.entities.removeById(e.id); } catch { /* ok */ } });
    entityGroupsRef.current.raws = [];

    if (!layers.raws || isReplaying) return;

    let cancelled = false;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    function renderVisible() {
      if (!viewer || !Cesium || cancelled) return;
      let west = -180, south = -90, east = 180, north = 90;
      try {
        const rect = viewer.camera.computeViewRectangle();
        if (rect) {
          west = toDeg(rect.west) - 2;
          south = toDeg(rect.south) - 2;
          east = toDeg(rect.east) + 2;
          north = toDeg(rect.north) + 2;
        }
      } catch { /* full globe */ }

      const spanLng = east - west;
      const isZoomedIn = spanLng < 90;

      const old = (entityGroupsRef.current.raws ?? []) as Array<{ id: string }>;
      old.forEach((e) => { try { viewer.entities.removeById(e.id); } catch {} });
      entityGroupsRef.current.raws = [];

      if (!isZoomedIn) return;

      const visible = allStationsRef.current.filter(
        (s) => s.lng >= west && s.lng <= east && s.lat >= south && s.lat <= north,
      );

      for (const station of visible) {
        const entityId = `raws-${station.id}`;
        const entity = viewer.entities.add({
          id: entityId,
          name: station.name,
          position: Cesium.Cartesian3.fromDegrees(station.lng, station.lat, 5),
          billboard: {
            image: buildTowerIcon(),
            scale: 0.9,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          description: buildPopup(station),
        });
        (entityGroupsRef.current.raws as Array<{ id: string }>).push(entity);
      }
    }

    async function fetchAndRender() {
      try {
        const url = `${ARCGIS_URL}?f=geojson&where=1%3D1&outFields=*&resultRecordCount=4000`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`ArcGIS returned ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        const stations: RawsStation[] = (data.features ?? []).map((f: Record<string, unknown>) => {
          const p = (f.properties ?? {}) as Record<string, unknown>;
          const coords = ((f.geometry as Record<string, unknown>)?.coordinates ?? [0, 0]) as number[];
          return {
            id: String(p.OBJECTID ?? (f.id as string) ?? 0),
            name: (p.StationName as string) ?? "Unknown",
            lat: coords[1],
            lng: coords[0],
            state: (p.State as string) ?? "",
            county: (p.County as string) ?? "",
            agency: (p.Agency as string) ?? "",
            unit: (p.Unit as string) ?? "",
            elevation: (p.Elevation as number) ?? 0,
            temp: (p.AirTempStandPlace as string) ?? "",
            windSpeed: (p.WindSpeedMPH as string) ?? "",
            windDir: (p.WindDirDegrees as string) ?? "",
            humidity: (p.RelativeHumidity as string) ?? "",
            solar: (p.SolarRadiation as string) ?? "",
            battery: (p.BatteryVoltage as string) ?? "",
            fuelMoisture: (p.FuelMoisture as string) ?? "",
            mesoWestUrl: (p.MesoWestURL as string) ?? "",
            noaaUrl: (p.NOAA_URL as string) ?? "",
          };
        }).filter((s: RawsStation) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

        allStationsRef.current = stations;
        renderVisible();
      } catch (err) {
        logger.swallow("cesium-layers:raws-fetch", err, "warn");
      }
    }

    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(renderVisible);

    fetchAndRender();
    refreshInterval = setInterval(fetchAndRender, REFRESH_MS);

    return () => {
      cancelled = true;
      if (refreshInterval) clearInterval(refreshInterval);
      removeMoveEnd();
    };
  }, [layers.raws, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
