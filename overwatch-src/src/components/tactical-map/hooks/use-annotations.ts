import { useState, useEffect, useCallback } from "react";
import type { DrawMode } from "../map-tools";
import { getAnnotations, createAnnotation, deleteAnnotation, subscribeAnnotations, type MapAnnotation } from "@/lib/supabase/db-annotations";

export function useAnnotations(
  companyId: string,
  viewerRef: React.MutableRefObject<any>,
  cesiumRef: React.MutableRefObject<any>,
  entityGroupsRef: React.MutableRefObject<Record<string, any>>
) {
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]); // [lng, lat]
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);

  // Annotation subscription — load + subscribe to real-time changes
  useEffect(() => {
    if (!companyId) return;

    getAnnotations(companyId).then(setAnnotations).catch(() => {});
    const unsub = subscribeAnnotations(companyId, () => {
      getAnnotations(companyId).then(setAnnotations).catch(() => {});
    });
    return unsub;
  }, [companyId]);

  // Draw finish handler — save annotation to DB
  const handleDrawFinish = useCallback(() => {
    if (drawPoints.length < 2 && drawMode !== "text") return;
    const type = drawMode === "none" ? "line" : drawMode;

    // For circles, compute radius from first to last point
    let geometry: MapAnnotation["geometry"];
    if (type === "circle" && drawPoints.length >= 2) {
      const [cLng, cLat] = drawPoints[0];
      const [eLng, eLat] = drawPoints[drawPoints.length - 1];
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(eLat - cLat);
      const dLng = toRad(eLng - cLng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(cLat)) * Math.cos(toRad(eLat)) * Math.sin(dLng / 2) ** 2;
      const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      geometry = { positions: [drawPoints[0]], radius };
    } else {
      geometry = { positions: drawPoints };
    }

    createAnnotation(companyId, {
      eventId: null,
      type: type as MapAnnotation["type"],
      geometry,
      label: null,
      color: drawColor,
      style: "solid",
    });

    // Clean up temp markers
    const viewer = viewerRef.current;
    drawPoints.forEach((_, i) => { try { viewer?.entities.removeById(`draw-pt-${i}`); } catch {} });
    setDrawPoints([]);
    setDrawMode("none");
  }, [drawPoints, drawMode, drawColor, companyId, viewerRef]);

  const handleDrawCancel = useCallback(() => {
    const viewer = viewerRef.current;
    drawPoints.forEach((_, i) => { try { viewer?.entities.removeById(`draw-pt-${i}`); } catch {} });
    setDrawPoints([]);
    setDrawMode("none");
  }, [drawPoints, viewerRef]);

  const handleClearAnnotations = useCallback(async () => {
    for (const ann of annotations) {
      await deleteAnnotation(ann.id);
    }
  }, [annotations]);

  return {
    drawMode, setDrawMode,
    drawColor, setDrawColor,
    drawPoints, setDrawPoints,
    annotations,
    handleDrawFinish,
    handleDrawCancel,
    handleClearAnnotations,
  };
}
