/**
 * Natural hazards (panel v2) from the intel-hazards function:
 *   - NWS warnings / watches / advisories as polygons   (layers.nwsWarnings)
 *   - quakes, fire detections, wildfire perimeters, volcanoes (layers.naturalHazards)
 *   - tropical cyclones: position, forecast cone, track (layers.tropical)
 * One request for whichever sources are on; refresh every 5 minutes.
 * Returns the fetched hazards so other features (Site Watch) can reuse them.
 */

import { useEffect, useMemo, useState } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import { fetchIntelHazards } from "@/lib/intel-client";
import type { IntelHazard } from "@/lib/intel-types";
import { HAZARD_KIND_LABELS, hazardColor, hazardSourcesFor, hazardVisible } from "@/lib/map/hazard-style";
import { pointBudget, topN, withSuspendedEvents } from "@/lib/map/device-profile";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";

const REFRESH_MS = 5 * 60_000;
const NO_HAZARDS: IntelHazard[] = [];
function currentTimestamp() { return Date.now(); }

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "";
}

export function hazardPopup(h: IntelHazard): string {
  const color = hazardColor(h);
  const link = safeHttpUrl(h.url ?? "");
  const when = [h.starts_at ? `From ${fmtTime(h.starts_at)}` : "", h.ends_at ? `until ${fmtTime(h.ends_at)}` : ""].filter(Boolean).join(" ");
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:300px">
    <b style="color:${color}">${escapeHtml(HAZARD_KIND_LABELS[h.kind].toUpperCase())}</b>
    <div style="margin-top:2px">${escapeHtml(h.title)}</div>
    ${when ? `<div style="color:#94a3b8">${escapeHtml(when)}</div>` : ""}
    ${link ? `<div style="margin-top:4px"><a href="${escapeHtml(link)}" target="_blank" rel="noopener" style="color:#7dd3fc">Details →</a></div>` : ""}
    <div style="color:#64748b;margin-top:4px;font-size:9px">Source: ${escapeHtml(h.source)} (public domain)</div>
  </div>`;
}

function polygonsOf(h: IntelHazard): [number, number][][][] {
  if (h.geometry.type === "Polygon") return [h.geometry.coordinates];
  if (h.geometry.type === "MultiPolygon") return h.geometry.coordinates;
  return [];
}

const FILL_ALPHA: Partial<Record<IntelHazard["kind"], number>> = { warning: 0.28, watch: 0.18, advisory: 0.12, perimeter: 0.4, cyclone_cone: 0.14 };

export function useHazardsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
  /** Extra sources to fetch even when not drawn (e.g. Site Watch). */
  alsoFetch?: readonly import("@/lib/intel-types").HazardSource[];
  /** Optional scope filter (near my sites / map view). */
  filter?: (h: IntelHazard) => boolean;
}): { hazards: IntelHazard[] } {
  const { viewerRef, cesiumRef, loading, layers, debouncedReplayTime, timeMachineOpen, alsoFetch, filter } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;
  const [hazards, setHazards] = useState<IntelHazard[]>([]);
  const vis = useMemo(() => ({ nwsWarnings: layers.nwsWarnings, naturalHazards: layers.naturalHazards, tropical: layers.tropical }), [layers.nwsWarnings, layers.naturalHazards, layers.tropical]);
  const sourcesKey = [...new Set([...hazardSourcesFor(vis), ...(alsoFetch ?? [])])].sort().join(",");

  // Fetch
  useEffect(() => {
    if (!sourcesKey || isReplaying) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetchIntelHazards(sourcesKey.split(",") as never);
        if (!cancelled) setHazards(r.hazards ?? []);
      } catch (e) { logger.swallow("cesium-layers:hazards-fetch", e, "warn"); }
    };
    void load();
    const stop = setVisibleInterval(() => void load(), REFRESH_MS);
    return () => { cancelled = true; stop(); };
  }, [sourcesKey, isReplaying]);

  const liveHazards = sourcesKey && !isReplaying ? hazards : NO_HAZARDS;

  // Draw
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading) return;
    const ds = new C.CustomDataSource("hazards");
    viewer.dataSources.add(ds);
    const shown = liveHazards.filter((h) => hazardVisible(h, vis) && (!filter || filter(h)));
    const fires = topN(shown.filter((h) => h.kind === "fire"), pointBudget("fires"), (h) => Number(h.props?.frp ?? 0));
    const rest = shown.filter((h) => h.kind !== "fire");
    // Big areas first so small warnings draw on top.
    rest.sort((a, b) => (a.kind === "cyclone_cone" ? -1 : 0) - (b.kind === "cyclone_cone" ? -1 : 0) || a.severity - b.severity);
    withSuspendedEvents(ds.entities, () => {
      for (const h of [...rest, ...fires]) {
        const color = C.Color.fromCssColorString(hazardColor(h));
        const description = hazardPopup(h);
        const g = h.geometry;
        try {
          if (g.type === "Point") {
            const [lng, lat] = g.coordinates;
            const size = h.kind === "quake" ? 6 + h.severity * 3 : h.kind === "cyclone" ? 16 : h.kind === "volcano" ? 10 : 4 + h.severity;
            ds.entities.add({
              id: `hz-${h.id}`,
              name: h.title,
              position: C.Cartesian3.fromDegrees(lng, lat),
              point: { pixelSize: size, color: color.withAlpha(h.kind === "fire" ? 0.85 : 0.9), outlineColor: C.Color.BLACK.withAlpha(0.7), outlineWidth: 1, disableDepthTestDistance: nearSideDepthProperty(viewer, C), heightReference: C.HeightReference.CLAMP_TO_GROUND },
              label: h.kind === "cyclone" ? { text: h.title.split(" · ")[0], font: "11px monospace", fillColor: color, outlineColor: C.Color.BLACK, outlineWidth: 2, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -18), disableDepthTestDistance: nearSideDepthProperty(viewer, C) } : undefined,
              description,
            });
          } else if (g.type === "LineString") {
            ds.entities.add({
              id: `hz-${h.id}`,
              name: h.title,
              polyline: { positions: C.Cartesian3.fromDegreesArray(g.coordinates.flat()), width: 2.5, material: new C.PolylineDashMaterialProperty({ color }), clampToGround: true },
              description,
            });
          } else {
            polygonsOf(h).forEach((rings, i) => {
              const [outer, ...holes] = rings;
              if (!outer || outer.length < 4) return;
              ds.entities.add({
                id: `hz-${h.id}-${i}`,
                name: h.title,
                polygon: {
                  hierarchy: new C.PolygonHierarchy(
                    C.Cartesian3.fromDegreesArray(outer.flat()),
                    holes.filter((r) => r.length >= 4).map((r) => new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(r.flat()))),
                  ),
                  material: color.withAlpha(FILL_ALPHA[h.kind] ?? 0.2),
                  classificationType: C.ClassificationType.BOTH,
                },
                polyline: { positions: C.Cartesian3.fromDegreesArray(outer.flat()), width: h.kind === "warning" ? 2 : 1.25, material: color.withAlpha(0.9), clampToGround: true },
                description,
              });
            });
          }
        } catch (e) { logger.swallow("cesium-layers:hazard-entity", e, "debug"); }
      }
    });
    viewer.scene.requestRender();
    return () => {
      try { viewer.dataSources.remove(ds, true); } catch (e) { logger.swallow("cesium-layers:hazards-remove", e, "debug"); }
    };
  }, [liveHazards, vis, filter, loading, viewerRef, cesiumRef]);

  return { hazards: liveHazards };
}
