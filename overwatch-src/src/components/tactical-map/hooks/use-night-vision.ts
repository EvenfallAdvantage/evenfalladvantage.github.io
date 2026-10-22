import { OSM_STREETS_CREDIT, OSM_STREETS_URL } from "@/lib/map/basemap-sources";
import { OVERLAY_ALPHA, withOverlayFilter, type OverlayStyle } from "@/lib/map/osm-overlay";
import { wantsGlobeLighting } from "@/lib/map/city-lights";
import { useEffect } from "react";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/**
 * Night Mode: a dark "ops" look with no third-party dark tiles.
 *
 * Previously this swapped in CARTO Dark Matter tiles, which need a CARTO
 * account/licence for commercial use. Now it re-grades the imagery we already
 * load (EOX/USGS satellite, or OSM streets) with Cesium's per-layer colour
 * controls. It no longer forces sun lighting (that blacked out the night side
 * of the globe). Over satellite imagery we add a free OSM reference overlay
 * with its area fills keyed out and lightness inverted (light labels on a dark
 * halo), so roads, borders and labels stay readable. The Hybrid basemap uses
 * the same overlay without the inversion.
 */
export const NIGHT_GRADE = Object.freeze({ brightness: 0.6, contrast: 1.15, saturation: 0.25, gamma: 0.9, hue: 0.0 });
/** Reference overlay (roads/labels/borders) drawn over dimmed satellite in Dark mode. */
export const NIGHT_REFERENCE = Object.freeze({ landColor: "#f2efe9", alpha: OVERLAY_ALPHA.dark, brightness: 1.0, contrast: 1.1, saturation: 0.6, gamma: 1.0, hue: 0.0 });
/** Hybrid overlay: plain OSM roads/labels over full-colour satellite. */
export const HYBRID_REFERENCE = Object.freeze({ alpha: OVERLAY_ALPHA.hybrid, brightness: 1.0, contrast: 1.0, saturation: 1.0, gamma: 1.0, hue: 0.0 });
/** Dark mode alone no longer turns on globe lighting; only City Lights does. */
export function nightModeLighting(l: { nightVision?: boolean; cityLights?: boolean }): boolean {
  return wantsGlobeLighting({ cityLights: l.cityLights });
}
const NEUTRAL = Object.freeze({ brightness: 1.0, contrast: 1.0, saturation: 1.0, gamma: 1.0, hue: 0.0 });

type Gradable = { brightness: number; contrast: number; saturation: number; gamma: number; hue: number };

export function applyGrade(layer: Gradable, grade: Readonly<Gradable>): void {
  layer.brightness = grade.brightness;
  layer.contrast = grade.contrast;
  layer.saturation = grade.saturation;
  layer.gamma = grade.gamma;
  layer.hue = grade.hue;
}

/** Ion OSM Buildings (only present when ion is licensed). */
function setTilesetStyle(tileset: { style?: unknown } | undefined, style: unknown): void {
  if (tileset) tileset.style = style;
}

export function useNightVision(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const basemaps: Gradable[] = [
      ...(entityGroupsRef.current.baseImagery ?? []),
      ...(entityGroupsRef.current.osmLayerRef ?? []),
    ];
    const grade = layers.nightVision ? NIGHT_GRADE : NEUTRAL;
    for (const l of basemaps) applyGrade(l, grade);

    setTilesetStyle(
      entityGroupsRef.current.buildings?.[0],
      layers.nightVision ? new Cesium.Cesium3DTileStyle({ color: "color('rgba(0, 255, 65, 0.15)')", show: true }) : undefined,
    );
    // Streets/labels overlay over satellite: dark-styled in Dark, plain in Hybrid.
    const onSat = !!layers.satellite;
    const darkRef = ensureOverlay(viewer, Cesium, entityGroupsRef.current, "nightRefLayer", "dark", onSat && !!layers.nightVision);
    const hybridRef = ensureOverlay(viewer, Cesium, entityGroupsRef.current, "hybridRefLayer", "hybrid", onSat && !layers.nightVision && !!layers.hybrid);
    if (darkRef) setLayerShow(darkRef, onSat && !!layers.nightVision);
    if (hybridRef) setLayerShow(hybridRef, onSat && !layers.nightVision && !!layers.hybrid);
    viewer.scene.globe.enableLighting = nightModeLighting({ nightVision: layers.nightVision, cityLights: layers.cityLights });
    viewer.scene.requestRender();
    // layers.satellite: re-grade when the streets layer is created/swapped.
  }, [layers.nightVision, layers.cityLights, layers.satellite, layers.hybrid, loading, viewerRef, cesiumRef, entityGroupsRef]);
}

/** Toggle an imagery layer's visibility outside the hook body (keeps react-hooks/immutability happy). */
function setLayerShow(layer: { show: boolean }, show: boolean): void {
  layer.show = show;
}

type OverlayLayer = Gradable & { show: boolean; alpha: number };

/** Create the overlay layer on first use (only when wanted); returns the existing one otherwise. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureOverlay(viewer: any, Cesium: any, groups: Record<string, any>, key: string, style: OverlayStyle, want: boolean): OverlayLayer | undefined {
  const existing = groups[key]?.[0] as OverlayLayer | undefined;
  if (existing || !want) return existing;
  const provider = withOverlayFilter(new Cesium.UrlTemplateImageryProvider({
    url: OSM_STREETS_URL,
    credit: new Cesium.Credit(OSM_STREETS_CREDIT, true),
    maximumLevel: 19,
  }), style);
  const layer = viewer.imageryLayers.addImageryProvider(provider) as OverlayLayer;
  const grade = style === "dark" ? NIGHT_REFERENCE : HYBRID_REFERENCE;
  layer.alpha = grade.alpha;
  applyGrade(layer, grade);
  groups[key] = [layer];
  return layer;
}
