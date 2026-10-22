"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { QrCode, Nfc, Loader2, CheckCircle2, AlertTriangle, MapPin, X, Printer, Circle, ShieldCheck, ShieldAlert } from "lucide-react";
import { logPatrolScanOffline, isPendingSync } from "@/lib/offline/with-offline";
import { parseCheckpointPayload, verifyScanPosition, tourProgress, checkpointUrl, type ScanMethod } from "@/lib/patrol/checkpoint-code";
import { nfcSupported, readNfcOnce } from "@/lib/patrol/nfc";

const QrScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
type Fix = { lat: number; lng: number; accuracy: number };

function getFix(timeout = 6000): Promise<Fix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), timeout + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      () => { clearTimeout(t); res(null); }, { enableHighAccuracy: true, timeout, maximumAge: 15000 });
  });
}

const STATUS = [
  { v: "ok", label: "All clear", cls: "bg-emerald-600", Icon: CheckCircle2 },
  { v: "issue", label: "Issue", cls: "bg-amber-500", Icon: AlertTriangle },
  { v: "emergency", label: "Emergency", cls: "bg-red-600", Icon: AlertTriangle },
];

/**
 * Tag-first patrol scanning: QR (camera), NFC (Android Chrome) or a deep link
 * from the phone's own camera app. The tag identifies the checkpoint, the GPS
 * fix is compared with the checkpoint's pinned position, and the method is
 * recorded so supervisors can tell tag scans from manual picks.
 */
export function TagScanPanel({ companyId, checkpoints, routes, logs, onLogged }: {
  companyId: string; checkpoints: Any[]; routes: Any[]; logs: Any[]; onLogged: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [nfcOn, setNfcOn] = useState(false);
  const [pending, setPending] = useState<{ cp: Any; method: ScanMethod } | null>(null);
  const [routeId, setRouteId] = useState<string>(() => (typeof window !== "undefined" ? localStorage.getItem(`ow-tour:${companyId}`) ?? "" : ""));
  const nfcAbort = useRef<AbortController | null>(null);
  const handled = useRef(false);
  const canNfc = typeof window !== "undefined" && nfcSupported();

  function resolve(raw: string, method: ScanMethod) {
    const code = parseCheckpointPayload(raw);
    const cp = code && checkpoints.find((c) => (c.qr_code ?? "").toUpperCase() === code);
    if (!cp) { toast.error("That tag isn't a checkpoint for this company"); return; }
    setPending({ cp, method });
  }

  // Deep link: /patrols/?cp=CODE (QR opened with the phone's own camera app, or an NFC URL tag).
  useEffect(() => {
    if (handled.current || !checkpoints.length || typeof window === "undefined") return;
    const cp = new URLSearchParams(window.location.search).get("cp");
    if (!cp) return;
    handled.current = true;
    resolve(cp, "link");
    const u = new URL(window.location.href); u.searchParams.delete("cp"); window.history.replaceState(null, "", u.toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints]);

  useEffect(() => { if (routeId) localStorage.setItem(`ow-tour:${companyId}`, routeId); else localStorage.removeItem(`ow-tour:${companyId}`); }, [routeId, companyId]);
  useEffect(() => () => nfcAbort.current?.abort(), []);

  async function startNfc() {
    if (nfcOn) { nfcAbort.current?.abort(); setNfcOn(false); return; }
    const ac = new AbortController(); nfcAbort.current = ac; setNfcOn(true);
    try { const v = await readNfcOnce(ac.signal); resolve(v, "nfc"); }
    catch (e) { if ((e as Error)?.name !== "AbortError") toast.error((e as Error)?.message || "NFC failed"); }
    finally { setNfcOn(false); }
  }

  const route = routes.find((r) => r.id === routeId) ?? null;
  const since = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const tour = useMemo(() => tourProgress(route, checkpoints, logs.filter((l) => !routeId || l.route_id === routeId), since), [route, checkpoints, logs, routeId, since]);

  return (
    <div className="space-y-3" data-testid="tag-scan">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setQrOpen(true)} style={{ minHeight: 72 }}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-600 text-sm font-bold text-white">
          <QrCode className="h-6 w-6" />Scan QR
        </button>
        <button type="button" onClick={startNfc} disabled={!canNfc} style={{ minHeight: 72 }} aria-pressed={nfcOn}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold ${nfcOn ? "bg-sky-500 text-white animate-pulse" : "border border-border bg-card"} disabled:opacity-40`}>
          <Nfc className="h-6 w-6" />{!canNfc ? "NFC not on this phone" : nfcOn ? "Hold tag to phone…" : "Tap NFC tag"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Tip: your phone&apos;s own camera can scan a checkpoint QR too. It opens straight into this screen.</p>

      <div className="rounded-xl border border-border/60 bg-card p-3" data-testid="tour">
        <div className="flex items-center gap-2">
          <label htmlFor="tour-route" className="text-xs font-semibold text-muted-foreground">Tour</label>
          <select id="tour-route" value={routeId} onChange={(e) => setRouteId(e.target.value)} style={{ minHeight: 44 }}
            className="flex-1 rounded-lg border border-input bg-background px-2 text-sm">
            <option value="">No tour (free patrol)</option>
            {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        {route && (
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">{tour.done} / {tour.total} today</span>
              <div className="h-2 flex-1 mx-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${tour.total ? (tour.done / tour.total) * 100 : 0}%` }} /></div>
            </div>
            <ol className="space-y-1">
              {tour.stops.map((s, i) => (
                <li key={s.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${s.id === tour.nextId ? "bg-emerald-500/10 ring-1 ring-emerald-500/50" : ""}`}>
                  {s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  <span className="flex-1 truncate">{i + 1}. {s.name}</span>
                  {s.outOfOrder && <span className="rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-400">out of order</span>}
                  {s.at && <span className="text-[10px] text-muted-foreground">{new Date(s.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
                  {s.id === tour.nextId && <span className="text-[10px] font-semibold text-emerald-400">NEXT</span>}
                </li>
              ))}
            </ol>
            {tour.total > 0 && tour.done === tour.total && <p className="mt-2 text-xs font-semibold text-emerald-400">Tour complete ✓</p>}
          </div>
        )}
      </div>

      {qrOpen && (
        <QrScanner title="Scan checkpoint" hint="Point at the checkpoint's QR code"
          onClose={() => setQrOpen(false)} onScan={(v) => { setQrOpen(false); resolve(v, "qr"); }} />
      )}
      {pending && (
        <ScanConfirmSheet companyId={companyId} cp={pending.cp} method={pending.method} routeId={routeId || null}
          onClose={() => setPending(null)} onLogged={() => { setPending(null); onLogged(); }} />
      )}
    </div>
  );
}

function ScanConfirmSheet({ companyId, cp, method, routeId, onClose, onLogged }: {
  companyId: string; cp: Any; method: ScanMethod; routeId: string | null; onClose: () => void; onLogged: () => void;
}) {
  const [fix, setFix] = useState<Fix | null | undefined>(undefined);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, true, onClose);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { let live = true; getFix().then((f) => { if (live) setFix(f); }); return () => { live = false; }; }, []);
  const v = verifyScanPosition(cp, fix ?? null);

  async function log(status: string) {
    setBusy(status);
    try {
      const r = await logPatrolScanOffline(companyId, cp.id, {
        routeId: routeId ?? undefined, status, notes: note.trim() || undefined, method,
        lat: fix?.lat ?? null, lng: fix?.lng ?? null, accuracy: fix?.accuracy ?? null, gpsVerified: v.verified, distanceM: v.distance,
      });
      if (navigator.vibrate) navigator.vibrate(60);
      if (isPendingSync(r)) toast.success(`${cp.name} saved offline. It will sync when you reconnect.`);
      else toast.success(`${cp.name} logged`);
      onLogged();
    } catch { toast.error("Couldn't log the scan. Try again."); }
    finally { setBusy(null); }
  }

  return createPortal(
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-[90] flex items-end bg-black/60 outline-none" role="dialog" aria-modal="true" aria-label="Confirm checkpoint" data-testid="scan-confirm">
      <div className="w-full rounded-t-2xl border-t border-border bg-background p-4 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{method === "manual" ? "Manual entry" : `Tag read via ${method.toUpperCase()}`}</p>
            <h3 className="text-xl font-bold">{cp.name}</h3>
            {cp.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{cp.location}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cancel" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 rounded-xl border border-border/60 px-3 py-2 text-xs" data-testid="scan-gps">
          {fix === undefined ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking location…</span>
            : v.verified === true ? <span className="inline-flex items-center gap-2 text-emerald-400"><ShieldCheck className="h-4 w-4" />At checkpoint · {v.distance} m</span>
            : v.verified === false ? <span className="inline-flex items-center gap-2 text-amber-400"><ShieldAlert className="h-4 w-4" />{v.distance} m from the checkpoint&apos;s pinned spot. This will be flagged.</span>
            : <span className="text-muted-foreground">{fix ? "Checkpoint has no pinned GPS yet. Location saved." : "No GPS fix. The scan is logged without location."}</span>}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="mt-3 h-12 w-full rounded-xl border border-input bg-background px-3 text-base" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {STATUS.map((s) => (
            <button key={s.v} type="button" onClick={() => log(s.v)} disabled={!!busy || fix === undefined} style={{ minHeight: 64 }}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl ${s.cls} text-sm font-bold text-white disabled:opacity-60`}>
              {busy === s.v ? <Loader2 className="h-5 w-5 animate-spin" /> : <s.Icon className="h-5 w-5" />}{s.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Printable sheet of checkpoint QR codes (one card each, cut-out friendly). */
export function QrPrintSheet({ checkpoints, companyName, onClose }: { checkpoints: Any[]; companyName?: string; onClose: () => void }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return createPortal(
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-white text-black print:static" data-testid="qr-sheet">
      <style>{`@media print { body > *:not([data-testid=qr-sheet]) { display: none !important; } .no-print { display: none !important; } @page { margin: 12mm; } }`}</style>
      <div className="no-print sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold">{checkpoints.length} checkpoint QR codes</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-lg bg-black px-4 text-sm font-semibold text-white"><Printer className="h-4 w-4" />Print</button>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-lg border"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3">
        {checkpoints.map((cp, i) => (
          <div key={cp.id} className="flex break-inside-avoid flex-col items-center rounded-lg border-2 border-dashed border-gray-400 p-3 text-center">
            <QRCodeSVG value={checkpointUrl(origin, cp.qr_code)} size={140} level="M" includeMargin />
            <p className="mt-1 text-sm font-bold leading-tight">{i + 1}. {cp.name}</p>
            {cp.location && <p className="text-[10px] text-gray-600">{cp.location}</p>}
            <p className="font-mono text-[10px] text-gray-500">{cp.qr_code}</p>
            {companyName && <p className="text-[9px] text-gray-400">{companyName} · Overwatch checkpoint</p>}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
