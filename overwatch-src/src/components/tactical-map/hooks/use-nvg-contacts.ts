import { useEffect } from "react";
import { CATEGORY_COLOR, shipCategory } from "@/lib/map/ships";
import { NVG_CONTACT, contactKind } from "@/lib/map/nvg-contacts";
import { setVisibleInterval } from "@/lib/visible-interval";
import type { CesiumRef } from "./cesium-layer-types";

const TICK_MS = 1_000;

/* eslint-disable @typescript-eslint/no-explicit-any -- Cesium entities have no published types */
function categoryColor(e: any): string | undefined {
  if (e._owColor) return e._owColor;
  if (e._owShip) return CATEGORY_COLOR[shipCategory(e._owShip.ship_type)];
  return undefined;
}

/** Apply (or undo) the NVG halo/scale/colour to every contact. Idempotent; returns true if anything changed. */
export function applyNvgContacts(viewer: any, C: any, on: boolean): boolean {
  let changed = false;
  for (const e of viewer.entities.values) {
    if (!contactKind(e.id)) continue;
    const orig = e._owNvg;
    if (on) {
      const col = categoryColor(e);
      const st = (e._owNvg ??= { scale: undefined as number | undefined, applied: undefined as number | undefined, px: undefined, ow: undefined, mp: undefined as number | undefined, mpApplied: undefined as number | undefined });
      if (!orig && e.point) {
        st.px = e.point.pixelSize?.getValue?.(); st.ow = e.point.outlineWidth?.getValue?.();
        e.point.pixelSize = NVG_CONTACT.pointPixelSize; e.point.outlineWidth = NVG_CONTACT.pointOutlineWidth; e.point.outlineColor = C.Color.WHITE;
        changed = true;
      }
      // Layers rewrite the icon scale on each poll; treat a new value as the new base.
      const cur = e.billboard?.scale?.getValue?.();
      if (typeof cur === "number" && cur !== st.applied) {
        st.scale = cur; st.applied = cur * NVG_CONTACT.billboardScale;
        e.billboard.scale = st.applied;
        changed = true;
      }
      const mp = e.model?.minimumPixelSize?.getValue?.();
      if (typeof mp === "number" && mp !== st.mpApplied) {
        st.mp = mp; st.mpApplied = mp * NVG_CONTACT.modelMinPixels;
        e.model.minimumPixelSize = st.mpApplied;
        changed = true;
      }
      // Models are (re)created and restyled by their layers, so re-assert every tick.
      if (e.model && col) {
        const want = C.Color.fromCssColorString(col);
        const cur = e.model.color?.getValue?.();
        if (!cur || !C.Color.equals(cur, want) || e.model.silhouetteSize?.getValue?.() !== NVG_CONTACT.silhouetteSize) {
          e.model.color = want;
          e.model.colorBlendAmount = NVG_CONTACT.modelBlend;
          e.model.silhouetteColor = C.Color.fromCssColorString(NVG_CONTACT.silhouette).withAlpha(NVG_CONTACT.silhouetteAlpha);
          e.model.silhouetteSize = NVG_CONTACT.silhouetteSize;
          changed = true;
        }
      }
    } else if (orig) {
      // Restore the base size unless the layer already rewrote it since.
      if (e.billboard && typeof orig.scale === "number" && e.billboard.scale?.getValue?.() === orig.applied) e.billboard.scale = orig.scale;
      if (e.point) { e.point.pixelSize = orig.px ?? 6; e.point.outlineWidth = orig.ow ?? 1; }
      if (e.model && typeof orig.mp === "number" && e.model.minimumPixelSize?.getValue?.() === orig.mpApplied) e.model.minimumPixelSize = orig.mp;
      e._owNvg = undefined;
      changed = true;
    }
  }
  return changed;
}

/**
 * NVG only: make aircraft, ships and satellites stand out against the green
 * image (category colour kept saturated, white halo, larger icons). Off restores
 * icon sizes; model colours are restored by the layers' own restyle on toggle.
 */
export function useNvgContacts(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; loading: boolean; enabled: boolean }) {
  const { viewerRef, cesiumRef, loading, enabled } = params;
  useEffect(() => {
    const viewer = viewerRef.current, C = cesiumRef.current;
    if (!viewer || !C || loading) return;
    const run = () => { if (!viewer.isDestroyed?.() && applyNvgContacts(viewer, C, enabled)) viewer.scene.requestRender(); };
    run();
    if (!enabled) return;
    return setVisibleInterval(run, TICK_MS);
  }, [enabled, loading, viewerRef, cesiumRef]);
}
