"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { X, Loader2, ChevronLeft, PenLine, Eraser, UserX } from "lucide-react";
import { DictationRecorder } from "@/components/dictation-recorder";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";
import { createIncidentStatement } from "@/lib/supabase/db";
import { PERSON_ROLES, ATTESTATION, roleLabel, validateDraft, type StatementDraft } from "@/lib/statements/statement";

const EMPTY: StatementDraft = { person_role: "witness", full_name: "", phone: "", email: "", address: "", statement: "", declined: false };

/**
 * Two-step statement capture on one phone:
 *  1. Officer fills in who + what they said (or "declined").
 *  2. "Hand to the person": read-back of the statement with the attestation
 *     and a finger signature. Saved once; locked server-side after signing.
 */
export function StatementSheet({ incidentId, companyId, onClose, onSaved }: { incidentId: string; companyId: string; onClose: () => void; onSaved: () => void }) {
  const key = `ow-statement-draft:${incidentId}`;
  const [d, setD] = useState<StatementDraft>(() => {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key) || "{}") }; } catch { return EMPTY; }
  });
  const [step, setStep] = useState<1 | 2>(1);
  const [sigEmpty, setSigEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);
  const fix = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => { setMounted(true); navigator.geolocation?.getCurrentPosition((p) => { fix.current = { lat: p.coords.latitude, lng: p.coords.longitude }; }, () => {}, { timeout: 8000 }); }, []);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* quota */ } }, [d, key]);

  const set = (k: keyof StatementDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    const sig = d.declined ? null : pad.current?.toDataUrl() ?? null;
    const err = validateDraft(d, sig);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      await createIncidentStatement({
        incidentId, companyId, personRole: d.person_role, fullName: d.full_name, phone: d.phone, email: d.email, address: d.address,
        statement: d.statement, declined: d.declined, signaturePng: sig, lat: fix.current?.lat, lng: fix.current?.lng,
      });
      localStorage.removeItem(key);
      toast.success(d.declined ? "Recorded: declined to give a statement" : "Signed statement saved");
      onSaved();
    } catch { toast.error("Couldn't save. The draft is kept on this phone."); }
    finally { setSaving(false); }
  }

  function next() {
    const err = validateDraft(d, "pending");
    if (err) { toast.error(err); return; }
    if (d.declined) { void save(); return; }
    setStep(2);
  }

  if (!mounted) return null;
  const field = "h-12 w-full rounded-xl border border-input bg-background px-3 text-base";
  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Take statement" data-testid="statement-sheet">
      <div className="flex items-center justify-between border-b border-border/50 px-2 pt-[max(env(safe-area-inset-top),8px)] pb-2">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)} className="flex h-11 items-center gap-1 px-2 text-sm"><ChevronLeft className="h-5 w-5" />Back</button>
        ) : <span className="w-11" />}
        <h2 className="text-base font-bold">{step === 1 ? "Take statement" : "Read and sign"}</h2>
        <button type="button" onClick={onClose} aria-label="Close (draft kept)" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X className="h-5 w-5" /></button>
      </div>

      {step === 1 ? (
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Role">
            {PERSON_ROLES.map((r) => (
              <button key={r.v} type="button" role="radio" aria-checked={d.person_role === r.v} onClick={() => setD((x) => ({ ...x, person_role: r.v }))} style={{ minHeight: 44 }}
                className={`rounded-full px-3 text-sm ${d.person_role === r.v ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>{r.label}</button>
            ))}
          </div>
          <input className={field} placeholder="Full name *" value={d.full_name} onChange={set("full_name")} autoComplete="off" />
          <div className="grid grid-cols-2 gap-2">
            <input className={field} placeholder="Phone" inputMode="tel" value={d.phone} onChange={set("phone")} />
            <input className={field} placeholder="Email" inputMode="email" value={d.email} onChange={set("email")} />
          </div>
          <input className={field} placeholder="Address (optional)" value={d.address} onChange={set("address")} />
          <label className="flex items-center gap-3 rounded-xl border border-border/60 px-3" style={{ minHeight: 48 }}>
            <input type="checkbox" checked={d.declined} onChange={(e) => setD((x) => ({ ...x, declined: e.target.checked }))} className="h-5 w-5" />
            <span className="flex items-center gap-2 text-sm"><UserX className="h-4 w-4" />Declined to give a statement</span>
          </label>
          <textarea rows={8} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-base"
            placeholder={d.declined ? "Optional: what they said when declining" : "Their account, in their words. * (Note: a phone keyboard mic may send audio to a cloud service.)"}
            value={d.statement} onChange={set("statement")} />
          {/* Dictation appends to the statement. On-device only once #149 is merged (merge #149 first). */}
          <div data-testid="statement-dictation">
            <DictationRecorder onTranscript={(text, isFinal) => { if (isFinal && text.trim()) setD((x) => ({ ...x, statement: x.statement ? `${x.statement.trimEnd()} ${text.trim()}` : text.trim() })); }} />
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" data-testid="statement-readback">
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Hand the phone to {d.full_name.split(" ")[0] || "the person"}. Ask them to read it, then sign.</p>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="text-xs text-muted-foreground">{roleLabel(d.person_role)} · {d.full_name}</p>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{d.statement}</p>
          </div>
          <p className="text-sm">{ATTESTATION}</p>
          <SignaturePad ref={pad} onChange={setSigEmpty} />
          <button type="button" onClick={() => pad.current?.clear()} className="inline-flex h-11 items-center gap-1 px-1 text-sm text-muted-foreground"><Eraser className="h-4 w-4" />Clear signature</button>
        </div>
      )}

      <div className="border-t border-border/50 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {step === 1 ? (
          <button type="button" onClick={next} disabled={saving} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PenLine className="h-5 w-5" />}{d.declined ? "Save (declined)" : "Next: read back and sign"}
          </button>
        ) : (
          <button type="button" onClick={save} disabled={saving || sigEmpty} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-bold text-white disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <PenLine className="h-5 w-5" />}Sign and lock statement
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
