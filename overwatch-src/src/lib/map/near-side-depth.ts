/**
 * Near-side-only "always on top" for map markers.
 *
 * Markers (points, billboards, labels) used `disableDepthTestDistance:
 * Infinity` so they stay readable above terrain and 3D buildings. That also
 * turns off the depth test against the globe itself, so markers on the far
 * side of the Earth drew straight through it. (Cesium only re-checks against
 * the globe for ground-clamped billboards, and only while
 * `depthTestAgainstTerrain` is on — i.e. never for plain points, aircraft,
 * labels, or any marker once 3D terrain is off.)
 *
 * The fix: disable the depth test only out to the camera's horizon distance.
 * For a sphere of radius R and a camera at distance d from its centre, a
 * surface point is visible exactly when its distance from the camera is
 * ≤ √(d² − R²). So inside that distance a marker is on the near side and
 * keeps drawing on top of terrain/buildings; beyond it the normal depth test
 * applies and the globe (or Cesium's ellipsoid depth plane when terrain is
 * off) hides it. The value depends only on camera height, so one shared
 * Cesium CallbackProperty serves every layer.
 */

/** Shrinks the horizon a little so ellipsoid flattening / limb rounding never leaks far-side points. */
export const HORIZON_MARGIN = 0.98;

/**
 * Distance (metres) from the camera to the horizon of a sphere of radius
 * `localRadiusM`, for a camera `cameraHeightM` above that surface, scaled by
 * `margin`. Returns 0 (= keep the depth test on) for invalid/underground input.
 */
export function horizonDepthDistance(cameraHeightM: number, localRadiusM: number, margin = HORIZON_MARGIN): number {
  if (!Number.isFinite(cameraHeightM) || !Number.isFinite(localRadiusM) || cameraHeightM <= 0 || localRadiusM <= 0) return 0;
  return Math.sqrt(cameraHeightM * (2 * localRadiusM + cameraHeightM)) * margin;
}

/** Pure check used by tests: is a point at `pointDistanceM` from the camera within the near-side depth-disable range? */
export function depthTestDisabledAt(pointDistanceM: number, cameraHeightM: number, localRadiusM: number, margin = HORIZON_MARGIN): boolean {
  return pointDistanceM < horizonDepthDistance(cameraHeightM, localRadiusM, margin);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Cache = { x: number; y: number; z: number; mode: unknown; value: number; property: any };
const CACHE_KEY = "__nearSideDepth";

function cacheFor(viewer: any): Cache {
  let c = viewer[CACHE_KEY] as Cache | undefined;
  if (!c) {
    c = { x: NaN, y: NaN, z: NaN, mode: undefined, value: 0, property: null };
    Object.defineProperty(viewer, CACHE_KEY, { value: c, enumerable: false, configurable: true });
  }
  return c;
}

/**
 * Current near-side depth-disable distance for `viewer` (metres). Cached per
 * camera position, so calling it for thousands of entities per frame is cheap.
 */
export function nearSideDepthDistance(viewer: any, C: any): number {
  const camera = viewer?.camera;
  if (!camera || !C) return 0;
  const scene = viewer.scene;
  const mode = scene?.mode;
  // 2D / Columbus view has no far side.
  if (C.SceneMode && mode !== undefined && mode !== C.SceneMode.SCENE3D && mode !== C.SceneMode.MORPHING) return Number.POSITIVE_INFINITY;
  const p = camera.positionWC;
  if (!p) return 0;
  const c = cacheFor(viewer);
  if (p.x === c.x && p.y === c.y && p.z === c.z && mode === c.mode) return c.value;
  c.x = p.x; c.y = p.y; c.z = p.z; c.mode = mode;
  try {
    const ellipsoid = scene?.globe?.ellipsoid ?? C.Ellipsoid?.WGS84;
    const surface = ellipsoid?.scaleToGeodeticSurface?.(p, new C.Cartesian3());
    const d = C.Cartesian3.magnitude(p);
    const r = surface ? C.Cartesian3.magnitude(surface) : 6_371_000;
    c.value = horizonDepthDistance(d - r, r);
  } catch {
    c.value = 0;
  }
  return c.value;
}

/**
 * Shared Cesium property for entity graphics:
 * `disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium)`.
 * Markers stay on top of terrain/buildings on the near side and are hidden
 * by the globe on the far side.
 */
export function nearSideDepthProperty(viewer: any, C: any): any {
  const c = cacheFor(viewer);
  if (!c.property) {
    c.property = new C.CallbackProperty(() => nearSideDepthDistance(viewer, C), false);
  }
  return c.property;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
