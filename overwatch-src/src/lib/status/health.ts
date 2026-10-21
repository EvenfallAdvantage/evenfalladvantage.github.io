/** Client for the public `health` Edge Function (supabase/functions/health). */
export type ComponentKey = "website" | "database" | "auth" | "storage";
export interface ComponentStatus { key: ComponentKey; label: string; ok: boolean | null; ms: number | null }
export interface HealthSnapshot { status: "ok" | "degraded" | "down" | "unknown"; components: ComponentStatus[]; checkedAt: string }

const LABELS: Record<ComponentKey, string> = { website: "Website & app", database: "Database", auth: "Sign-in", storage: "File storage" };

export function healthUrl(base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""): string {
  return `${base.replace(/\/+$/, "")}/functions/v1/health`;
}

/** Turn the function's JSON (or a failed fetch) into rows for the status page. */
export function toSnapshot(json: unknown, now = new Date()): HealthSnapshot {
  const j = (json ?? {}) as { status?: string; checks?: Record<string, { ok?: boolean; ms?: number }>; checked_at?: string };
  const row = (key: ComponentKey): ComponentStatus => {
    if (key === "website") return { key, label: LABELS[key], ok: true, ms: null };
    const c = j.checks?.[key];
    return { key, label: LABELS[key], ok: c ? !!c.ok : null, ms: typeof c?.ms === "number" ? c.ms : null };
  };
  const status = j.status === "ok" || j.status === "degraded" || j.status === "down" ? j.status : "unknown";
  return { status, components: (["website", "database", "auth", "storage"] as ComponentKey[]).map(row), checkedAt: j.checked_at ?? now.toISOString() };
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthSnapshot> {
  try {
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const res = await fetch(healthUrl(), { headers: anon ? { apikey: anon } : {}, cache: "no-store", signal });
    return toSnapshot(await res.json().catch(() => null));
  } catch {
    return toSnapshot(null);
  }
}
