import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import type { LayerVisibility } from "../map-layers-panel";
import { addEffect, NOIR_EFFECT, NVG_EFFECT, removeEffect, SCOPE_EFFECT, setBloom, SHARPEN_EFFECT, SONAR_EFFECT, type EffectSpec } from "../effects";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/** Frame cadence for animated effects (NVG scintillation) under requestRenderMode. */
const EFFECT_FRAME_MS = 66;

type EffectKey = "nvgGoggles" | "noir" | "sharpen" | "sonarSweep" | "scopeMask";
const SPECS: Record<EffectKey, EffectSpec> = { nvgGoggles: NVG_EFFECT, noir: NOIR_EFFECT, sharpen: SHARPEN_EFFECT, sonarSweep: SONAR_EFFECT, scopeMask: SCOPE_EFFECT };

/** One post-process stage per toggle (ported from gods-eye-view, MIT). */
/** `order` re-adds a stage when an earlier stage changes, so overlays always draw last. */
function useEffectStage(key: EffectKey, on: boolean, viewerRef: CesiumRef, cesiumRef: CesiumRef, entityGroupsRef: EntityGroupsRef, loading: boolean, order = "") {
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !on) return;
    const spec = SPECS[key];
    const groups = entityGroupsRef.current;
    const stage = addEffect(viewer, Cesium, spec);
    groups[`fx_${key}`] = stage;
    // The performance governor turns optional effects off while it is reducing quality.
    if (!stage) return;
    if (key === "sharpen" && Number(groups.perfLevel ?? 0) > 0) stage.enabled = false;
    const stopPump = spec.animated
      ? setVisibleInterval(() => { if (!viewer.isDestroyed?.()) viewer.scene.requestRender(); }, EFFECT_FRAME_MS)
      : () => {};
    return () => {
      stopPump();
      removeEffect(viewer, stage);
      if (groups[`fx_${key}`] === stage) groups[`fx_${key}`] = null;
    };
  }, [key, on, viewerRef, cesiumRef, entityGroupsRef, loading, order]);
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
  // Screen overlays draw after every look so NVG/thermal/noir/CRT don't recolour them.
  // The animated sonar sweep is desktop-only; the static scope mask is cheap everywhere.
  const order = `${!!layers.nvgGoggles}${!!layers.noir}${!!layers.sharpen}${!!layers.flirThermal}${!!layers.crtMode}`;
  useEffectStage("sonarSweep", !!layers.sonarSweep && !isConstrainedDevice(), viewerRef, cesiumRef, entityGroupsRef, loading, order);
  useEffectStage("scopeMask", !!layers.scopeMask, viewerRef, cesiumRef, entityGroupsRef, loading, order + !!layers.sonarSweep);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    setBloom(viewer, !!layers.bloom && !(Number(entityGroupsRef.current.perfLevel ?? 0) > 0));
  }, [layers.bloom, loading, viewerRef, entityGroupsRef]);
}
