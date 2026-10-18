import { useEffect } from "react";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/**
 * Night Mode: a dark "ops" look with no third-party dark tiles.
 *
 * Previously this swapped in CARTO Dark Matter tiles, which need a CARTO
 * account/licence for commercial use. Now it re-grades the imagery we already
 * load (EOX/USGS satellite, or OSM streets) with Cesium's per-layer colour
 * controls and turns on real sun lighting — zero extra requests.
 */
export const NIGHT_GRADE = Object.freeze({ brightness: 0.35, contrast: 1.25, saturation: 0.15, gamma: 1.15, hue: 0.0 });
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
    viewer.scene.globe.enableLighting = !!layers.nightVision;
    viewer.scene.requestRender();
    // layers.satellite: re-grade when the streets layer is created/swapped.
  }, [layers.nightVision, layers.satellite, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
