"use client";

/**
 * Hold-to-send SOS. Hold 1.5 s → 5 s cancellable countdown → alert is sent →
 * live location is shared every 10 s until the alert is closed (max 30 min).
 * A single tap never sends.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldAlert, Loader2, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SOS_INITIAL, isEarlyRelease, sosReducer, sosProgress, shouldSendLocation, SOS_COUNTDOWN_MS, SOS_LOCATION_INTERVAL_MS } from "@/lib/sos/sos-machine";
import { haptic } from "@/lib/sos/alarm";

export function SosButton({ companyId, className }: { companyId: string; className?: string }) {
  const [state, send] = useReducer(sosReducer, SOS_INITIAL);
  const [now, setNow] = useState(() => Date.now());
  const [sharing, setSharing] = useState<{ points: number; last: number | null } | null>(null);
  const firedRef = useRef(false);

  // Animation / timer tick while holding or counting down.
  useEffect(() => {
    if (state.phase !== "holding" && state.phase !== "countdown") return;
    let raf = 0;
    const loop = () => { const t = Date.now(); setNow(t); send({ type: "TICK", at: t }); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.phase]);

  useEffect(() => { if (state.phase === "countdown") haptic(80); }, [state.phase]);

  // Fire once when the machine reaches "sending".
  useEffect(() => {
    if (state.phase !== "sending" || firedRef.current) return;
    firedRef.current = true;
    (async () => {
      try {
        const { triggerPanicAlertDetailed } = await import("@/lib/supabase/db-panic");
        const { id, queued } = await triggerPanicAlertDetailed(companyId);
        if (id && queued) {
          send({ type: "SENT", alertId: id }); haptic(300);
          toast.error("NO SIGNAL: SOS saved and will send the moment you reconnect. Call 911 if you can.", {
            duration: 30000, action: { label: "Call 911", onClick: () => { window.location.href = "tel:911"; } },
          });
        } else if (id) { send({ type: "SENT", alertId: id }); haptic(300); toast.success("SOS sent. Supervisors are being alerted.", { duration: 8000 }); }
        else { send({ type: "SEND_FAILED" }); toast.error("SOS failed to send. Call your supervisor or 911."); }
      } catch {
        send({ type: "SEND_FAILED" }); toast.error("SOS failed to send. Call your supervisor or 911.");
      } finally { firedRef.current = false; }
    })();
  }, [state.phase, companyId]);

  // Live location + status watch while active.
  const alertId = state.phase === "active" ? state.alertId : null;
  useEffect(() => {
    if (!alertId) return;
    const startedAt = Date.now();
    let last: number | null = null;
    let points = 0;
    let watchId: number | null = null;
    let stopped = false;
    setSharing({ points: 0, last: null });
    const mod = import("@/lib/supabase/db-panic");
    // Latest fix from the watch. It is (re)sent every SOS_LOCATION_INTERVAL_MS
    // even when the officer stands still: watchPosition only fires on a new
    // position, so a fix dropped by the 10 s gate would otherwise never go out.
    let latest: { lat: number; lng: number; accuracy: number | null } | null = null;
    let sending = false;
    const trySend = async () => {
      const t = Date.now();
      // 250 ms slack: the 10 s timer can tick a hair early and would skip a whole cycle.
      if (stopped || sending || !latest || !shouldSendLocation(last, t + 250, startedAt)) return;
      sending = true; last = t;
      try {
        const { recordPanicLocation } = await mod;
        if (!stopped && await recordPanicLocation(alertId, companyId, latest)) { points += 1; setSharing({ points, last: t }); }
      } finally { sending = false; }
    };
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        latest = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        void trySend();
      }, () => { /* keep alert active without location */ }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    }
    const resendTimer = window.setInterval(() => { void trySend(); }, SOS_LOCATION_INTERVAL_MS);
    const statusTimer = window.setInterval(async () => {
      const { getPanicAlertStatus } = await mod;
      const st = await getPanicAlertStatus(alertId);
      if (st === "acknowledged") toast.success("A supervisor acknowledged your SOS.", { id: `sos-ack-${alertId}` });
      if (st === "resolved" || st === "false_alarm") { send({ type: "SAFE" }); }
    }, 10_000);
    return () => { stopped = true; if (watchId != null) navigator.geolocation.clearWatch(watchId); clearInterval(statusTimer); clearInterval(resendTimer); setSharing(null); };
  }, [alertId, companyId]);

  const onDown = useCallback((e: React.PointerEvent) => { e.preventDefault(); haptic(20); send({ type: "HOLD_START", at: Date.now() }); }, []);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });
  const onUp = useCallback(() => {
    const at = Date.now();
    if (isEarlyRelease(stateRef.current, at)) toast("Press and hold SOS to send an alert.", { id: "sos-hold-hint", duration: 3500 });
    send({ type: "HOLD_END", at });
  }, []);

  async function imSafe() {
    if (!state.alertId) return;
    const { cancelOwnPanicAlert } = await import("@/lib/supabase/db-panic");
    const ok = await cancelOwnPanicAlert(state.alertId);
    if (ok) { send({ type: "SAFE" }); toast.success("Marked safe. Supervisors were updated."); }
    else toast.error("Couldn't cancel. Tell your supervisor you're safe.");
  }

  const p = sosProgress(state, now);
  const secondsLeft = state.phase === "countdown" && state.startedAt ? Math.max(0, Math.ceil((SOS_COUNTDOWN_MS - (now - state.startedAt)) / 1000)) : 0;

  return (
    <>
      <button
        type="button"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !e.repeat) send({ type: "HOLD_START", at: Date.now() }); }}
        onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") onUp(); }}
        data-testid="sos-button"
        aria-label="Emergency SOS. Press and hold to send."
        className={cn("relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1 text-[10px] font-bold rounded-lg text-red-500 select-none touch-none", state.phase === "active" && "bg-red-600 text-white animate-pulse", className)}
      >
        <span className="relative h-6 w-6">
          <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth="3" />
            {state.phase === "holding" && (
              <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${p * 100.5} 100.5`} />
            )}
          </svg>
          {state.phase === "sending" ? <Loader2 className="absolute inset-1 h-4 w-4 animate-spin" /> : <ShieldAlert className="absolute inset-1 h-4 w-4" />}
        </span>
        <span className="leading-none">{state.phase === "holding" ? "HOLD" : "SOS"}</span>
      </button>

      {/* Portal: the bottom nav uses backdrop-blur, which would trap position:fixed children. */}
      {typeof document !== "undefined" && createPortal(<>
      {(state.phase === "countdown" || state.phase === "sending") && (
        <div role="alertdialog" aria-live="assertive" aria-label="SOS countdown" data-testid="sos-countdown"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-red-950/90 p-6 pb-10 backdrop-blur-sm">
          <ShieldAlert className="mb-4 h-14 w-14 text-red-400" />
          <p className="text-center text-2xl font-black tracking-wide text-white">
            {state.phase === "sending" ? "SENDING SOS…" : `SENDING SOS IN ${secondsLeft}`}
          </p>
          <p className="mt-2 text-center text-sm text-red-100/80">Supervisors get an alert with your live location.</p>
          <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-red-900">
            <div className="h-full bg-red-400" style={{ width: `${(state.phase === "sending" ? 1 : p) * 100}%` }} />
          </div>
          <div className="mt-8 grid w-full max-w-sm gap-3">
            <button type="button" onClick={() => send({ type: "SEND_NOW", at: Date.now() })} disabled={state.phase === "sending"}
              className="h-14 rounded-2xl bg-red-500 text-lg font-bold text-white active:bg-red-600 disabled:opacity-60">Send now</button>
            <button type="button" onClick={() => send({ type: "CANCEL" })} disabled={state.phase === "sending"} data-testid="sos-cancel"
              className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-white/80 bg-white/10 text-xl font-bold text-white active:bg-white/20 disabled:opacity-60">
              <X className="h-6 w-6" /> Cancel
            </button>
          </div>
        </div>
      )}

      {state.phase === "active" && (
        <div role="status" data-testid="sos-active" className="fixed inset-x-2 bottom-20 z-[150] rounded-2xl border-2 border-red-500 bg-red-950/95 p-4 text-white shadow-2xl md:bottom-4 md:left-auto md:right-4 md:w-96">
          <p className="flex items-center gap-2 font-black"><ShieldAlert className="h-5 w-5 text-red-400" /> SOS ACTIVE</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-red-100/80">
            <MapPin className="h-3 w-3" />
            {sharing?.points ? `Sharing live location · ${sharing.points} update${sharing.points === 1 ? "" : "s"}` : "Getting your location…"}
          </p>
          <button type="button" onClick={imSafe} className="mt-3 h-12 w-full rounded-xl border border-white/70 font-bold active:bg-white/10">I&apos;m safe, cancel SOS</button>
        </div>
      )}
      </>, document.body)}
    </>
  );
}
