"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Loader2, MapPin, Send, X, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createIncidentEnhanced, uploadIncidentMedia } from "@/lib/supabase/db";
import {
  QUICK_TYPES, newDraft, defaultSeverity, quickTitle, quickDescription, formatGps,
  saveDraft, loadDraft, clearDraft, type QuickDraft,
} from "@/lib/incidents/quick-draft";

const SEV = [
  { v: "low", label: "Low", cls: "bg-blue-500" },
  { v: "medium", label: "Med", cls: "bg-amber-500" },
  { v: "high", label: "High", cls: "bg-orange-500" },
  { v: "critical", label: "Critical", cls: "bg-red-600" },
];

interface Props {
  companyId: string;
  eventId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

/**
 * Three-tap incident report for phones: 1) pick what happened, 2) optional
 * photo / note, 3) Send. Time and GPS are captured when the sheet opens and the
 * draft autosaves to this device so a dropped call or app switch loses nothing.
 * The full form stays available for detailed reports.
 */
export function QuickIncidentSheet({ companyId, eventId, onClose, onCreated }: Props) {
  const [d, setD] = useState<QuickDraft>(() => loadDraft(companyId) ?? newDraft());
  const [photos, setPhotos] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const restored = useRef(!!loadDraft(companyId));

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { saveDraft(companyId, d); }, [companyId, d]);
  useEffect(() => {
    if (d.lat != null || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setD((x) => ({ ...x, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })),
      () => {}, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [d.lat]);

  async function send() {
    if (!d.type) { toast.error("Pick what happened first"); return; }
    setSending(true);
    try {
      const inc = await createIncidentEnhanced(companyId, {
        title: quickTitle(d),
        description: quickDescription(d),
        type: d.type,
        severity: d.severity,
        priority: d.severity === "critical" || d.severity === "high" ? "high" : "medium",
        location: d.locationText.trim() || formatGps(d) || undefined,
        eventId: eventId ?? undefined,
      });
      let failed = 0;
      if (inc?.id) for (const f of photos) { if (!(await uploadIncidentMedia(inc.id, companyId, f, "photo"))) failed++; }
      clearDraft(companyId);
      toast.success(failed ? `Report sent. ${failed} photo(s) failed. Add them from the report.` : "Report sent");
      onCreated();
    } catch {
      toast.error("Couldn't send. Your draft is saved on this phone.");
    } finally { setSending(false); }
  }

  function discard() { clearDraft(companyId); setD(newDraft()); setPhotos([]); restored.current = false; }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Quick incident report" data-testid="quick-incident">
      <div className="flex items-center justify-between border-b border-border/50 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <h2 className="text-lg font-bold">Quick Report</h2>
        <button type="button" onClick={onClose} aria-label="Close (draft is kept)" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {restored.current && (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span>Draft restored from {new Date(d.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            <button type="button" onClick={discard} className="flex min-h-11 items-center gap-1 px-2 font-medium"><Trash2 className="h-3.5 w-3.5" />Discard</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1"><Clock className="h-3.5 w-3.5" />{new Date(d.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1" data-testid="quick-gps"><MapPin className="h-3.5 w-3.5" />{formatGps(d) || "Getting location…"}</span>
        </div>
        <section>
          <p className="mb-2 text-sm font-semibold">1. What happened?</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_TYPES.map((t) => (
              <button key={t.key} type="button" aria-pressed={d.type === t.key}
                onClick={() => setD((x) => ({ ...x, type: t.key, severity: x.type === t.key ? x.severity : defaultSeverity(t.key) }))}
                style={{ minHeight: 56 }} className={`rounded-xl border px-3 text-left text-sm font-medium transition-colors ${d.type === t.key ? "border-primary bg-primary/15 text-foreground" : "border-border/60 bg-card"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Severity">
            {SEV.map((s) => (
              <button key={s.v} type="button" role="radio" aria-checked={d.severity === s.v} onClick={() => setD((x) => ({ ...x, severity: s.v }))}
                style={{ minHeight: 44 }} className={`rounded-lg text-xs font-semibold ${d.severity === s.v ? `${s.cls} text-white` : "bg-muted/40 text-muted-foreground"}`}>{s.label}</button>
            ))}
          </div>
        </section>
        <section>
          <p className="mb-2 text-sm font-semibold">2. Photo or note <span className="font-normal text-muted-foreground">(optional)</span></p>
          <input ref={camRef} type="file" accept="image/*" capture="environment" multiple className="hidden"
            onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) setPhotos((p) => [...p, ...f]); e.target.value = ""; }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => camRef.current?.click()} style={{ minHeight: 56 }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 bg-card text-sm font-medium">
              <Camera className="h-5 w-5" />{photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""}` : "Take photo"}
            </button>
          </div>
          <textarea value={d.note} onChange={(e) => setD((x) => ({ ...x, note: e.target.value }))} rows={3}
            placeholder="What did you see? Tap the mic on your keyboard to dictate."
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-base" />
          <input value={d.locationText} onChange={(e) => setD((x) => ({ ...x, locationText: e.target.value }))}
            placeholder="Where (e.g. east gate). GPS is attached automatically"
            className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 text-base" />
        </section>
      </div>
      <div className="border-t border-border/50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <button type="button" onClick={send} disabled={sending || !d.type}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-50">
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}3. Send report
        </button>
      </div>
    </div>,
    document.body,
  );
}
