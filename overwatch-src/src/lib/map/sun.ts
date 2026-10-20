/**
 * Solar elevation (NOAA approximation, ~0.1° accuracy) for deciding where the
 * ground is actually in darkness. Pure; used by the city-lights layer.
 */
const rad = Math.PI / 180;

/** Sun elevation above the horizon in degrees at a place and time. */
export function sunElevationDeg(ms: number, latDeg: number, lonDeg: number): number {
  const jd = ms / 86_400_000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = ((gmst * 15 + lonDeg) % 360) * rad;
  const ha = lst - ra;
  const lat = latDeg * rad;
  const s = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, s))) / rad;
}

/**
 * City-lights opacity from sun elevation: none in daylight, fading in
 * through civil twilight (0° to -6°), full when it's dark.
 */
export function cityLightsAlpha(sunElevDeg: number): number {
  const t = Math.max(0, Math.min(1, -sunElevDeg / 6));
  return t * t * (3 - 2 * t);
}

/**
 * City-lights opacity for a view: the darkest-lit (i.e. minimum) alpha over
 * the view centre and four points around it, spread by camera height
 * (~0.6° per 111 km of height, up to 70°), so a view that crosses the
 * terminator shows no lights on its day side.
 */
export function viewDarkness(ms: number, lat: number, lon: number, cameraHeightM: number): number {
  let a = cityLightsAlpha(sunElevationDeg(ms, lat, lon));
  const r = Math.min(70, (cameraHeightM / 111_000) * 0.6);
  if (r < 0.05 || a === 0) return a;
  for (const [dl, dn] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
    const la = Math.max(-89.9, Math.min(89.9, lat + dl));
    a = Math.min(a, cityLightsAlpha(sunElevationDeg(ms, la, lon + dn / Math.max(0.2, Math.cos(la * Math.PI / 180)))));
    if (a === 0) break;
  }
  return a;
}
