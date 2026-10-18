/** Aircraft layer filter (panel v2) and GPS-interference aggregation. */

export type AircraftFilter = "all" | "military" | "emergency";
export const AIRCRAFT_FILTER_LABELS: Record<AircraftFilter, string> = { all: "All", military: "Military", emergency: "Emergency" };

export function matchesAircraftFilter(p: { military?: boolean; emergency?: boolean }, f: AircraftFilter): boolean {
  if (f === "military") return !!p.military;
  if (f === "emergency") return !!p.emergency;
  return true;
}

/** NACp below 8 means the 95% position bound is worse than 92.6 m (0.05 nm). */
export const GNSS_DEGRADED_NACP = 8;
export const GNSS_MIN_AIRCRAFT = 4;
export const GNSS_MIN_RATIO = 0.3;

export interface GnssCell {
  lat0: number;
  lng0: number;
  sizeDeg: number;
  total: number;
  degraded: number;
  ratio: number;
}

/**
 * Grid aircraft that report NACp into cells and flag cells where a large
 * share report degraded accuracy. A flagged cell is an anomaly worth a look,
 * not confirmation of jamming (old transponders also report low NACp).
 */
export function aggregateGnss(
  planes: ReadonlyArray<{ lat: number; lng: number; nacp?: number | null; onGround?: boolean }>,
  sizeDeg = 0.5,
): GnssCell[] {
  const cells = new Map<string, GnssCell>();
  for (const p of planes) {
    if (p.onGround || typeof p.nacp !== "number" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
    const lat0 = Math.floor(p.lat / sizeDeg) * sizeDeg;
    const lng0 = Math.floor(p.lng / sizeDeg) * sizeDeg;
    const k = `${lat0}:${lng0}`;
    const c = cells.get(k) ?? { lat0, lng0, sizeDeg, total: 0, degraded: 0, ratio: 0 };
    c.total++;
    if (p.nacp < GNSS_DEGRADED_NACP) c.degraded++;
    cells.set(k, c);
  }
  const out: GnssCell[] = [];
  for (const c of cells.values()) {
    c.ratio = c.degraded / c.total;
    if (c.total >= GNSS_MIN_AIRCRAFT && c.ratio >= GNSS_MIN_RATIO) out.push(c);
  }
  return out;
}
