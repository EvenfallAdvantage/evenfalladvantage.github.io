/**
 * Device profile + point budgets for the Operations (Cesium) map.
 *
 * "Constrained" = phone-sized viewport or coarse pointer without a fine one,
 * or a low-memory device. Desktop behavior is unchanged except for generous
 * caps that only bite on extreme payloads.
 */

export interface DeviceSignals {
  width: number;
  coarsePointer: boolean;
  finePointer: boolean;
  deviceMemoryGb?: number;
}

export function readDeviceSignals(): DeviceSignals | null {
  if (typeof window === "undefined") return null;
  const mm = (q: string) => (typeof window.matchMedia === "function" ? window.matchMedia(q).matches : false);
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    width: window.innerWidth,
    coarsePointer: mm("(pointer: coarse)"),
    finePointer: mm("(any-pointer: fine)"),
    deviceMemoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined,
  };
}

export function isConstrained(s: DeviceSignals | null): boolean {
  if (!s) return false;
  if (s.width > 0 && s.width < 768) return true;
  if (s.coarsePointer && !s.finePointer && s.width < 1100) return true; // tablets
  if (s.deviceMemoryGb !== undefined && s.deviceMemoryGb <= 2) return true;
  return false;
}

let cached: boolean | null = null;
/** Memoized per page load; tests can pass signals to isConstrained directly. */
export function isConstrainedDevice(): boolean {
  if (cached === null) cached = isConstrained(readDeviceSignals());
  return cached;
}

export type PointLayer = "fires" | "lightning" | "frequencies" | "earthquakes" | "gdelt";

const BUDGETS: Record<PointLayer, { desktop: number; mobile: number }> = {
  fires: { desktop: 1500, mobile: 300 },
  lightning: { desktop: 800, mobile: 200 },
  frequencies: { desktop: 800, mobile: 200 },
  earthquakes: { desktop: 500, mobile: 200 },
  gdelt: { desktop: 300, mobile: 100 },
};

export function pointBudget(layer: PointLayer, constrained: boolean = isConstrainedDevice()): number {
  const b = BUDGETS[layer];
  return constrained ? b.mobile : b.desktop;
}

/**
 * Keep the `n` highest-scoring items (stable for ties, original order kept
 * among kept items so ids stay deterministic). Returns input if under budget.
 */
export function topN<T>(items: readonly T[], n: number, score: (t: T) => number): T[] {
  if (items.length <= n) return items.slice();
  const ranked = items.map((t, i) => ({ t, i, s: score(t) }));
  ranked.sort((a, b) => (b.s - a.s) || (a.i - b.i));
  const keep = new Set(ranked.slice(0, Math.max(0, n)).map((r) => r.i));
  return items.filter((_, i) => keep.has(i));
}

/** Run a batch of Cesium entity mutations with change events suspended. */
export function withSuspendedEvents<R>(entities: { suspendEvents?: () => void; resumeEvents?: () => void } | null | undefined, fn: () => R): R {
  entities?.suspendEvents?.();
  try { return fn(); } finally { entities?.resumeEvents?.(); }
}
