import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { LEVEL_SETTINGS, PerfGovernor } from "@/lib/map/perf-governor";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium viewer has no published TS types
function applyLevel(viewer: any, groups: Record<string, any>, lvl: number, bloomOn: boolean): void {
  if (!viewer || viewer.isDestroyed?.()) return;
  const s = LEVEL_SETTINGS[lvl];
  try {
    groups.perfLevel = lvl;
    viewer.resolutionScale = s.resolutionScale;
    if (groups.perfBaseSse == null) groups.perfBaseSse = viewer.scene.globe.maximumScreenSpaceError;
    viewer.scene.globe.maximumScreenSpaceError = s.globeSse ?? groups.perfBaseSse;
    const bloomStage = viewer.scene.postProcessStages?.bloom;
    if (bloomStage) bloomStage.enabled = s.effects && bloomOn;
    const sharpen = groups.fx_sharpen;
    if (sharpen) sharpen.enabled = s.effects;
    viewer.scene.requestRender();
  } catch (e) { logger.swallow("perf-governor:apply", e, "debug"); }
}

/**
 * Watches frame times while the map animates and lowers resolution / effects
 * below 30 fps (see perf-governor.ts). Returns the level and a reset action.
 */
export function usePerfGovernor(params: { viewerRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; bloom: boolean }) {
  const { viewerRef, entityGroupsRef, loading, bloom } = params;
  const [level, setLevel] = useState(0);
  const govRef = useRef(new PerfGovernor());
  const bloomRef = useRef(bloom);

  const apply = useCallback((lvl: number) => {
    applyLevel(viewerRef.current, entityGroupsRef.current, lvl, bloomRef.current);
  }, [viewerRef, entityGroupsRef]);

  // Keep bloom in sync with the user's choice when the governor allows effects.
  useEffect(() => { bloomRef.current = bloom; }, [bloom]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    const gov = govRef.current;
    let moving = false;
    let last = 0;
    const onMoveStart = () => { moving = true; last = 0; };
    const onMoveEnd = () => { moving = false; last = 0; };
    const onPostRender = () => {
      const active = moving || !!viewer.trackedEntity;
      const now = performance.now();
      if (!active) { last = 0; return; }
      if (last) {
        const next = gov.sample(now - last, now);
        if (next != null) { apply(next); setLevel(next); }
      }
      last = now;
    };
    const rmStart = viewer.camera.moveStart.addEventListener(onMoveStart);
    const rmEnd = viewer.camera.moveEnd.addEventListener(onMoveEnd);
    const rmPost = viewer.scene.postRender.addEventListener(onPostRender);
    return () => { rmStart?.(); rmEnd?.(); rmPost?.(); };
  }, [viewerRef, loading, apply]);

  const reset = useCallback(() => {
    const lvl = govRef.current.reset(performance.now());
    apply(lvl);
    setLevel(lvl);
  }, [apply]);

  return { perfLevel: level, resetPerf: reset };
}
