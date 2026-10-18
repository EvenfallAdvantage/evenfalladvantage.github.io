/**
 * 3D Cities basemap: Google Photorealistic 3D Tiles drawn straight from the
 * Map Tiles API (key from NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY, never ion).
 *
 * - Created once per page load (one root session). Switching away hides it.
 * - While on, the globe is hidden so Google's mesh isn't mixed with other
 *   basemaps; ion OSM buildings are hidden too. Points/labels still draw.
 * - Any key/quota error or a burst of tile failures removes it and falls back
 *   to the normal imagery for the rest of the page session.
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  GOOGLE_3D_AVAILABLE, GOOGLE_3D_FALLBACK_MESSAGE, GOOGLE_MAP_TILES_KEY, failureStatus, google3dScreenSpaceError, isExpiredSession, shouldFallBack,
  type Google3dStatus, type TileFailure,
} from "@/lib/map/google-3d";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useGoogle3dTiles(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean;
  enabled: boolean; constrained: boolean;
}): Google3dStatus {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, constrained } = params;
  const [status, setStatus] = useState<Google3dStatus>("off");
  const failedRef = useRef(false);
  const creatingRef = useRef(false);
  const failuresRef = useRef<TileFailure[]>([]);
  const [renewTick, setRenewTick] = useState(0);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !GOOGLE_3D_AVAILABLE) return;
    const groups = entityGroupsRef.current;
    const want = enabled && !failedRef.current;

    const applyScene = (on: boolean) => {
      viewer.scene.globe.show = !on;
      const buildings = groups.buildings?.[0];
      if (buildings) buildings.show = on ? false : buildings.show;
      if (groups.google3d) groups.google3d.show = on;
      viewer.scene.requestRender();
    };

    const fallBack = (why: unknown) => {
      if (failedRef.current) return;
      failedRef.current = true;
      logger.swallow("google-3d:fallback", why, "warn");
      const ts = groups.google3d;
      groups.google3d = null;
      if (ts) { try { viewer.scene.primitives.remove(ts); } catch (e) { logger.swallow("google-3d:remove", e, "debug"); } }
      applyScene(false);
      setStatus("failed");
      toast.warning(GOOGLE_3D_FALLBACK_MESSAGE);
    };

    if (!want) {
      if (groups.google3d) applyScene(false);
      if (!failedRef.current) setStatus("off");
      return;
    }

    if (groups.google3d) { applyScene(true); setStatus("on"); return; }
    if (creatingRef.current) return;
    creatingRef.current = true;
    setStatus("loading");
    (async () => {
      try {
        const tileset = await Cesium.createGooglePhotorealistic3DTileset(
          // Direct Map Tiles API (key) - not the ion asset. This map has no
          // geocoder at all, so no non-Google geocoder is used with the tiles.
          { key: GOOGLE_MAP_TILES_KEY, onlyUsingWithGoogleGeocoder: true },
          {
            showCreditsOnScreen: true, // Google logo + per-tile data attributions
            maximumScreenSpaceError: google3dScreenSpaceError(constrained),
            cacheBytes: constrained ? 128 * 1024 * 1024 : 512 * 1024 * 1024, // in-memory GPU/tile budget only
          },
        );
        if (viewer.isDestroyed?.()) return;
        const sessionStartedAt = Date.now();
        tileset.tileFailed.addEventListener((err: { message?: string }) => {
          const now = Date.now();
          if (isExpiredSession(failureStatus(err?.message), sessionStartedAt, now) && groups.google3d === tileset) {
            // The 3-hour session ran out: start exactly one new root session.
            groups.google3d = null;
            try { viewer.scene.primitives.remove(tileset); } catch (e) { logger.swallow("google-3d:renew", e, "debug"); }
            failuresRef.current = [];
            setRenewTick((t) => t + 1);
            return;
          }
          failuresRef.current = [...failuresRef.current.filter((f) => now - f.at <= 30_000), { at: now, status: failureStatus(err?.message), message: err?.message }];
          if (shouldFallBack(failuresRef.current, now)) fallBack(new Error(`Google 3D tiles failing: ${err?.message ?? "unknown"}`));
        });
        viewer.scene.primitives.add(tileset);
        groups.google3d = tileset;
        // The effect may have been switched off while loading.
        applyScene(groups.google3dWanted !== false);
        setStatus(groups.google3dWanted !== false ? "on" : "off");
      } catch (e) {
        fallBack(e);
      } finally {
        creatingRef.current = false;
      }
    })();
  }, [enabled, loading, constrained, renewTick, viewerRef, cesiumRef, entityGroupsRef]);

  // Track the latest wish for the async loader above.
  useEffect(() => { entityGroupsRef.current.google3dWanted = enabled; }, [enabled, entityGroupsRef]);

  return GOOGLE_3D_AVAILABLE ? status : "off";
}
