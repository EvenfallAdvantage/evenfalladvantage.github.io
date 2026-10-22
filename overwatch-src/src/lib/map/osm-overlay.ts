/**
 * Free OSM streets/labels overlay for the satellite basemap (Hybrid) and the
 * Dark look. Uses the standard OSM tiles already used for "Streets" (no key,
 * no paid provider). Each tile is post-processed on a canvas:
 *  - common OSM area fills (land, residential, parks, water, buildings...) are
 *    made transparent, so only roads, borders and text sit over the imagery;
 *  - for Dark, lightness is inverted (hue kept), so labels become light text
 *    on a dark halo and stay legible over the dimmed imagery;
 *  - for Hybrid, only the labels are restyled: dark label text becomes light
 *    text on a tight dark halo (like Dark mode), so it reads over satellite
 *    imagery, while roads and borders keep their normal OSM colours.
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

/** Max channel spread (max - min) for a pixel to count as neutral grey. */
export const HYBRID_NEUTRAL_SPREAD = 24;
/** Text core: neutral pixels darker than this (OSM label text is dark grey). */
export const HYBRID_TEXT_MAX = 80;
/** Halo radius (px) around label text. */
export const HYBRID_HALO_RADIUS = 2;
/** Inside the halo, pixels darker than this luminance are glyph (made light). */
export const HYBRID_GLYPH_LUMA = 170;
/** Halo colour behind Hybrid labels. */
export const HYBRID_HALO: readonly [number, number, number] = [20, 20, 20];

const luma = (r: number, g: number, b: number) => (r * 3 + g * 6 + b) / 10;

/** Mask of Hybrid label pixels: dark neutral text cores dilated by the halo radius. */
export function hybridLabelMask(rgba: Uint8ClampedArray, width: number): Uint8Array {
  const n = rgba.length / 4, h = Math.floor(n / width), R = HYBRID_HALO_RADIUS;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const mx = Math.max(r, g, b);
    if (mx >= HYBRID_TEXT_MAX || mx - Math.min(r, g, b) > HYBRID_NEUTRAL_SPREAD) continue;
    const x = p % width, y = (p - x) / width;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++)
      for (let xx = Math.max(0, x - R); xx <= Math.min(width - 1, x + R); xx++) mask[yy * width + xx] = 1;
  }
  return mask;
}

/**
 * Process an RGBA tile in place. Returns the number of pixels keyed out.
 * Hybrid label restyling needs `width` (tile width in px); without it only
 * area fills are keyed out.
 */
export function processOverlayPixels(rgba: Uint8ClampedArray, style: OverlayStyle, width?: number): number {
  const mask = style === "hybrid" && width ? hybridLabelMask(rgba, width) : null;
  let keyed = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (mask && mask[i / 4]) {
      const l = luma(r, g, b);
      if (l < HYBRID_GLYPH_LUMA) { const v = 255 - l; rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; }
      else { rgba[i] = HYBRID_HALO[0]; rgba[i + 1] = HYBRID_HALO[1]; rgba[i + 2] = HYBRID_HALO[2]; }
      continue;
    }
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
export const OVERLAY_ALPHA: Record<OverlayStyle, number> = { hybrid: 0.9, dark: 0.85 };

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
        processOverlayPixels(data.data, style, c.width);
        ctx.putImageData(data, 0, 0);
        return toTileImage(c, img);
      } catch {
        return img;
      }
    });
  };
  return provider;
}
