"use client";

import { useState, useEffect } from "react";
import { FileText, Send, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLatestDocument, createDocument, updateDocument, issueDocument,
  updateTlpStep, getFragoCount, getDocumentAcks, acknowledgeDocument,
} from "@/lib/supabase/db";
import type { FragoData, OperationDocument, DocumentAck } from "@/types/operations";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const CHANGE_TYPES = ["Weather / Environment", "Crowd size / behavior", "Threat level", "Staffing change", "Client request", "Equipment / Logistics", "Schedule change"];
const TASK_CHANGES = ["Reassign personnel", "Adjust patrol routes", "Modify access control", "Increase / reduce posts", "Change communication plan"];
const AFFECTED_AREAS = ["Entry / Exit points", "VIP areas", "Main stage / crowd zone", "Parking / Transit", "All areas"];
const PACE_LEVELS = ["Primary", "Alternate", "Contingency", "Emergency", "Recovery"];

function Txt({ value, onChange, placeholder, rows = 2, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-60" />
  );
}

const EMPTY_FRAGO: FragoData = {
  preparedBy: "", dateIssued: new Date().toISOString().split("T")[0], timeIssued: new Date().toTimeString().slice(0, 5),
  fragoNumber: 1, relatedOpordId: "",
  whatChanged: [], changeDescription: "", updatedRiskLevel: "",
  missionChanged: false, updatedMission: "",
  updatedTasks: [], specificInstructions: "", areasAffected: [],
  medicalChange: "", commsChange: "", equipmentChange: "",
  structureChange: "", updatedCommandLead: "", updatedSupervisors: "", escalationChange: "",
  currentLevel: "Primary", actionBeingTaken: "",
  effectiveImmediately: true, effectiveTime: "", duration: "Until Further Notice",
};

interface FragoPanelProps {
  eventId: string;
  companyId: string;
  eventName: string;
  currentUserId?: string;
  onClose: () => void;
  onIssued?: () => void;
}

export default function FragoPanel({ eventId, companyId, eventName: _eventName, currentUserId, onClose, onIssued }: FragoPanelProps) {
  void _eventName;
  const [doc, setDoc] = useState<OperationDocument | null>(null);
  const [data, setData] = useState<FragoData>({ ...EMPTY_FRAGO });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [acks, setAcks] = useState<DocumentAck[]>([]);
  const [acking, setAcking] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await getLatestDocument(eventId, "frago");
        if (existing) {
          setDoc(existing);
          setData({ ...EMPTY_FRAGO, ...(existing.data as Partial<FragoData>) });
          if (existing.status === "issued") {
            const a = await getDocumentAcks(existing.id);
            setAcks(a);
          }
        } else {
          // Set FRAGO number based on count
          const count = await getFragoCount(eventId);
          setData(prev => ({ ...prev, fragoNumber: count + 1 }));
          // Get OPORD ID for reference
          const opord = await getLatestDocument(eventId, "opord");
          if (opord) setData(prev => ({ ...prev, relatedOpordId: opord.id }));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  function upd<K extends keyof FragoData>(field: K, value: FragoData[K]) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function toggle(field: keyof FragoData, val: string) {
    const arr = data[field] as string[];
    upd(field, (arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]) as FragoData[keyof FragoData]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (doc) {
        await updateDocument(doc.id, { data: data as unknown as Record<string, unknown> });
      } else {
        const created = await createDocument({
          eventId, companyId, docType: "frago",
          data: data as unknown as Record<string, unknown>,
          parentDocId: data.relatedOpordId || undefined,
        });
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
        const created = await createDocument({
          eventId, companyId, docType: "frago",
          data: data as unknown as Record<string, unknown>,
          parentDocId: data.relatedOpordId || undefined,
        });
        docId = created.id;
        setDoc(created);
      } else {
        await updateDocument(docId, { data: data as unknown as Record<string, unknown> });
      }
      await issueDocument(docId);
      await updateTlpStep(eventId, "adjust");
      setDoc(prev => prev ? { ...prev, status: "issued" } : prev);
      onIssued?.();
    } catch (err) { console.error(err); }
    finally { setIssuing(false); }
  }

  async function handleAck() {
    if (!doc || !currentUserId) return;
    setAcking(true);
    try {
      const ack = await acknowledgeDocument(doc.id, currentUserId);
      setAcks(prev => [...prev.filter(a => a.user_id !== currentUserId), ack]);
    } catch (err) { console.error(err); }
    finally { setAcking(false); }
  }

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-6 flex justify-center border-b border-border/20 bg-primary/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isIssued = doc?.status === "issued";
  const hasAcked = currentUserId ? acks.some(a => a.user_id === currentUserId) : false;

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-amber-500/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold uppercase tracking-wider">FRAGO #{data.fragoNumber}</span>
          {isIssued && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-500/15 text-green-600"><Check className="h-2.5 w-2.5" /> Issued</span>}
          {doc && !isIssued && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">Draft</span>}
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Header fields */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div><Label className="text-xs">Prepared By</Label><Input value={data.preparedBy} onChange={(e) => upd("preparedBy", e.target.value)} placeholder="Your name" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        <div><Label className="text-xs">Date</Label><Input type="date" value={data.dateIssued} onChange={(e) => upd("dateIssued", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        <div><Label className="text-xs">Time</Label><Input type="time" value={data.timeIssued} onChange={(e) => upd("timeIssued", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
      </div>

      {/* 1. Situation Update */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1. Situation Update</p>
        <div>
          <Label className="text-xs">What Changed</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CHANGE_TYPES.map(t => (
              <button key={t} type="button" onClick={() => !isIssued && toggle("whatChanged", t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${(data.whatChanged).includes(t) ? "border-amber-500/60 bg-amber-500/10 text-amber-600" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {(data.whatChanged).includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
              </button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs">Description of Change</Label><Txt value={data.changeDescription} onChange={(v) => upd("changeDescription", v)} placeholder="Detailed description of what has changed..." rows={2} disabled={isIssued} /></div>
        <div><Label className="text-xs">Updated Risk Level</Label>
          <select value={data.updatedRiskLevel} onChange={(e) => upd("updatedRiskLevel", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
            <option value="">No change</option>
            {["Low", "Moderate", "High", "Critical"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {/* 2. Mission */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2. Mission</p>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={data.missionChanged} onChange={(e) => upd("missionChanged", e.target.checked)} disabled={isIssued} className="rounded border-border" />
          Mission has changed
        </label>
        {data.missionChanged && (
          <div><Label className="text-xs">Updated Mission</Label><Txt value={data.updatedMission} onChange={(v) => upd("updatedMission", v)} placeholder="Updated mission statement..." rows={2} disabled={isIssued} /></div>
        )}
      </div>

      {/* 3. Execution Changes */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">3. Execution Changes</p>
        <div>
          <Label className="text-xs">Updated Tasks</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {TASK_CHANGES.map(t => (
              <button key={t} type="button" onClick={() => !isIssued && toggle("updatedTasks", t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${(data.updatedTasks).includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {(data.updatedTasks).includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
              </button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs">Specific Instructions</Label><Txt value={data.specificInstructions} onChange={(v) => upd("specificInstructions", v)} placeholder="Detailed execution changes..." rows={2} disabled={isIssued} /></div>
        <div>
          <Label className="text-xs">Areas Affected</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {AFFECTED_AREAS.map(t => (
              <button key={t} type="button" onClick={() => !isIssued && toggle("areasAffected", t)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${(data.areasAffected).includes(t) ? "border-red-500/60 bg-red-500/10 text-red-500" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {(data.areasAffected).includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Contingency Status */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">6. Contingency Status</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Current PACE Level</Label>
            <select value={data.currentLevel} onChange={(e) => upd("currentLevel", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              {PACE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Action Being Taken</Label><Input value={data.actionBeingTaken} onChange={(e) => upd("actionBeingTaken", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* 7. Timeline */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">7. Timeline</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-xs sm:col-span-1">
            <input type="checkbox" checked={data.effectiveImmediately} onChange={(e) => upd("effectiveImmediately", e.target.checked)} disabled={isIssued} className="rounded border-border" />
            Effective Immediately
          </label>
          {!data.effectiveImmediately && (
            <div><Label className="text-xs">Effective Time</Label><Input type="time" value={data.effectiveTime} onChange={(e) => upd("effectiveTime", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          )}
          <div><Label className="text-xs">Duration</Label>
            <select value={data.duration} onChange={(e) => upd("duration", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="Temporary">Temporary</option>
              <option value="Until Further Notice">Until Further Notice</option>
              <option value="Permanent">Permanent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Acknowledgements */}
      {isIssued && (
        <div className="space-y-2 pt-2 border-t border-border/20">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acknowledgements ({acks.length})</p>
            {currentUserId && !hasAcked && (
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={handleAck} disabled={acking}>
                {acking ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Check className="h-2.5 w-2.5" />} Acknowledge
              </Button>
            )}
            {hasAcked && <span className="text-[10px] text-green-600 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Acknowledged</span>}
          </div>
          {acks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {acks.map(a => (
                <div key={a.id} className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/5 px-2 py-1">
                  <Avatar className="h-5 w-5">
                    {a.users?.avatar_url && <AvatarImage src={a.users.avatar_url} />}
                    <AvatarFallback className="text-[7px] font-bold bg-green-500/20 text-green-600">
                      {(a.users?.first_name?.[0] ?? "") + (a.users?.last_name?.[0] ?? "")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-medium">{a.users?.first_name} {a.users?.last_name}</span>
                  <span className="text-[8px] text-muted-foreground">{new Date(a.acknowledged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isIssued && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Save Draft
          </Button>
          <Button size="sm" className="h-7 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700" onClick={handleIssue} disabled={issuing || !data.changeDescription.trim()}>
            {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Issue FRAGO
          </Button>
        </div>
      )}
    </div>
  );
}
