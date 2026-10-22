/**
 * Free OSM streets/labels overlay for the satellite basemap (Hybrid) and the
 * Dark look. Uses the standard OSM tiles already used for "Streets" (no key,
 * no paid provider). Each tile is post-processed on a canvas:
 *  - common OSM area fills (land, residential, parks, water, buildings...) are
 *    made transparent, so only roads, borders and text sit over the imagery;
 *  - for Dark, lightness is inverted (hue kept), so labels become light text
 *    on a dark halo and stay legible over the dimmed imagery.
 */

/** OSM Carto area fills keyed out over satellite imagery. */
import { toTileImage } from "./basemap-sources";

export const OSM_AREA_FILLS: ReadonlyArray<readonly [number, number, number]> = [
  [0xf2, 0xef, 0xe9], // land
  [0xe0, 0xdf, 0xdf], // residential
  [0xf2, 0xda, 0xd9], // commercial
  [0xff, 0xd6, 0xd1], // retail
  [0xeb, 0xdb, 0xe8], // industrial
  [0xc8, 0xfa, 0xcc], // park
  [0xcd, 0xeb, 0xb0], // grass
  [0xad, 0xd1, 0x9e], // forest
  [0xaa, 0xd3, 0xdf], // water
  [0xd9, 0xd0, 0xc9], // building
  [0xee, 0xf0, 0xd5], // farmland
  [0xff, 0xff, 0xe5], // school / hospital
  [0xee, 0xee, 0xee], // parking
  [0xde, 0xf6, 0xc0], // meadow / pitch
  [0xe9, 0xd1, 0xff], // aerodrome
  [0xdf, 0xfc, 0xe2], // recreation
  [0xaa, 0xe0, 0xcb], // golf / cemetery
];

/** Max per-channel difference to count as an area fill. */
export const AREA_FILL_TOLERANCE = 10;

export type OverlayStyle = "hybrid" | "dark";

export function isAreaFill(r: number, g: number, b: number, tol = AREA_FILL_TOLERANCE): boolean {
  for (const [fr, fg, fb] of OSM_AREA_FILLS) {
    if (Math.abs(r - fr) <= tol && Math.abs(g - fg) <= tol && Math.abs(b - fb) <= tol) return true;
  }
  return false;
}

/** Invert HSL lightness, keeping hue and saturation. */
export function invertLightness(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  // L' = 1 - L  ⇔  shift every channel by (255 - mx - mn)
  const d = 255 - mx - mn;
  return [r + d, g + d, b + d];
}

/** Process an RGBA tile in place. Returns the number of pixels keyed out. */
export function processOverlayPixels(rgba: Uint8ClampedArray, style: OverlayStyle): number {
  let keyed = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (isAreaFill(r, g, b)) {
      rgba[i + 3] = 0;
      keyed++;
      continue;
    }
    if (style === "dark") {
      const [nr, ng, nb] = invertLightness(r, g, b);
      rgba[i] = nr; rgba[i + 1] = ng; rgba[i + 2] = nb;
    }
  }
  return keyed;
}

/** Opacity of the overlay layer per style. */
export const OVERLAY_ALPHA: Record<OverlayStyle, number> = { hybrid: 0.75, dark: 0.85 };

/** Wrap a Cesium imagery provider so each tile is processed for the overlay style. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withOverlayFilter<P extends { requestImage?: (...a: any[]) => any }>(provider: P, style: OverlayStyle): P {
  if (typeof provider.requestImage !== "function" || typeof document === "undefined") return provider;
  const original = provider.requestImage.bind(provider);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider.requestImage = (...args: any[]) => {
    const pending = original(...args);
    if (!pending || typeof pending.then !== "function") return pending;
    return pending.then((img: CanvasImageSource & { width: number; height: number }) => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return img;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        processOverlayPixels(data.data, style);
        ctx.putImageData(data, 0, 0);
        return toTileImage(c, img);
      } catch {
        return img;
      }
    });
  };
  return provider;
}
