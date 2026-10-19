/**
 * Which tracked contacts get a 3D model, and which model.
 *
 * Desktop only. A model replaces the flat icon for aircraft close to the
 * camera (and always for the tracked aircraft), capped by count and by the
 * performance governor's level. Models are CC BY 4.0 (credits and
 * modification notes in public/models/README.md), loaded lazily on first use.
 * Selection rules follow gods-eye-view's "model nearby, icon far" policy
 * (MIT); the code is our own.
 */
import type { AircraftClass } from "./aircraft-class";
import { distanceM } from "./aircraft-motion";

export const MODEL_BASE = "/overwatch/models";

/** Class → model file (all real-world metres, glTF Y-up, nose −X). */
export const CLASS_MODEL: Record<AircraftClass, string> = {
  light: "c172.glb",
  glider: "c172.glb",
  turboprop: "atr72.glb",
  airliner: "airplane.glb",
  widebody: "airplane.glb",
  quadjet: "airplane.glb",
  helicopter: "bell206.glb",
  bizjet: "citation2.glb",
  fastjet: "jet.glb",
  uav: "jet.glb",
};

/** The models' noses point to glTF −X, which is opposite Cesium heading 0 (same as gods-eye-view). */
export const MODEL_HEADING_OFFSET_DEG = 180;
export const modelHeadingDeg = (trackDeg: number) => (((trackDeg + MODEL_HEADING_OFFSET_DEG) % 360) + 360) % 360;

export const MODEL_NEAR_M = 30_000;
export const MODEL_MAX_CAMERA_M = 80_000;
/** Max simultaneous models by governor level (0 full, 1 reduced, 2 minimum). */
export const MODEL_CAP_BY_LEVEL = [24, 8, 1] as const;

export interface ModelCandidate { id: string; lat: number; lng: number; altM: number }

/**
 * Ids that should show a model now: nearest first within `nearM` of the camera
 * ground point, the tracked id always first. Nothing when the camera is high.
 */
export function selectModelIds(
  camera: { lat: number; lng: number; heightM: number },
  items: readonly ModelCandidate[],
  trackedId: string | null | undefined,
  level = 0,
  nearM = MODEL_NEAR_M,
  maxCameraM = MODEL_MAX_CAMERA_M,
): string[] {
  const cap = MODEL_CAP_BY_LEVEL[Math.max(0, Math.min(2, level))];
  const out: string[] = [];
  if (trackedId && items.some((i) => i.id === trackedId)) out.push(trackedId);
  if (camera.heightM > maxCameraM) return out;
  const near = items
    .filter((i) => i.id !== trackedId)
    .map((i) => ({ id: i.id, d: Math.hypot(distanceM(camera, i), i.altM - camera.heightM) }))
    .filter((x) => x.d <= nearM)
    .sort((a, b) => a.d - b.d);
  for (const n of near) { if (out.length >= cap) break; out.push(n.id); }
  return out;
}
