"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Check, X, Pencil, Save, Upload, MapPin, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLatestDocument, updateDocument,
} from "@/lib/supabase/db-documents";
import { createClient } from "@/lib/supabase/client";
import type { IntakeData, OperationDocument } from "@/types/operations";

/* ── Chip option lists ──────────────────────────────── */

const ENGAGEMENT_TYPES = ["Event Security", "Executive Protection", "Consulting / Assessment", "Recurring Contract", "Loss Prevention", "Training", "Other"];
const VENUE_TYPES = ["Indoor Venue", "Outdoor Venue", "Festival", "Concert", "Stadium", "Convention", "Corporate", "Private Residence", "Parking Structure", "Mixed Use"];
const SERVICES_REQUESTED = ["Access Control", "Crowd Management", "VIP Protection", "Patrol", "Medical Standby", "Surveillance", "Emergency Planning", "De-Escalation", "Training", "Site Assessment"];
const THREAT_TYPES = ["Active Threat", "Theft", "Assault", "Trespass", "Crowd Surge", "Weather", "Fire", "Medical Emergency", "Civil Disturbance", "Terrorism"];
const CONSTRAINT_TYPES = ["Budget", "Staffing", "Legal", "Venue Layout", "Time", "Client Politics", "Weather", "Permits"];
const EA_ROLES = ["Advisory", "Planning", "Operational Support", "Full Security Provider", "Training Only"];
const SUCCESS_CRITERIA = ["Zero incidents", "Client satisfaction", "Staff safety", "On-time execution", "Budget adherence", "Regulatory compliance"];
const MEDICAL_CAPABILITIES = ["None", "Basic First Aid", "STOP THE BLEED\u00ae", "EMS On-site"];
const COMMAND_MODELS = ["Single Supervisor", "Tiered Leadership", "ICS-Aligned"];

/* ── Types ──────────────────────────────────────────── */

export type IntakeChange = { field: string; label: string; from: string; to: string };

export interface IntakePanelProps {
  eventId: string;
  companyId: string;
  eventName: string;
  eventLocation?: string;
  companyName?: string;
  onClose: () => void;
  onSaved?: (changes: IntakeChange[]) => void;
}

/* ── Helpers ────────────────────────────────────────── */

const EMPTY_INTAKE: IntakeData = {
  engagementType: [], clientRequest: "", missionStatement: "", timeSensitivity: "",
  venueType: [], estimatedAttendance: "", environment: "", environmentNotes: "",
  servicesRequested: [], deliverables: "", outOfScope: "",
  clientPersonnelCount: "", clientLeadershipStructure: "", clientExistingSops: false,
  clientIncidentReporting: "", clientTrainingLevel: "", equipmentAvailable: "",
  medicalCapability: "", technologyAvailable: "",
  clientIdentifiedRisks: "", eaRiskAssessment: "", riskLevel: "", threatTypes: [], constraints: [],
  commandModel: "", onSiteAuthority: "", eaRole: [], escalationFlow: "", chainOfCommand: "",
  successCriteria: [], additionalSuccessMeasures: "",
};

function Txt({ value, onChange, placeholder, rows = 2, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-60" />
  );
}

/** Field labels for diff reporting */
const FIELD_LABELS: Record<string, string> = {
  engagementType: "Engagement Type",
  clientRequest: "Client Request",
  missionStatement: "Mission Statement",
  timeSensitivity: "Time Sensitivity",
  venueType: "Venue Type",
  estimatedAttendance: "Est. Attendance",
  environment: "Environment",
  environmentNotes: "Environment Notes",
  servicesRequested: "Services Requested",
  deliverables: "Deliverables",
  outOfScope: "Out of Scope",
  equipmentAvailable: "Equipment Available",
  medicalCapability: "Medical Capability",
  clientIdentifiedRisks: "Client Risks",
  riskLevel: "Risk Level",
  threatTypes: "Threat Types",
  constraints: "Constraints",
  commandModel: "Command Model",
  eaRole: "EA Role",
  escalationFlow: "Escalation Flow",
  successCriteria: "Success Criteria",
  additionalSuccessMeasures: "Additional Success Measures",
};

function serialize(v: unknown): string {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (v === null || v === undefined) return "";
  return String(v);
}

function computeDiff(oldData: IntakeData, newData: IntakeData): IntakeChange[] {
  const changes: IntakeChange[] = [];
  const keys = Object.keys(FIELD_LABELS) as (keyof IntakeData)[];
  for (const key of keys) {
    const oldVal = serialize(oldData[key]);
    const newVal = serialize(newData[key]);
    if (oldVal !== newVal) {
      changes.push({
        field: key,
        label: FIELD_LABELS[key] ?? key,
        from: oldVal,
        to: newVal,
      });
    }
  }
  return changes;
}

/* ── Component ──────────────────────────────────────── */

export function IntakePanel({ eventId, companyId, eventName, eventLocation, companyName, onClose, onSaved }: IntakePanelProps) {
  const [doc, setDoc] = useState<OperationDocument | null>(null);
  const [data, setData] = useState<IntakeData>({ ...EMPTY_INTAKE });
  const [originalData, setOriginalData] = useState<IntakeData>({ ...EMPTY_INTAKE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editOverride, setEditOverride] = useState(false);

  // Site map state
  const [siteMapUrl, setSiteMapUrl] = useState<string | null>(null);
  const [uploadingSiteMap, setUploadingSiteMap] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [existing, eventRow] = await Promise.all([
          getLatestDocument(eventId, "intake"),
          createClient().from("events").select("site_map_url").eq("id", eventId).maybeSingle(),
        ]);
        if (existing) {
          setDoc(existing);
          const merged = { ...EMPTY_INTAKE, ...(existing.data as Partial<IntakeData>) };
          setData(merged);
          setOriginalData(merged);
        }
        if (eventRow?.data?.site_map_url) {
          setSiteMapUrl(eventRow.data.site_map_url);
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  function upd<K extends keyof IntakeData>(field: K, value: IntakeData[K]) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function toggle(field: keyof IntakeData, val: string) {
    const arr = data[field] as string[];
    upd(field as keyof IntakeData, (arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]) as IntakeData[keyof IntakeData]);
  }

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const changes = computeDiff(originalData, data);
      await updateDocument(doc.id, { data: data as unknown as Record<string, unknown> });
      setOriginalData({ ...data });
      onSaved?.(changes);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleSiteMapUpload(file: File) {
    setUploadingSiteMap(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${companyId}/${eventId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("operation-maps").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("operation-maps").getPublicUrl(path);
      const url = urlData.publicUrl;
      // Update event record
      await supabase.from("events").update({ site_map_url: url }).eq("id", eventId);
      setSiteMapUrl(url);
    } catch (err) { console.error("Site map upload failed:", err); }
    finally { setUploadingSiteMap(false); }
  }

  async function handleSiteMapRemove() {
    try {
      const supabase = createClient();
      await supabase.from("events").update({ site_map_url: null }).eq("id", eventId);
      setSiteMapUrl(null);
    } catch (err) { console.error("Site map remove failed:", err); }
  }

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-6 flex justify-center border-b border-border/20 bg-primary/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isIssued = doc?.status === "issued";
  const isLocked = isIssued && !editOverride;

  function SectionHeader({ title }: { title: string }) {
    return (
      <div className="pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
    );
  }

  function Chips({ field, options, color = "primary" }: { field: keyof IntakeData; options: string[]; color?: string }) {
    const arr = data[field] as string[];
    const colorClass = color === "red" ? "border-red-500/60 bg-red-500/10 text-red-500" : color === "amber" ? "border-amber-500/60 bg-amber-500/10 text-amber-600" : color === "green" ? "border-green-500/60 bg-green-500/10 text-green-600" : "border-primary bg-primary/10 text-primary";
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map(t => (
          <button key={t} type="button" onClick={() => !isLocked && toggle(field, t)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${arr.includes(t) ? colorClass : "border-border/40 text-muted-foreground hover:border-border"}`}>
            {arr.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider">INTAKE</span>
          {isIssued && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-500/15 text-green-600"><Check className="h-2.5 w-2.5" /> Issued</span>}
          {doc && !isIssued && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">Draft v{doc.version}</span>}
          {isIssued && (
            <Button size="sm" variant={editOverride ? "default" : "outline"} className="gap-1.5 text-xs ml-2"
              onClick={() => setEditOverride(!editOverride)}>
              {editOverride ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              {editOverride ? 'Lock' : 'Edit'}
            </Button>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Mission Overview */}
      <SectionHeader title="Mission Overview" />
      <div className="space-y-2">
        <div><Label className="text-xs">Engagement Type</Label><Chips field="engagementType" options={ENGAGEMENT_TYPES} /></div>
        <div><Label className="text-xs">Client Request</Label><Txt value={data.clientRequest} onChange={(v) => upd("clientRequest", v)} placeholder="What the client asked for..." rows={2} disabled={isLocked} /></div>
        <div><Label className="text-xs">Mission Statement</Label><Txt value={data.missionStatement} onChange={(v) => upd("missionStatement", v)} placeholder={`${companyName || "Company"} will provide [service] for [client] at [location] in order to [purpose].`} rows={2} disabled={isLocked} /></div>
        <div><Label className="text-xs">Time Sensitivity</Label>
          <select value={data.timeSensitivity} onChange={(e) => upd("timeSensitivity", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
            <option value="">Select...</option>
            {["Low", "Medium", "High", "Immediate"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Location & Environment */}
      <SectionHeader title="Location & Environment" />
      <div className="space-y-2">
        <div><Label className="text-xs">Venue Type</Label><Chips field="venueType" options={VENUE_TYPES} /></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Est. Attendance</Label><Input value={data.estimatedAttendance} onChange={(e) => upd("estimatedAttendance", e.target.value)} placeholder="e.g. 500" className="mt-1 h-8 text-sm" disabled={isLocked} /></div>
          <div><Label className="text-xs">Environment</Label>
            <select value={data.environment} onChange={(e) => upd("environment", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              <option value="Indoor">Indoor</option>
              <option value="Outdoor">Outdoor</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
          <div><Label className="text-xs">Environment Notes</Label><Input value={data.environmentNotes} onChange={(e) => upd("environmentNotes", e.target.value)} placeholder="e.g. Urban, multi-level" className="mt-1 h-8 text-sm" disabled={isLocked} /></div>
        </div>
      </div>

      {/* Site Map */}
      <SectionHeader title="Site Map / Floor Plan" />
      <div className="space-y-2">
        {siteMapUrl ? (
          <div className="space-y-2">
            <div className="relative rounded-lg border border-border overflow-hidden">
              <img src={siteMapUrl} alt="Site map" className="w-full h-auto max-h-48 object-contain bg-black/20" />
              {!isLocked && (
                <button type="button" onClick={handleSiteMapRemove}
                  className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-red-500/90 px-2 py-1 text-[10px] font-semibold text-white hover:bg-red-600 transition-colors">
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><MapPin size={10} /> Site map uploaded</p>
          </div>
        ) : (
          <div>
            {isLocked ? (
              <p className="text-xs text-muted-foreground italic">No site map uploaded.</p>
            ) : (
              <label className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/20 px-4 py-6 cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors">
                {uploadingSiteMap ? (
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                ) : (
                  <Upload size={20} className="text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">{uploadingSiteMap ? "Uploading..." : "Click to upload site map"}</span>
                <span className="text-[10px] text-muted-foreground/60">JPEG, PNG, SVG, or PDF</span>
                <input type="file" accept="image/*,application/pdf" className="hidden"
                  disabled={isLocked || uploadingSiteMap}
                  onChange={(e) => { if (e.target.files?.[0]) handleSiteMapUpload(e.target.files[0]); }} />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Scope */}
      <SectionHeader title="Scope" />
      <div className="space-y-2">
        <div><Label className="text-xs">Services Requested</Label><Chips field="servicesRequested" options={SERVICES_REQUESTED} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Deliverables</Label><Txt value={data.deliverables} onChange={(v) => upd("deliverables", v)} placeholder="e.g. Security plan, post-event report" rows={2} disabled={isLocked} /></div>
          <div><Label className="text-xs">Out of Scope</Label><Txt value={data.outOfScope} onChange={(v) => upd("outOfScope", v)} placeholder="What the company is NOT responsible for" rows={2} disabled={isLocked} /></div>
        </div>
      </div>

      {/* Comms & Equipment */}
      <SectionHeader title="Comms & Equipment" />
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Medical Capability</Label>
            <select value={data.medicalCapability} onChange={(e) => upd("medicalCapability", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              {MEDICAL_CAPABILITIES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Equipment Available</Label><Input value={data.equipmentAvailable} onChange={(e) => upd("equipmentAvailable", e.target.value)} placeholder="e.g. Radios, barriers, PPE" className="mt-1 h-8 text-sm" disabled={isLocked} /></div>
          <div><Label className="text-xs">Radio Channels</Label><Input value={(data as unknown as Record<string, string>).radioChannels ?? ""} onChange={(e) => setData(prev => ({ ...prev, radioChannels: e.target.value } as IntakeData))} placeholder="Ch 1: Cmd, Ch 2: Sec" className="mt-1 h-8 text-sm" disabled={isLocked} /></div>
        </div>
      </div>

      {/* Risks */}
      <SectionHeader title="Risks" />
      <div className="space-y-2">
        <div><Label className="text-xs">Client-Identified Risks</Label><Txt value={data.clientIdentifiedRisks} onChange={(v) => upd("clientIdentifiedRisks", v)} placeholder="Previous incidents, known bad actors" rows={1} disabled={isLocked} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Risk Level</Label>
            <select value={data.riskLevel} onChange={(e) => upd("riskLevel", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              {["Low", "Moderate", "High", "Critical"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div><Label className="text-xs">Threat Types</Label><Chips field="threatTypes" options={THREAT_TYPES} color="red" /></div>
        <div><Label className="text-xs">Constraints</Label><Chips field="constraints" options={CONSTRAINT_TYPES} color="amber" /></div>
      </div>

      {/* Command */}
      <SectionHeader title="Command" />
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Command Model</Label>
            <select value={data.commandModel} onChange={(e) => upd("commandModel", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              {COMMAND_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">Escalation Flow</Label>
            <select value={data.escalationFlow} onChange={(e) => upd("escalationFlow", e.target.value)} disabled={isLocked} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
              <option value="">Select...</option>
              <option value="Staff → Supervisor → Command">Staff → Supervisor → Command</option>
              <option value="Direct to Command">Direct to Command</option>
            </select>
          </div>
        </div>
        <div><Label className="text-xs">EA Role</Label><Chips field="eaRole" options={EA_ROLES} /></div>
      </div>

      {/* Success */}
      <SectionHeader title="Success" />
      <div className="space-y-2">
        <Chips field="successCriteria" options={SUCCESS_CRITERIA} color="green" />
        <div><Label className="text-xs">Additional Success Measures</Label><Txt value={data.additionalSuccessMeasures} onChange={(v) => upd("additionalSuccessMeasures", v)} placeholder="Any additional success metrics" rows={1} disabled={isLocked} /></div>
      </div>

      {/* Actions */}
      {(!isIssued || editOverride) && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}

export default IntakePanel;
