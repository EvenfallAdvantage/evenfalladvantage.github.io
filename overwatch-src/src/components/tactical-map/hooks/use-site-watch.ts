/**
 * Site Watch: hazards near the company's sites, on the map only (no email /
 * SMS / push). Every 5 minutes it asks intel-hazards for warnings, quakes,
 * fires, perimeters and storms near the sites (server pre-filter), samples
 * nowCOAST lightning around each site, and checks emergency aircraft from the
 * aircraft layer. Draws red (warning) / amber (watch) rings around affected sites.
 */

import { useEffect, useMemo, useState } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { fetchIntelHazards } from "@/lib/intel-client";
import type { IntelHazard } from "@/lib/intel-types";
import { lightningNear } from "@/lib/map/lightning-sample";
import { escapeHtml } from "@/lib/security";
import {
  computeSiteWatch, haversineKm, nearParam, siteLevels, sortAlerts,
  type NearRadii, type SiteAlert, type SiteArea,
} from "@/lib/map/site-proximity";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";

const REFRESH_MS = 5 * 60_000;
const AIRCRAFT_CHECK_MS = 30_000;
const MAX_LIGHTNING_SITES = 25;
const WATCH_KINDS = ["warnings", "quakes", "fires", "perimeters", "tropical"] as const;

function circle(lat: number, lng: number, km: number, n = 48): number[] {
  const out: number[] = [];
  const dLat = km / 110.574, dLng = km / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push(lng + dLng * Math.cos(a), lat + dLat * Math.sin(a));
  }
  return out;
}

export function useSiteWatch(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean;
  sites: SiteArea[];
  radii: NearRadii;
}): { alerts: SiteAlert[]; updatedAt: number | null } {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, sites, radii } = params;
  const [hazards, setHazards] = useState<IntelHazard[]>([]);
  const [lightningSites, setLightningSites] = useState<string[]>([]);
  const [aircraftAlerts, setAircraftAlerts] = useState<SiteAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const sitesKey = sites.map((s) => `${s.id}@${s.lat.toFixed(3)},${s.lng.toFixed(3)}`).join("|");
  const active = enabled && sites.length > 0;

  // Hazards + lightning
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const maxKm = Math.max(radii.warnings, radii.fires, radii.perimeters, radii.quakes, radii.cyclones) + 20;
    const load = async () => {
      try {
        const r = await fetchIntelHazards(WATCH_KINDS, { points: nearParam(sites), km: maxKm });
        if (!cancelled) setHazards(r.hazards ?? []);
      } catch (e) { logger.swallow("site-watch:hazards", e, "warn"); }
      const hits: string[] = [];
      for (const s of sites.filter((x) => x.kind === "point").slice(0, MAX_LIGHTNING_SITES)) {
        try { if (await lightningNear(s.lat, s.lng, radii.lightning)) hits.push(s.id); }
        catch (e) { logger.swallow("site-watch:lightning", e, "debug"); }
        if (cancelled) return;
      }
      if (!cancelled) { setLightningSites(hits); setUpdatedAt(Date.now()); }
    };
    void load();
    const stop = setVisibleInterval(() => void load(), REFRESH_MS);
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sitesKey captures sites
  }, [active, sitesKey, radii]);

  // Emergency aircraft near sites (data comes from the aircraft layer when it's on).
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const planes = (entityGroupsRef.current.aircraftLatest ?? []) as Array<{ icao24: string; callsign: string; lat: number; lng: number; emergency?: boolean; squawk?: string | null }>;
      const out: SiteAlert[] = [];
      for (const p of planes) {
        if (!p.emergency) continue;
        for (const s of sites) {
          const d = haversineKm(s.lat, s.lng, p.lat, p.lng);
          if (d <= radii.aircraftEmergency) out.push({ siteId: s.id, siteName: s.name, lat: s.lat, lng: s.lng, level: "watch", kind: "aircraft", title: `Aircraft emergency ${p.callsign || p.icao24}${p.squawk ? ` (squawk ${p.squawk})` : ""}`, distanceKm: Math.round(d), hazardId: `ac:${p.icao24}` });
        }
      }
      setAircraftAlerts(out);
    };
    check();
    return setVisibleInterval(check, AIRCRAFT_CHECK_MS);
  }, [active, sites, radii, entityGroupsRef]);

  const alerts = useMemo(() => {
    if (!active) return [];
    const list = computeSiteWatch(sites, hazards, radii);
    for (const id of lightningSites) {
      const s = sites.find((x) => x.id === id);
      if (s) list.push({ siteId: s.id, siteName: s.name, lat: s.lat, lng: s.lng, level: "watch", kind: "lightning", title: `Lightning within ${radii.lightning} km`, distanceKm: 0, hazardId: `ltg:${s.id}` });
    }
    return sortAlerts([...list, ...aircraftAlerts]);
  }, [active, sites, hazards, radii, lightningSites, aircraftAlerts]);

  // Rings
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !alerts.length) return;
    const ds = new C.CustomDataSource("site-watch");
    viewer.dataSources.add(ds);
    for (const [id, s] of siteLevels(alerts)) {
      const site = sites.find((x) => x.id === id);
      const km = site?.kind === "point" ? Math.max(0.8, site.radiusKm * 1.6) : 1.5;
      const color = C.Color.fromCssColorString(s.level === "warning" ? "#ef4444" : "#f59e0b");
      ds.entities.add({
        id: `sitewatch-${id}`,
        name: `Site Watch: ${s.name}`,
        polyline: { positions: C.Cartesian3.fromDegreesArray(circle(s.lat, s.lng, km)), width: 4, material: new C.PolylineGlowMaterialProperty({ glowPower: 0.25, color }), clampToGround: true },
        position: C.Cartesian3.fromDegrees(s.lng, s.lat),
        label: { text: `⚠ ${s.count}`, font: "bold 12px monospace", fillColor: color, outlineColor: C.Color.BLACK, outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -28), disableDepthTestDistance: nearSideDepthProperty(viewer, C), heightReference: C.HeightReference.CLAMP_TO_GROUND },
        description: `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:300px"><b style="color:${s.level === "warning" ? "#ef4444" : "#f59e0b"}">SITE WATCH · ${escapeHtml(s.name)}</b><div>${alerts.filter((a) => a.siteId === id).slice(0, 8).map((a) => `• ${escapeHtml(a.title)}${a.distanceKm ? ` (${a.distanceKm} km)` : " (at site)"}`).join("<br/>")}</div></div>`,
      });
    }
    viewer.scene.requestRender();
    return () => { try { viewer.dataSources.remove(ds, true); } catch (e) { logger.swallow("site-watch:remove", e, "debug"); } };
  }, [alerts, sites, loading, viewerRef, cesiumRef]);

  return { alerts, updatedAt: active ? updatedAt : null };
}
