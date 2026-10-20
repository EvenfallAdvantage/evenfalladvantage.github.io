"use client";

/**
 * Supervisor SOS alerting on every page (owner/admin/manager).
 * - Realtime on panic_alerts (when published) plus a 15 s poll that keeps
 *   running in background tabs, so a hidden tab still alarms on return.
 * - New active alert: sound + vibration + fixed top banner with live trail.
 * - Unacknowledged after 60 s: escalate once (first supervisor wins) to owners/admins.
 */
import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Check, MapPin, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useActiveCompany } from "@/stores/auth-store";
import { playSosAlarm } from "@/lib/sos/alarm";
import { shouldEscalate } from "@/lib/sos/sos-machine";
import type { PanicAlert, PanicTrailPoint } from "@/lib/supabase/db-panic";

const SUPERVISOR_ROLES = ["owner", "admin", "manager"];

export function GlobalPanicListener() {
  const company = useActiveCompany();
  const companyId = company?.companyId ?? null;
  const isSupervisor = SUPERVISOR_ROLES.includes(company?.role ?? "");
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const [trails, setTrails] = useState<Record<string, PanicTrailPoint[]>>({});
  const [acting, setActing] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => {
    if (!companyId || !isSupervisor) return;
    let cancelled = false;
    const load = async () => {
      const db = await import("@/lib/supabase/db-panic");
      const list = await db.getActivePanicAlerts(companyId);
      if (cancelled) return;
      setAlerts(list);
      const fresh = list.filter((a) => a.status === "active" && !seen.current.has(a.id));
      list.forEach((a) => seen.current.add(a.id));
      // Alarm for alerts that arrive while the page is open, and for any still-active alert on first load.
      if (fresh.length && (!first.current || list.some((a) => a.status === "active"))) playSosAlarm();
      first.current = false;
      const t: Record<string, PanicTrailPoint[]> = {};
      await Promise.all(list.map(async (a) => { t[a.id] = await db.getPanicTrail(a.id, 30); }));
      if (!cancelled) setTrails(t);
      const now = Date.now();
      for (const a of list) if (shouldEscalate(a, now)) void db.escalatePanicAlert(a.id, companyId);
    };
    void load();
    const timer = window.setInterval(load, 15_000);
    let unsub: (() => void) | null = null;
    import("@/lib/supabase/db-panic").then((db) => { if (!cancelled) unsub = db.subscribePanicAlerts(companyId, () => void load()); });
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; clearInterval(timer); unsub?.(); document.removeEventListener("visibilitychange", onVis); };
  }, [companyId, isSupervisor]);

  if (!isSupervisor || alerts.length === 0) return null;

  async function act(a: PanicAlert) {
    setActing(a.id);
    try {
      const db = await import("@/lib/supabase/db-panic");
      const ok = a.status === "active" ? await db.acknowledgePanicAlert(a.id) : await db.resolvePanicAlert(a.id, "resolved");
      if (!ok) throw new Error("update failed");
      toast.success(a.status === "active" ? "Acknowledged. The officer has been told help is coming." : "Alert resolved.");
      setAlerts((prev) => a.status === "active" ? prev.map((x) => x.id === a.id ? { ...x, status: "acknowledged" } : x) : prev.filter((x) => x.id !== a.id));
    } catch { toast.error("Couldn't update the alert. Try again."); }
    finally { setActing(null); }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[180] space-y-1 p-2 md:left-auto md:right-4 md:top-3 md:w-[420px]" data-testid="global-panic-banner">
      {alerts.map((a) => {
        const trail = trails[a.id] ?? [];
        const latest = trail[0] ?? (a.lat != null && a.lng != null ? { lat: a.lat, lng: a.lng, accuracy: a.accuracy, recordedAt: a.createdAt } : null);
        const active = a.status === "active";
        const ageS = Math.max(0, Math.round((Date.now() - Date.parse(a.createdAt)) / 1000));
        return (
          <div key={a.id} role="alert" aria-live="assertive"
            className={`rounded-2xl border-2 p-3 shadow-2xl backdrop-blur ${active ? "border-red-500 bg-red-950/95" : "border-amber-500 bg-amber-950/95"}`}>
            <div className="flex items-start gap-3">
              <ShieldAlert className={`mt-0.5 h-6 w-6 shrink-0 ${active ? "text-red-400 animate-pulse" : "text-amber-400"}`} />
              <div className="min-w-0 flex-1 text-white">
                <p className="text-sm font-black tracking-wide">
                  {active ? "SOS ALERT" : "SOS ACKNOWLEDGED"}{a.escalated && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px]">ESCALATED</span>}
                </p>
                <p className="truncate text-sm">{a.userName}</p>
                <p className="text-xs text-white/70">
                  {ageS < 120 ? `${ageS}s ago` : `${Math.round(ageS / 60)} min ago`}
                  {latest && <> · <MapPin className="inline h-3 w-3" /> {latest.lat.toFixed(5)}, {latest.lng.toFixed(5)}{latest.accuracy ? ` ±${Math.round(latest.accuracy)} m` : ""}</>}
                  {trail.length > 1 && <> · live trail {trail.length} pts</>}
                </p>
              </div>
              <button type="button" aria-label="Replay alarm sound" onClick={() => playSosAlarm(2)} className="rounded-lg p-2 text-white/70 hover:bg-white/10"><Volume2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => act(a)} disabled={acting === a.id}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold text-white ${active ? "bg-red-500 active:bg-red-600" : "border border-white/60"}`}>
                {acting === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{active ? "Acknowledge" : "Resolve"}
              </button>
              {latest ? (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${latest.lat},${latest.lng}`} target="_blank" rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/60 text-sm font-bold text-white">
                  <MapPin className="h-4 w-4" /> Directions
                </a>
              ) : <span className="flex h-11 items-center justify-center rounded-xl border border-white/20 text-xs text-white/60">No location yet</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
