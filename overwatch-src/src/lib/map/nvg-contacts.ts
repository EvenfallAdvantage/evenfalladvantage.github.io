/**
 * NVG contact visibility. The NVG post-process keeps strongly saturated pixels'
 * hue (chroma preserve), so under NVG aircraft, ships and satellites are drawn
 * in their full category colour, with a bright white halo and a larger size,
 * so they pop off the green scene and stay distinguishable from each other.
 */
export const NVG_CONTACT = Object.freeze({
  billboardScale: 1.7,   // multiplier on the layer's own icon scale
  modelMinPixels: 1.8,   // multiplier on 3D models' minimum on-screen size
  pointPixelSize: 12,    // satellites far away (default 6)
  pointOutlineWidth: 3,
  modelBlend: 0.95,      // category colour nearly flat over model shading
  silhouette: "#ffffff",
  silhouetteAlpha: 1,
  silhouetteSize: 3,
});

export type ContactKind = "plane" | "ship" | "sat";
/** plane-/ship-/sat- markers; never tracks, labels or helper entities. */
export function contactKind(id: unknown): ContactKind | null {
  const s = String(id);
  if (/^plane-/.test(s)) return "plane";
  if (/^ship-/.test(s)) return "ship";
  if (/^sat-\d+$/.test(s)) return "sat";
  return null;
}
