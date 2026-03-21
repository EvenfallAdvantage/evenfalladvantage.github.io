"use client";

import { useState, useEffect } from "react";
import { FileText, Send, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLatestDocument, createDocument, updateDocument, issueDocument,
} from "@/lib/supabase/db";
import type { GotwaData, OperationDocument } from "@/types/operations";

const PRIMARY_CONCERNS = ["Crowd control issue", "Medical emergency", "Unauthorized access", "Equipment failure", "Personnel injury", "Weather event", "VIP situation"];
const COMM_METHODS = ["Radio", "Phone", "Hybrid"];
const DURATIONS = ["< 30 min", "30–60 min", "1–2 hours", "Event duration"];
const STATUS_OPTIONS = ["Normal", "Elevated Awareness", "Active Issue", "Escalated"];

function Txt({ value, onChange, placeholder, rows = 2, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-60" />
  );
}

const EMPTY_GOTWA: GotwaData = {
  preparedBy: "", dateTime: new Date().toISOString().slice(0, 16),
  area: "", objective: "",
  personnelAssigned: "", supervisor: "", supportElements: "",
  startTime: "", expectedDuration: "", returnCheckInTime: "",
  primaryConcern: [], immediateAction: "", escalationTrigger: "",
  ifNoIssue: "", whoToNotify: "", followOnActions: "",
  status: "Normal", communicationMethod: [], channel: "", notes: "",
};

interface GotwaPanelProps {
  eventId: string;
  companyId: string;
  onClose: () => void;
  onIssued?: () => void;
}

export default function GotwaPanel({ eventId, companyId, onClose, onIssued }: GotwaPanelProps) {
  const [doc, setDoc] = useState<OperationDocument | null>(null);
  const [data, setData] = useState<GotwaData>({ ...EMPTY_GOTWA });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await getLatestDocument(eventId, "gotwa");
        if (existing) {
          setDoc(existing);
          setData({ ...EMPTY_GOTWA, ...(existing.data as Partial<GotwaData>) });
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  function upd<K extends keyof GotwaData>(field: K, value: GotwaData[K]) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function toggleArr(field: keyof GotwaData, val: string) {
    const arr = data[field] as string[];
    upd(field, (arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]) as GotwaData[keyof GotwaData]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (doc) {
        await updateDocument(doc.id, { data: data as unknown as Record<string, unknown> });
      } else {
        const created = await createDocument({ eventId, companyId, docType: "gotwa", data: data as unknown as Record<string, unknown> });
        setDoc(created);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleIssue() {
    setIssuing(true);
    try {
      let docId = doc?.id;
      if (!docId) {
        const created = await createDocument({ eventId, companyId, docType: "gotwa", data: data as unknown as Record<string, unknown> });
        docId = created.id;
        setDoc(created);
      } else {
        await updateDocument(docId, { data: data as unknown as Record<string, unknown> });
      }
      await issueDocument(docId);
      setDoc(prev => prev ? { ...prev, status: "issued" } : prev);
      onIssued?.();
    } catch (err) { console.error(err); }
    finally { setIssuing(false); }
  }

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-6 flex justify-center border-b border-border/20 bg-primary/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isIssued = doc?.status === "issued";

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-violet-500/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-500" />
          <span className="text-xs font-semibold uppercase tracking-wider">GOTWA — 5-Point Contingency Plan</span>
          {isIssued && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-500/15 text-green-600"><Check className="h-2.5 w-2.5" /> Issued</span>}
          {doc && !isIssued && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">Draft</span>}
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Header fields */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-xs">Prepared By</Label><Input value={data.preparedBy} onChange={(e) => upd("preparedBy", e.target.value)} placeholder="Supervisor name" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        <div><Label className="text-xs">Date/Time</Label><Input type="datetime-local" value={data.dateTime} onChange={(e) => upd("dateTime", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
      </div>

      {/* G — Going */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">G — Where am I Going?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Area / Location</Label><Input value={data.area} onChange={(e) => upd("area", e.target.value)} placeholder="e.g. North perimeter, Lot B" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Objective</Label><Input value={data.objective} onChange={(e) => upd("objective", e.target.value)} placeholder="e.g. Patrol + crowd control" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* O — Others */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">O — Who is going with me? (Others)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Personnel Assigned</Label><Input value={data.personnelAssigned} onChange={(e) => upd("personnelAssigned", e.target.value)} placeholder="Names / call signs" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Supervisor</Label><Input value={data.supervisor} onChange={(e) => upd("supervisor", e.target.value)} placeholder="Supervisor name" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Support Elements</Label><Input value={data.supportElements} onChange={(e) => upd("supportElements", e.target.value)} placeholder="e.g. Medical, LE liaison" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* T — Time */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">T — How long will I be gone? (Time)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Start Time</Label><Input type="time" value={data.startTime} onChange={(e) => upd("startTime", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Expected Duration</Label>
            <select value={data.expectedDuration} onChange={(e) => upd("expectedDuration", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              {DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Return / Check-In Time</Label><Input type="time" value={data.returnCheckInTime} onChange={(e) => upd("returnCheckInTime", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* W — What if */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">W — What do I do if something happens? (What if)</p>
        <div>
          <Label className="text-xs">Primary Concern</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRIMARY_CONCERNS.map(c => (
              <button key={c} type="button" onClick={() => !isIssued && toggleArr("primaryConcern", c)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${(data.primaryConcern).includes(c) ? "border-red-500/60 bg-red-500/10 text-red-500" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {(data.primaryConcern).includes(c) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{c}
              </button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs">Immediate Action</Label><Txt value={data.immediateAction} onChange={(v) => upd("immediateAction", v)} placeholder="What to do immediately if this occurs..." rows={1} disabled={isIssued} /></div>
        <div><Label className="text-xs">Escalation Trigger</Label><Input value={data.escalationTrigger} onChange={(e) => upd("escalationTrigger", e.target.value)} placeholder="e.g. If not resolved in 5 min, escalate" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
      </div>

      {/* A — Actions */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">A — What do I do if you don&apos;t return? (Actions)</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">If No Issue</Label><Input value={data.ifNoIssue} onChange={(e) => upd("ifNoIssue", e.target.value)} placeholder="e.g. Resume patrol" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Who to Notify</Label><Input value={data.whoToNotify} onChange={(e) => upd("whoToNotify", e.target.value)} placeholder="e.g. Command" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Follow-On Actions</Label><Input value={data.followOnActions} onChange={(e) => upd("followOnActions", e.target.value)} placeholder="e.g. Send backup team" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* Status & Comms */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status & Communications</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Current Status</Label>
            <select value={data.status} onChange={(e) => upd("status", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Comms Method</Label>
            <div className="flex gap-1.5 mt-1">
              {COMM_METHODS.map(m => (
                <button key={m} type="button" onClick={() => !isIssued && toggleArr("communicationMethod", m)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${(data.communicationMethod).includes(m) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                  {(data.communicationMethod).includes(m) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{m}
                </button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs">Channel</Label><Input value={data.channel} onChange={(e) => upd("channel", e.target.value)} placeholder="e.g. Ch 2" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
        <div><Label className="text-xs">Notes</Label><Txt value={data.notes} onChange={(v) => upd("notes", v)} placeholder="Additional notes..." rows={1} disabled={isIssued} /></div>
      </div>

      {/* Actions */}
      {!isIssued && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Save Draft
          </Button>
          <Button size="sm" className="h-7 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700" onClick={handleIssue} disabled={issuing || !data.area.trim()}>
            {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Issue GOTWA
          </Button>
        </div>
      )}
    </div>
  );
}
