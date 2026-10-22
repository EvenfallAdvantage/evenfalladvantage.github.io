/** Client for the public `get_uptime_summary` RPC (migration 20261022010000_uptime_checks). */
export interface UptimeDay { day: string; pct: number | null; checks: number }
export interface UptimeSummary {
  target: number;
  uptime7d: number | null;
  uptime30d: number | null;
  uptime90d: number | null;
  checks30d: number;
  lastCheck: string | null;
  daily: UptimeDay[];
}
export type UptimeLevel = "green" | "amber" | "red" | "none";

/** Need ~1 day of 5-minute checks before a 30-day figure is worth showing. */
export const MIN_CHECKS = 288;

const num = (v: unknown): number | null => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export function toUptime(json: unknown): UptimeSummary | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const daily = Array.isArray(j.daily)
    ? (j.daily as Record<string, unknown>[]).map((d) => ({ day: String(d.day ?? ""), pct: num(d.pct), checks: Number(d.checks ?? 0) || 0 }))
    : [];
  return {
    target: num(j.target) ?? 99.5,
    uptime7d: num(j.uptime_7d),
    uptime30d: num(j.uptime_30d),
    uptime90d: num(j.uptime_90d),
    checks30d: Number(j.checks_30d ?? 0) || 0,
    lastCheck: typeof j.last_check === "string" ? j.last_check : null,
    daily,
  };
}

/** Green at/above target, amber within 0.5 pt below, red further below; none if too little data. */
export function uptimeLevel(pct: number | null, target = 99.5, checks = MIN_CHECKS): UptimeLevel {
  if (pct === null || checks < MIN_CHECKS) return "none";
  if (pct >= target) return "green";
  if (pct >= target - 0.5) return "amber";
  return "red";
}

/**
 * Checks behind a 7/30/90-day figure. 30 days uses the server count; 7 and 90
 * days sum the most recent N entries of `daily` (oldest first), so each card
 * gets the same "too little data -> grey" rule as the 30-day card.
 */
export function windowChecks(u: Pick<UptimeSummary, "daily" | "checks30d">, days: 7 | 30 | 90): number {
  if (days === 30) return u.checks30d;
  return u.daily.slice(-days).reduce((n, d) => n + (d.checks || 0), 0);
}

export function dayLevel(d: UptimeDay, target = 99.5): UptimeLevel {
  if (d.pct === null || d.checks === 0) return "none";
  return uptimeLevel(d.pct, target, MIN_CHECKS);
}

/** "99.98%" — two decimals, never rounds up to 100 unless it is 100. */
export function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  if (pct >= 100) return "100%";
  return `${(Math.floor(pct * 100) / 100).toFixed(2)}%`;
}

export async function fetchUptime(signal?: AbortSignal): Promise<UptimeSummary | null> {
  try {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    if (!base) return null;
    const res = await fetch(`${base}/rest/v1/rpc/get_uptime_summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}) },
      body: "{}",
      cache: "no-store",
      signal,
    });
    if (!res.ok) return null;
    return toUptime(await res.json());
  } catch {
    return null;
  }
}
