/**
 * Google Photorealistic 3D Tiles ("3D Cities") via the Map Tiles API, called
 * directly (not through Cesium ion).
 *
 * The key is a public, browser-side key by design. It must be restricted in
 * Google Cloud to HTTP referrer https://www.evenfalladvantage.com/* and to the
 * Map Tiles API only, with a daily quota. When the env var is empty the option
 * is hidden everywhere.
 *
 * Terms we follow (Map Tiles API policies + Google Maps Platform ToS):
 *  - Google logo + aggregated data attributions always visible
 *    (showCreditsOnScreen, plus a "Google Maps" label in the footer).
 *  - No pre-fetching, caching or offline use. The service worker only handles
 *    same-origin requests, so tile.googleapis.com is never stored by us; the
 *    browser's normal HTTP cache honours Google's Cache-Control headers.
 *  - Sessions: one root.json request per page load; the tileset object is
 *    kept (hidden) when the user switches away so the session is reused.
 *  - No visual post-processing over Google imagery (see applyGoogle3dRules).
 */

export const GOOGLE_MAP_TILES_KEY: string = process.env.NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY ?? "";
export const GOOGLE_3D_AVAILABLE = GOOGLE_MAP_TILES_KEY.trim().length > 0;

export const GOOGLE_3D_ROOT = "https://tile.googleapis.com/v1/3dtiles/root.json";

/** Screen-space error: higher = fewer, coarser tiles (cheaper on phones). */
export function google3dScreenSpaceError(constrained: boolean): number {
  return constrained ? 24 : 16;
}

export type Google3dStatus = "off" | "loading" | "on" | "failed";

export interface TileFailure { at: number; status?: number; message?: string }

/** HTTP status from a Cesium tileFailed message (best effort). */
export function failureStatus(message: string | undefined): number | undefined {
  const m = /\b(4\d\d|5\d\d)\b/.exec(message ?? "");
  return m ? Number(m[1]) : undefined;
}

/**
 * Give up on Google tiles (fall back to normal imagery) on an auth/quota error
 * (400 bad/expired session, 403 key/referrer/API not enabled, 429 quota), or
 * on 8+ failures within 30 s.
 */
export function shouldFallBack(failures: readonly TileFailure[], now: number): boolean {
  if (failures.some((f) => f.status === 400 || f.status === 401 || f.status === 403 || f.status === 429)) return true;
  return failures.filter((f) => now - f.at <= 30_000).length >= 8;
}

/** A root session lasts at least 3 h; a 400 after ~2.5 h means "start one new session", not "broken". */
export const GOOGLE_3D_SESSION_RENEW_MS = 150 * 60_000;
export function isExpiredSession(status: number | undefined, sessionStartedAt: number, now: number): boolean {
  return status === 400 && now - sessionStartedAt >= GOOGLE_3D_SESSION_RENEW_MS;
}

export const GOOGLE_3D_FALLBACK_MESSAGE = "3D Cities isn't available right now (Google quota or key). Showing standard imagery.";
