"use client";

import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { getPushState, enablePush, disablePush, showLocalTestNotification, type PushState } from "@/lib/push/web-push";

const COPY: Record<PushState, string> = {
  on: "This device gets SOS, assignment and message alerts even when Overwatch is closed.",
  off: "Turn on to get SOS, assignment and message alerts on this device even when Overwatch is closed. If push doesn't reach you, urgent alerts fall back to SMS.",
  denied: "Notifications are blocked for this site. Allow them in your browser settings, then come back.",
  unsupported: "This browser doesn't support push notifications. Urgent alerts still arrive by SMS.",
  "needs-install": "On iPhone, add Overwatch to your Home Screen (Share → Add to Home Screen), open it from there, then turn on alerts.",
  "not-configured": "Phone alerts aren't set up for this site yet. Urgent alerts still arrive by SMS.",
};

export function PushSettingsCard() {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPushState().then(setState).catch(() => setState("unsupported")); }, []);

  async function toggle() {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush(companyId);
      setState(next);
      if (next === "on") toast.success("Phone alerts are on for this device.");
      else if (next === "denied") toast.error("Notifications are blocked in your browser settings.");
    } catch { toast.error("Couldn't change phone alerts. Try again."); }
    finally { setBusy(false); }
  }

  if (!state) return null;
  const canToggle = state === "on" || state === "off";
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4" data-testid="push-settings-card">
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${state === "on" ? "bg-green-500/15 text-green-500" : "bg-primary/10 text-primary"}`}>
          {state === "on" ? <BellRing className="h-5 w-5" /> : state === "needs-install" ? <Smartphone className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Phone alerts {state === "on" && <span className="ml-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[11px] text-green-500">ON</span>}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{COPY[state]}</p>
        </div>
      </div>
      {canToggle && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={toggle} disabled={busy} data-testid="push-toggle"
            className={`flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-bold ${state === "on" ? "border border-border" : "bg-primary text-primary-foreground"}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{state === "on" ? "Turn off on this device" : "Turn on phone alerts"}
          </button>
          {state === "on" && (
            <button type="button" onClick={() => showLocalTestNotification().catch(() => toast.error("Test failed"))} className="h-12 rounded-xl border border-border text-sm font-semibold">
              Show a test alert
            </button>
          )}
        </div>
      )}
    </div>
  );
}
