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
/** Text core: neutral pixels darker than this (OSM label text is dark/mid grey). */
export const HYBRID_TEXT_MAX = 110;
/** Halo radius (px) around label text: 1 px when the tile level is unknown, 2 px once labels are big enough (>= HYBRID_CLOSE_LEVEL). */
export const HYBRID_HALO_RADIUS = 1;
export const HYBRID_HALO_RADIUS_CLOSE = 2;
export const HYBRID_CLOSE_LEVEL = 16;
/**
 * Below this tile level OSM text is too small to read over imagery (and a halo
 * would only show up as dark dashes along roads), so Hybrid erases the baked
 * text there; place names come from the dedicated label layer instead
 * (see place-labels.ts).
 */
export const HYBRID_MIN_LEVEL = 16;
/** Mask dilation (px) used when erasing baked text below HYBRID_MIN_LEVEL. */
export const HYBRID_ERASE_RADIUS = 1;

/** Blue OSM labels (tourism/hotel/transport text, #0092da family); excludes navy one-way arrows. */
export function isBlueText(r: number, g: number, b: number): boolean {
  return b >= 190 && r < 70 && g >= 120 && g <= 175;
}

/** Purple OSM labels (aeroway / heliport text, #8461c4 family); excludes magenta and lilac fills. */
export function isPurpleText(r: number, g: number, b: number): boolean {
  return b >= 170 && r >= 70 && r <= 150 && g < 125 && b - g >= 60 && r > g;
}

/** Brown OSM labels (amenity / POI text, #734a08 family). */
export function isBrownText(r: number, g: number, b: number): boolean {
  return r >= 95 && r <= 140 && g >= 55 && g <= 95 && b <= 40 && r - g >= 30;
}

/** Coloured label text restyled in Hybrid (blue, purple, brown). */
export function isColouredText(r: number, g: number, b: number): boolean {
  return isBlueText(r, g, b) || isPurpleText(r, g, b) || isBrownText(r, g, b);
}

/** Halo radius for a tile level, or 0 when labels should be left alone. */
export function hybridHaloRadius(level: number | undefined): number {
  if (level === undefined) return HYBRID_HALO_RADIUS;
  if (level < HYBRID_MIN_LEVEL) return 0;
  return level >= HYBRID_CLOSE_LEVEL ? HYBRID_HALO_RADIUS_CLOSE : HYBRID_HALO_RADIUS;
}
/** Inside the halo, pixels darker than this luminance are glyph (made light). */
export const HYBRID_GLYPH_LUMA = 170;
/** How far coloured glyph pixels are lifted toward white (0..1), keeping their hue. */
export const HYBRID_TINT_LIFT = 0.55;
/** Halo colour behind Hybrid labels. */
export const HYBRID_HALO: readonly [number, number, number] = [20, 20, 20];

const luma = (r: number, g: number, b: number) => (r * 3 + g * 6 + b) / 10;

/** Mask of Hybrid label pixels: grey or coloured (blue/purple/brown) text cores dilated by the halo radius. */
export function hybridLabelMask(rgba: Uint8ClampedArray, width: number, R = HYBRID_HALO_RADIUS): Uint8Array {
  const n = rgba.length / 4, h = Math.floor(n / width);
  const mask = new Uint8Array(n);
  // Coloured text: thin strokes only. Solid coloured blobs (bus-stop, parking,
  // POI icons) and pixels next to them are left alone so icons keep their colour.
  const blue = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (rgba[i + 3] !== 0 && isColouredText(rgba[i], rgba[i + 1], rgba[i + 2])) blue[p] = 1;
  }
  const nearSolid = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < width - 1; x++) {
    const p = y * width + x;
    if (!blue[p]) continue;
    let solid = true;
    for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1; dx++) if (!blue[p + dy * width + dx]) { solid = false; break; }
    if (!solid) continue;
    for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++)
      for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx++) nearSolid[yy * width + xx] = 1;
  }
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const mx = Math.max(r, g, b);
    const grey = mx < HYBRID_TEXT_MAX && mx - Math.min(r, g, b) <= HYBRID_NEUTRAL_SPREAD;
    if (!grey && !(blue[p] && !nearSolid[p])) continue;
    const x = p % width, y = (p - x) / width;
    for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++)
      for (let xx = Math.max(0, x - R); xx <= Math.min(width - 1, x + R); xx++) mask[yy * width + xx] = 1;
  }
  return mask;
}

/**
 * Process an RGBA tile in place. Returns the number of pixels keyed out.
 * Hybrid label restyling needs `width` (tile width in px); without it only
 * area fills are keyed out. `level` is the tile zoom level (see hybridHaloRadius).
 */
export function processOverlayPixels(rgba: Uint8ClampedArray, style: OverlayStyle, width?: number, level?: number): number {
  const radius = style === "hybrid" && width ? hybridHaloRadius(level) : 0;
  const erase = style === "hybrid" && !!width && level !== undefined && level < HYBRID_MIN_LEVEL;
  const mask = erase ? hybridLabelMask(rgba, width!, HYBRID_ERASE_RADIUS) : radius > 0 && width ? hybridLabelMask(rgba, width, radius) : null;
  let keyed = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    if (mask && mask[i / 4] === 1 && erase) {
      // Wide views: drop baked text and its anti-aliased edge; keep road colours under it.
      if (luma(r, g, b) < HYBRID_GLYPH_LUMA || isAreaFill(r, g, b)) { rgba[i + 3] = 0; keyed++; }
      continue;
    }
    if (mask && mask[i / 4] === 1) {
      const l = luma(r, g, b);
      if (l < HYBRID_GLYPH_LUMA) {
        if (Math.max(r, g, b) - Math.min(r, g, b) <= HYBRID_NEUTRAL_SPREAD) { const v = 255 - l; rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; }
        else { // coloured text/icon strokes: lighten but keep the hue, so POI icons stay recognisable
          rgba[i] = r + (255 - r) * HYBRID_TINT_LIFT; rgba[i + 1] = g + (255 - g) * HYBRID_TINT_LIFT; rgba[i + 2] = b + (255 - b) * HYBRID_TINT_LIFT;
        }
      }
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
        processOverlayPixels(data.data, style, c.width, typeof args[2] === "number" ? args[2] : undefined);
        ctx.putImageData(data, 0, 0);
        return toTileImage(c, img);
      } catch {
        return img;
      }
    });
  };
  return provider;
}
