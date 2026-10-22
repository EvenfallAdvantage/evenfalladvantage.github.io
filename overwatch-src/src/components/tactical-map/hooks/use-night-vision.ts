import { OSM_STREETS_CREDIT, OSM_STREETS_URL } from "@/lib/map/basemap-sources";
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
 * with its pale land fill keyed out, so roads, borders and labels stay readable.
 */
export const NIGHT_GRADE = Object.freeze({ brightness: 0.6, contrast: 1.15, saturation: 0.25, gamma: 0.9, hue: 0.0 });
/** Reference overlay (roads/labels/borders) drawn over dimmed satellite in Dark mode. */
export const NIGHT_REFERENCE = Object.freeze({ landColor: "#f2efe9", colorToAlphaThreshold: 0.12, alpha: 0.55, brightness: 0.75, contrast: 1.1, saturation: 0.35, gamma: 1.0, hue: 0.0 });
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
    // Reference overlay: only in Dark mode over satellite (streets basemap already has roads/labels).
    const wantRef = layers.nightVision && layers.satellite;
    let ref = entityGroupsRef.current.nightRefLayer?.[0];
    if (wantRef && !ref) {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: OSM_STREETS_URL,
        credit: new Cesium.Credit(OSM_STREETS_CREDIT, true),
        maximumLevel: 19,
      });
      ref = viewer.imageryLayers.addImageryProvider(provider);
      ref.colorToAlpha = Cesium.Color.fromCssColorString(NIGHT_REFERENCE.landColor);
      ref.colorToAlphaThreshold = NIGHT_REFERENCE.colorToAlphaThreshold;
      ref.alpha = NIGHT_REFERENCE.alpha;
      applyGrade(ref, NIGHT_REFERENCE);
      entityGroupsRef.current.nightRefLayer = [ref];
    }
    if (ref) ref.show = wantRef;
    viewer.scene.globe.enableLighting = nightModeLighting({ nightVision: layers.nightVision, cityLights: layers.cityLights });
    viewer.scene.requestRender();
    // layers.satellite: re-grade when the streets layer is created/swapped.
  }, [layers.nightVision, layers.cityLights, layers.satellite, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
