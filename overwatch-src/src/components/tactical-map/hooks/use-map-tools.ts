import { useState, useEffect, useRef } from "react";
import type { ActiveTool } from "../map-tools";
import { RANGE_RING_RADII_M } from "../map-tools";
import { clearLineOfSight } from "../terrain-tools";

export function useMapTools(
  viewerRef: React.MutableRefObject<any>,
  cesiumRef: React.MutableRefObject<any>
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

  // Clean up tool entities when tool changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (activeTool !== "measure") {
      ["measure-p1", "measure-p2", "measure-line"].forEach(id => { try { viewer.entities.removeById(id); } catch {} });
      setMeasurePoint1(null);
      setMeasureResult(null);
    }
    if (activeTool !== "range-rings") {
      RANGE_RING_RADII_M.forEach((_: number, i: number) => { try { viewer.entities.removeById(`ring-${i}`); viewer.entities.removeById(`ring-label-${i}`); } catch {} });
      try { viewer.entities.removeById("ring-center"); } catch {}
      setRangeCenter(null);
    }
    if (activeTool !== "los") {
      clearLineOfSight(viewer, losEntityIdsRef.current);
      try { viewer.entities.removeById("los-click-1"); } catch {}
      losEntityIdsRef.current = [];
      setLosPoint1(null);
      setLosResult(null);
    }
    if (activeTool !== "elevation") {
      try { viewer.entities.removeById("elev-click-1"); viewer.entities.removeById("elev-line"); } catch {}
      setElevPoint1(null);
      setElevationStatus(null);
    }
  }, [activeTool, viewerRef]);

  return {
    activeTool, setActiveTool,
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
