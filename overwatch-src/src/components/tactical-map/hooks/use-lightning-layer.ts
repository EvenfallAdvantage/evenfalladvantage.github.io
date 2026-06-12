import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelLightning } from "@/lib/intel-client";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const POLL_MS = 15_000;
const ROLLING_WINDOW_MS = 5 * 60_000;
const REPLAY_WINDOW_MS = 10 * 60_000;

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

  const knownIdsRef = useRef(new Set<number>());
  const timesRef = useRef(new Map<string, number>());

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const existing = (entityGroupsRef.current.lightning ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); } catch { /* ok */ }
    });
    entityGroupsRef.current.lightning = [];
    knownIdsRef.current.clear();
    timesRef.current.clear();

    if (!layers.eonetWeather) return;

    let cancelled = false;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelLightning();
        if (cancelled || !viewer || !Cesium) return;

        const now = currentTimestamp();
        const replayTime = isReplaying ? debouncedReplayTime : now;

        for (const f of data.features ?? []) {
          const strikeId = f.properties.id;
          if (strikeId !== undefined) {
            if (knownIdsRef.current.has(strikeId)) continue;
            knownIdsRef.current.add(strikeId);
          }

          const [lon, lat] = f.geometry.coordinates;
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          const timeMs = f.properties.time * 1000;
          const diff = Math.abs(timeMs - replayTime);

          if (isNaN(diff)) continue;
          const maxWindow = isReplaying ? REPLAY_WINDOW_MS : ROLLING_WINDOW_MS;
          if (diff > maxWindow) continue;

          const entity = viewer.entities.add({
            id: `lightning-${f.properties.id}`,
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
          timesRef.current.set(entity.id, timeMs);
          (entityGroupsRef.current.lightning as Array<{ id: string }>).push(entity);
        }

        const list = (entityGroupsRef.current.lightning ?? []) as Array<{ id: string }>;
        const keep: Array<{ id: string }> = [];
        for (const e of list) {
          const timeMs = timesRef.current.get(e.id);
          if (timeMs == null) { keep.push(e); continue; }
          const diff = Math.abs(timeMs - replayTime);
          const maxWindow = isReplaying ? REPLAY_WINDOW_MS : ROLLING_WINDOW_MS;
          if (diff > maxWindow) {
            timesRef.current.delete(e.id);
            try { viewer.entities.removeById(e.id); } catch { /* ok */ }
          } else {
            keep.push(e);
          }
        }
        entityGroupsRef.current.lightning = keep;
      } catch (err) {
        logger.swallow("cesium-layers:lightning-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.eonetWeather, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying, debouncedReplayTime]);
}
