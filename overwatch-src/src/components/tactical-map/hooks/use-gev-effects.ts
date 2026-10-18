import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import type { LayerVisibility } from "../map-layers-panel";
import { addEffect, NOIR_EFFECT, NVG_EFFECT, removeEffect, setBloom, SHARPEN_EFFECT, type EffectSpec } from "../effects";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/** Frame cadence for animated effects (NVG scintillation) under requestRenderMode. */
const EFFECT_FRAME_MS = 66;

type EffectKey = "nvgGoggles" | "noir" | "sharpen";
const SPECS: Record<EffectKey, EffectSpec> = { nvgGoggles: NVG_EFFECT, noir: NOIR_EFFECT, sharpen: SHARPEN_EFFECT };

/** One post-process stage per toggle (ported from gods-eye-view, MIT). */
function useEffectStage(key: EffectKey, on: boolean, viewerRef: CesiumRef, cesiumRef: CesiumRef, entityGroupsRef: EntityGroupsRef, loading: boolean) {
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !on) return;
    const spec = SPECS[key];
    const groups = entityGroupsRef.current;
    const stage = addEffect(viewer, Cesium, spec);
    groups[`fx_${key}`] = stage;
    const stopPump = spec.animated
      ? setVisibleInterval(() => { if (!viewer.isDestroyed?.()) viewer.scene.requestRender(); }, EFFECT_FRAME_MS)
      : () => {};
    return () => {
      stopPump();
      removeEffect(viewer, stage);
      if (groups[`fx_${key}`] === stage) groups[`fx_${key}`] = null;
    };
  }, [key, on, viewerRef, cesiumRef, entityGroupsRef, loading]);
}

export function useGevEffects(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;
  useEffectStage("nvgGoggles", !!layers.nvgGoggles, viewerRef, cesiumRef, entityGroupsRef, loading);
  useEffectStage("noir", !!layers.noir, viewerRef, cesiumRef, entityGroupsRef, loading);
  useEffectStage("sharpen", !!layers.sharpen, viewerRef, cesiumRef, entityGroupsRef, loading);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    setBloom(viewer, !!layers.bloom);
  }, [layers.bloom, loading, viewerRef]);
}
