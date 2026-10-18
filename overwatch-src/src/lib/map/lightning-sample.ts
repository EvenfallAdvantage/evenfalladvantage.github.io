/**
 * Lightning near a site: request a tiny nowCOAST lightning-density image
 * covering the site's radius and look for any non-transparent pixel inside
 * the circle. One small PNG per site; nowCOAST sends CORS "*".
 */
import { NOWCOAST_LIGHTNING_LAYER, NOWCOAST_LIGHTNING_STYLE, NOWCOAST_LIGHTNING_WMS } from "./basemap-sources";

export const LIGHTNING_SAMPLE_PX = 24;

export function lightningSampleUrl(lat: number, lng: number, km: number, px = LIGHTNING_SAMPLE_PX): string {
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const p = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetMap", layers: NOWCOAST_LIGHTNING_LAYER, styles: NOWCOAST_LIGHTNING_STYLE,
    crs: "EPSG:4326", bbox: [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((n) => n.toFixed(4)).join(","),
    width: String(px), height: String(px), format: "image/png", transparent: "true",
  });
  return `${NOWCOAST_LIGHTNING_WMS}?${p.toString()}`;
}

/** True if any pixel inside the inscribed circle has alpha above the threshold. */
export function anyStrikeInCircle(rgba: Uint8ClampedArray, px: number, alphaMin = 40): boolean {
  const c = (px - 1) / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > c * c) continue;
      if (rgba[(y * px + x) * 4 + 3] > alphaMin) return true;
    }
  }
  return false;
}

export async function lightningNear(lat: number, lng: number, km: number): Promise<boolean> {
  const px = LIGHTNING_SAMPLE_PX;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = lightningSampleUrl(lat, lng, km, px);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, px, px);
  return anyStrikeInCircle(ctx.getImageData(0, 0, px, px).data, px);
}
