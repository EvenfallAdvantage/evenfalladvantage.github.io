"use client";

import { useState, useEffect } from "react";
import { FileText, Send, Loader2, Check, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLatestDocument, createDocument, updateDocument, issueDocument, updateTlpStep,
} from "@/lib/supabase/db";
import type { WarnoData, OperationDocument } from "@/types/operations";

const EA_ROLES = ["Advisory", "Planning", "Operational Support"];
const COMM_METHODS = ["Phone", "Email", "In-person"];

const EMPTY_WARNO: WarnoData = {
  preparedBy: "", dateIssued: new Date().toISOString().split("T")[0],
  operationalOverview: "", crowdSizeDensity: "", environment: "", knownConcerns: "",
  missionStatement: "",
  initialTasks: [
    { text: "Conduct initial assessment", checked: false },
    { text: "Review current operations", checked: false },
    { text: "Identify critical vulnerabilities", checked: false },
    { text: "Establish communication with client leadership", checked: false },
    { text: "Begin development of operational framework", checked: false },
  ],
  assessmentStart: "", keyMilestones: "", finalDeliverablesDate: "",
  clientPoc: "", eaPoc: "", communicationMethod: [],
  eaRole: [], clientAuthority: "",
};

function Txt({ value, onChange, placeholder, rows = 2 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
  );
}

interface WarnoPanelProps {
  eventId: string;
  companyId: string;
  eventName: string;
  companyName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intakeData?: Record<string, any> | null;
  onClose: () => void;
  onIssued?: () => void;
}

export default function WarnoPanel({ eventId, companyId, eventName, companyName, intakeData, onClose, onIssued }: WarnoPanelProps) {
  const [doc, setDoc] = useState<OperationDocument | null>(null);
  const [data, setData] = useState<WarnoData>({ ...EMPTY_WARNO });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const existing = await getLatestDocument(eventId, "warno");
        if (existing) {
          setDoc(existing);
          setData({ ...EMPTY_WARNO, ...(existing.data as Partial<WarnoData>) });
        } else if (intakeData) {
          // Pre-fill from intake
          setData(prev => ({
            ...prev,
            operationalOverview: `${intakeData.clientName || "Client"} is preparing for ${eventName} at ${intakeData.siteAddress || "TBD"}. ${intakeData.environmentNotes || ""}`.trim(),
            crowdSizeDensity: intakeData.estimatedAttendance || "",
            environment: intakeData.environment || "",
            knownConcerns: intakeData.clientIdentifiedRisks || "",
            missionStatement: intakeData.missionStatement || `${companyName} will provide ${(intakeData.engagementType || []).join(", ") || "security services"} for ${intakeData.clientName || "client"} at ${intakeData.siteAddress || "TBD"} in order to ensure safe, controlled operations.`,
            clientPoc: intakeData.clientContact || "",
            communicationMethod: intakeData.communicationMethod ? [intakeData.communicationMethod] : [],
            eaRole: intakeData.eaRole || [],
            clientAuthority: `${intakeData.clientName || "Client"} retains operational authority unless otherwise specified.`,
          }));
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId, intakeData, eventName, companyName]);

  function upd<K extends keyof WarnoData>(field: K, value: WarnoData[K]) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function toggleComm(m: string) {
    upd("communicationMethod", data.communicationMethod.includes(m) ? data.communicationMethod.filter(x => x !== m) : [...data.communicationMethod, m]);
  }

  function toggleRole(r: string) {
    upd("eaRole", data.eaRole.includes(r) ? data.eaRole.filter(x => x !== r) : [...data.eaRole, r]);
  }

  function toggleTask(idx: number) {
    const tasks = [...data.initialTasks];
    tasks[idx] = { ...tasks[idx], checked: !tasks[idx].checked };
    upd("initialTasks", tasks);
  }

  function addTask() {
    if (!newTask.trim()) return;
    upd("initialTasks", [...data.initialTasks, { text: newTask.trim(), checked: false }]);
    setNewTask("");
  }

  function removeTask(idx: number) {
    upd("initialTasks", data.initialTasks.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (doc) {
        await updateDocument(doc.id, { data: data as unknown as Record<string, unknown> });
      } else {
        const created = await createDocument({
          eventId, companyId, docType: "warno",
          data: data as unknown as Record<string, unknown>,
        });
        setDoc(created);
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleIssue() {
    setIssuing(true);
    try {
      // Save first
      let docId = doc?.id;
      if (!docId) {
        const created = await createDocument({
          eventId, companyId, docType: "warno",
          data: data as unknown as Record<string, unknown>,
        });
        docId = created.id;
        setDoc(created);
      } else {
        await updateDocument(docId, { data: data as unknown as Record<string, unknown> });
      }
      // Issue
      await issueDocument(docId);
      await updateTlpStep(eventId, "issue_warno");
      // Notify assigned staff
      try {
        const { dispatch } = await import("@/lib/services/notification-dispatcher");
        // We don't have the assigned user list here, so the parent should handle notifications
        void dispatch; // silence unused
      } catch {}
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
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">WARNING ORDER (WARNO)</span>
          {isIssued && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-500/15 text-green-600"><Check className="h-2.5 w-2.5" /> Issued</span>}
          {doc && !isIssued && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">Draft</span>}
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Header fields */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-xs">Prepared By</Label><Input value={data.preparedBy} onChange={(e) => upd("preparedBy", e.target.value)} placeholder="Your name" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        <div><Label className="text-xs">Date Issued</Label><Input type="date" value={data.dateIssued} onChange={(e) => upd("dateIssued", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
      </div>

      {/* 1. Situation */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">1. Situation</p>
        <div><Label className="text-xs">Operational Overview</Label><Txt value={data.operationalOverview} onChange={(v) => upd("operationalOverview", v)} placeholder="[Client] is preparing for [event] at [location]. The environment includes..." rows={2} /></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Crowd Size / Density</Label><Input value={data.crowdSizeDensity} onChange={(e) => upd("crowdSizeDensity", e.target.value)} placeholder="e.g. 500" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Environment</Label><Input value={data.environment} onChange={(e) => upd("environment", e.target.value)} placeholder="e.g. Outdoor, urban" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Known Concerns</Label><Input value={data.knownConcerns} onChange={(e) => upd("knownConcerns", e.target.value)} placeholder="e.g. Prior incidents" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* 2. Mission */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">2. Mission</p>
        <Txt value={data.missionStatement} onChange={(v) => upd("missionStatement", v)} placeholder={`${companyName} will [what] for [client] at [location] in order to [purpose].`} rows={2} />
      </div>

      {/* 3. Initial Tasks */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">3. Initial Tasks</p>
        <div className="space-y-1">
          {data.initialTasks.map((task, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button type="button" onClick={() => !isIssued && toggleTask(idx)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${task.checked ? "bg-green-500 border-green-500 text-white" : "border-border"}`}>
                {task.checked && <Check className="h-2.5 w-2.5" />}
              </button>
              <span className={`text-xs flex-1 ${task.checked ? "line-through text-muted-foreground" : ""}`}>{task.text}</span>
              {!isIssued && (
                <button type="button" onClick={() => removeTask(idx)} className="text-muted-foreground/30 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
              )}
            </div>
          ))}
        </div>
        {!isIssued && (
          <div className="flex gap-1">
            <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Add task..." className="h-7 text-xs flex-1" />
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={addTask} disabled={!newTask.trim()}><Plus className="h-3 w-3" /></Button>
          </div>
        )}
      </div>

      {/* 4. Timeline */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">4. Timeline</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Assessment Start</Label><Input type="date" value={data.assessmentStart} onChange={(e) => upd("assessmentStart", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Key Milestones</Label><Input value={data.keyMilestones} onChange={(e) => upd("keyMilestones", e.target.value)} placeholder="e.g. Site walkthrough 3/25" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Deliverables Due</Label><Input type="date" value={data.finalDeliverablesDate} onChange={(e) => upd("finalDeliverablesDate", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      </div>

      {/* 5. Coordination */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">5. Coordination</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Client POC</Label><Input value={data.clientPoc} onChange={(e) => upd("clientPoc", e.target.value)} placeholder="Name / phone" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">{companyName} POC</Label><Input value={data.eaPoc} onChange={(e) => upd("eaPoc", e.target.value)} placeholder="Name / phone" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
        <div>
          <Label className="text-xs">Communication Method</Label>
          <div className="flex gap-1.5 mt-1">
            {COMM_METHODS.map(m => (
              <button key={m} type="button" onClick={() => !isIssued && toggleComm(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${data.communicationMethod.includes(m) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {data.communicationMethod.includes(m) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 6. Command & Control */}
      <div className="space-y-2 pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">6. Command & Control</p>
        <div>
          <Label className="text-xs">{companyName} Role</Label>
          <div className="flex gap-1.5 mt-1">
            {EA_ROLES.map(r => (
              <button key={r} type="button" onClick={() => !isIssued && toggleRole(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${data.eaRole.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {data.eaRole.includes(r) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{r}
              </button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs">Client Authority</Label><Txt value={data.clientAuthority} onChange={(v) => upd("clientAuthority", v)} placeholder="[Client] retains operational authority unless otherwise specified." rows={1} /></div>
      </div>

      {/* Actions */}
      {!isIssued && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Save Draft
          </Button>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleIssue} disabled={issuing || !data.missionStatement.trim()}>
            {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Issue WARNO
          </Button>
        </div>
      )}
    </div>
  );
}
