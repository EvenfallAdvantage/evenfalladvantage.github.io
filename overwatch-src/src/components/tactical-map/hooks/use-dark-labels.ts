import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import type { CesiumRef } from "./cesium-layer-types";

/**
 * Dark and Hybrid modes: give every entity label a dark backing plate so it reads over
 * the dimmed or satellite imagery. The label's own fill colour (category colour) is kept.
 * Re-applied on a 1 s tick for labels added later; restored when the mode is off.
 */
export const DARK_LABEL = Object.freeze({ backgroundAlpha: 0.7, padX: 5, padY: 3, minOutlineWidth: 3 });
const TICK_MS = 1000;

type Saved = { bg: unknown; bgc: unknown; pad: unknown; ow: unknown };

/** Idempotent; returns true when anything changed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyDarkLabels(viewer: any, C: any, on: boolean): boolean {
  const now = C.JulianDate.now();
  let changed = false;
  for (const e of viewer.entities.values as Array<{ label?: Record<string, unknown>; _owDarkLabel?: Saved }>) {
    const l = e.label;
    if (!l) continue;
    if (on && !e._owDarkLabel) {
      e._owDarkLabel = { bg: l.showBackground, bgc: l.backgroundColor, pad: l.backgroundPadding, ow: l.outlineWidth };
      l.showBackground = true;
      l.backgroundColor = new C.Color(0, 0, 0, DARK_LABEL.backgroundAlpha);
      l.backgroundPadding = new C.Cartesian2(DARK_LABEL.padX, DARK_LABEL.padY);
      const ow = (l.outlineWidth as { getValue?: (t: unknown) => number } | undefined)?.getValue?.(now) ?? 0;
      if (ow < DARK_LABEL.minOutlineWidth) l.outlineWidth = DARK_LABEL.minOutlineWidth;
      changed = true;
    } else if (!on && e._owDarkLabel) {
      const s = e._owDarkLabel;
      l.showBackground = s.bg;
      l.backgroundColor = s.bgc;
      l.backgroundPadding = s.pad;
      l.outlineWidth = s.ow;
      delete e._owDarkLabel;
      changed = true;
    }
  }
  return changed;
}

export function useDarkLabels(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; loading: boolean; enabled: boolean }) {
  const { viewerRef, cesiumRef, loading, enabled } = params;
  useEffect(() => {
    const viewer = viewerRef.current, C = cesiumRef.current;
    if (!viewer || !C || loading) return;
    const run = () => { if (!viewer.isDestroyed?.() && applyDarkLabels(viewer, C, enabled)) viewer.scene.requestRender(); };
    run();
    if (!enabled) return;
    return setVisibleInterval(run, TICK_MS);
  }, [enabled, loading, viewerRef, cesiumRef]);
}
