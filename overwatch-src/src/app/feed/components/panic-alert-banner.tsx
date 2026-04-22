"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Check, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getActivePanicAlerts, acknowledgePanicAlert, resolvePanicAlert, type PanicAlert } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface PanicAlertBannerProps {
  activeCompanyId: string;
}

export function PanicAlertBanner({ activeCompanyId }: PanicAlertBannerProps) {
  const [alerts, setAlerts] = useState<PanicAlert[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    const load = () => {
      getActivePanicAlerts(activeCompanyId)
        .then((a) => { if (!cancelled) setAlerts(a); })
        .catch((e) => { logger.swallow("panic-banner:load", e, "warn"); });
    };
    load();
    // Poll every 15 seconds for active alerts
    const interval = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [activeCompanyId]);

  if (alerts.length === 0) return null;

  async function handleAcknowledge(alertId: string) {
    setActing(alertId);
    try {
      const ok = await acknowledgePanicAlert(alertId);
      if (ok) {
        toast.success("Alert acknowledged. Responding.");
        setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: "acknowledged" as const } : a));
      }
    } catch { toast.error("Failed to acknowledge alert."); }
    finally { setActing(null); }
  }

  async function handleResolve(alertId: string) {
    setActing(alertId);
    try {
      const ok = await resolvePanicAlert(alertId, "resolved");
      if (ok) {
        toast.success("Alert resolved.");
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }
    } catch { toast.error("Failed to resolve alert."); }
    finally { setActing(null); }
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-xl border-2 p-4 flex items-center gap-4 flex-wrap animate-pulse ${
            alert.status === "active"
              ? "border-red-500 bg-red-500/10"
              : "border-amber-500 bg-amber-500/10 animate-none"
          }`}
          role="alert"
          aria-live="assertive"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
            alert.status === "active" ? "bg-red-500/20" : "bg-amber-500/20"
          }`}>
            <ShieldAlert className={`h-5 w-5 ${alert.status === "active" ? "text-red-500" : "text-amber-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${alert.status === "active" ? "text-red-500" : "text-amber-600"}`}>
              {alert.status === "active" ? "SOS ALERT" : "ALERT ACKNOWLEDGED"}
            </p>
            <p className="text-xs text-muted-foreground">
              {alert.userName} triggered an emergency alert
              {alert.lat && alert.lng && (
                <span className="inline-flex items-center gap-0.5 ml-1">
                  <MapPin className="h-2.5 w-2.5" />
                  {alert.lat.toFixed(4)}, {alert.lng.toFixed(4)}
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {new Date(alert.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {alert.status === "active" && (
              <Button size="sm" className="gap-1.5 bg-red-500 hover:bg-red-600 text-white"
                onClick={() => handleAcknowledge(alert.id)} disabled={acting === alert.id}>
                {acting === alert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Acknowledge
              </Button>
            )}
            {alert.status === "acknowledged" && (
              <Button size="sm" variant="outline" className="gap-1.5"
                onClick={() => handleResolve(alert.id)} disabled={acting === alert.id}>
                {acting === alert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Resolve
              </Button>
            )}
            {alert.lat && alert.lng && (
              <a
                href={`https://maps.google.com/?q=${alert.lat},${alert.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                <MapPin className="h-3 w-3" /> Map
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
