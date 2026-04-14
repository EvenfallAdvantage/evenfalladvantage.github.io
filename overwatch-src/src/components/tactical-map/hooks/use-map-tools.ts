import { useState, useRef, useCallback, useEffect } from "react";
import type { ActiveTool } from "../map-tools";
import { RANGE_RING_RADII_M } from "../map-tools";
import { clearLineOfSight } from "../terrain-tools";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium viewer/module refs have no published TS types
type CesiumRef = React.MutableRefObject<any>;

export function useMapTools(
  viewerRef: CesiumRef,
  cesiumRef: CesiumRef
) {
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [measureResult, setMeasureResult] = useState<{ distanceM: number; distanceMi: number; bearing: number } | null>(null);
  const [measurePoint1, setMeasurePoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [rangeCenter, setRangeCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [losPoint1, setLosPoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [losResult, setLosResult] = useState<{ visible: boolean; distance?: number } | null>(null);
  const [elevPoint1, setElevPoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [elevationStatus, setElevationStatus] = useState<string | null>(null);
  const losEntityIdsRef = useRef<string[]>([]);

  // Clean up tool entities when switching tools — done eagerly in the callback
  // rather than in an effect, to avoid synchronous setState in effects.
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; });
  const switchTool = useCallback((nextTool: ActiveTool) => {
    const prevTool = activeToolRef.current;
    if (prevTool === nextTool) return;
    const viewer = viewerRef.current;
    if (viewer) {
      if (prevTool === "measure") {
        ["measure-p1", "measure-p2", "measure-line"].forEach(id => { try { viewer.entities.removeById(id); } catch {} });
      }
      if (prevTool === "range-rings") {
        RANGE_RING_RADII_M.forEach((_: number, i: number) => { try { viewer.entities.removeById(`ring-${i}`); viewer.entities.removeById(`ring-label-${i}`); } catch {} });
        try { viewer.entities.removeById("ring-center"); } catch {}
      }
      if (prevTool === "los") {
        clearLineOfSight(viewer, losEntityIdsRef.current);
        try { viewer.entities.removeById("los-click-1"); } catch {}
        losEntityIdsRef.current = [];
      }
      if (prevTool === "elevation") {
        try { viewer.entities.removeById("elev-click-1"); viewer.entities.removeById("elev-line"); } catch {}
      }
    }
    setActiveTool(nextTool);
    setMeasurePoint1(null);
    setMeasureResult(null);
    setRangeCenter(null);
    setLosPoint1(null);
    setLosResult(null);
    setElevPoint1(null);
    setElevationStatus(null);
  }, [viewerRef]);

  return {
    activeTool, setActiveTool: switchTool,
    measureResult, setMeasureResult,
    measurePoint1, setMeasurePoint1,
    rangeCenter, setRangeCenter,
    losPoint1, setLosPoint1,
    losResult, setLosResult,
    elevPoint1, setElevPoint1,
    elevationStatus, setElevationStatus,
    losEntityIdsRef,
  };
}
