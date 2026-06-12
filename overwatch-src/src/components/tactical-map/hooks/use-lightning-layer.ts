import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelLightning } from "@/lib/intel-client";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const POLL_MS = 15_000;
const STALE_MS = 60_000;

let iconCache: HTMLCanvasElement | null = null;

function buildIcon(): HTMLCanvasElement {
  if (iconCache) return iconCache;
  const s = 18;
  const c = document.createElement("canvas");
  c.width = s; c.height = s;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const cx = s / 2, cy = s / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,230,100,1)");
  g.addColorStop(0.7, "rgba(255,180,50,0.7)");
  g.addColorStop(1, "rgba(255,180,50,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, cx - 0.5, 0, Math.PI * 2);
  ctx.fill();
  iconCache = c;
  return c;
}

function currentTimestamp() { return Date.now(); }

export function useLightningLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5_000;

  const readyRef = useRef(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const existing = (entityGroupsRef.current.lightning ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); } catch { /* ok */ }
    });
    entityGroupsRef.current.lightning = [];

    if (!layers.eonetWeather || isReplaying) return;

    let cancelled = false;
    readyRef.current = true;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelLightning();
        if (cancelled || !viewer || !Cesium || !readyRef.current) return;

        const now = currentTimestamp();
        const cutoff = (now - STALE_MS) / 1000;

        const stale = (entityGroupsRef.current.lightning ?? []) as Array<{ id: string }>;
        stale.forEach((e) => {
          try { viewer.entities.removeById(e.id); } catch { /* ok */ }
        });
        entityGroupsRef.current.lightning = [];

        for (const f of data.features ?? []) {
          const [lon, lat] = f.geometry.coordinates;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          if (f.properties.time < cutoff) continue;

          const entity = viewer.entities.add({
            id: `lightning-${lat.toFixed(4)}-${lon.toFixed(4)}-${f.properties.time}`,
            position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
            point: {
              pixelSize: 6,
              color: Cesium.Color.fromCssColorString("#ffe44d"),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            billboard: {
              image: buildIcon(),
              scale: 0.7,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
          (entityGroupsRef.current.lightning as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:lightning-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, POLL_MS);

    return () => {
      cancelled = true;
      readyRef.current = false;
      clearInterval(interval);
    };
  }, [layers.eonetWeather, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying]);
}
