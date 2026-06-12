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

let arrowCache: HTMLCanvasElement | null = null;

function buildArrowIcon(): HTMLCanvasElement {
  if (arrowCache) return arrowCache;
  const s = 22;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const cx = s / 2;

  ctx.strokeStyle = "#fbbf24";
  ctx.fillStyle = "#fbbf24";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(cx, 1);
  ctx.lineTo(cx - 4, 7);
  ctx.lineTo(cx + 4, 7);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, 7);
  ctx.lineTo(cx, s - 2);
  ctx.stroke();

  arrowCache = c;
  return c;
}

function parseWindSpeed(speed: string): number {
  const m = speed.match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function parseWindDir(dir: string): number {
  const m = dir.match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
}

function windScale(speed: number): number {
  if (speed <= 0) return 0;
  if (speed < 5) return 0.35 + speed * 0.03;
  if (speed < 15) return 0.5 + (speed - 5) * 0.07;
  if (speed < 30) return 1.2 + (speed - 15) * 0.04;
  return 1.8 + Math.min(speed - 30, 40) * 0.02;
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
        const speed = parseWindSpeed(station.windSpeed);
        const scale = windScale(speed);
        if (scale <= 0) continue;

        const fromDeg = parseWindDir(station.windDir);
        const towardDeg = (fromDeg + 180) % 360;
        const rotation = -towardDeg * (Math.PI / 180);

        const entity = viewer.entities.add({
          id: entityId,
          name: station.name,
          position: Cesium.Cartesian3.fromDegrees(station.lng, station.lat, 5),
          billboard: {
            image: buildArrowIcon(),
            scale,
            rotation,
            alignedAxis: Cesium.Cartesian3.UNIT_Z,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
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
