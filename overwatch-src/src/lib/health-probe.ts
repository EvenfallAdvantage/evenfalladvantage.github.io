/** Always-present static file under the app's base path, cache-busted. */
export function staticProbeUrl(now = Date.now()): string {
  return `/overwatch/manifest.json?probe=${now}`;
}
