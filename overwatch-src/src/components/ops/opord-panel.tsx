"use client";

import { useState, useEffect, useRef } from "react";
import { FileText, Send, Loader2, Check, X, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLatestDocument, createDocument, updateDocument, issueDocument, updateTlpStep,
} from "@/lib/supabase/db";
import type { OpordData, OperationDocument } from "@/types/operations";

const VENUE_TYPES = ["Bar / Nightclub", "Festival / Outdoor Event", "Corporate / Office", "Private Property", "Mixed-Use", "Warehouse / Industrial", "Retail"];
const THREAT_TYPES = ["Crowd Surge", "Disorderly Conduct / Fights", "Medical Emergencies", "Unauthorized Access", "Theft", "Environmental"];
const OPS_APPROACHES = ["Visible deterrence", "Access control", "Roving patrol", "Static posts", "Undercover observation", "Crowd management"];
const FOCUS_AREAS = ["Entry / Exit points", "VIP areas", "Crowd gathering zones", "Alcohol service areas", "Parking / Transit areas", "Backstage / Restricted"];
const EQUIPMENT_LIST = ["Radios", "Flashlights", "Body cameras", "First aid kits", "Barriers / Stanchions", "PPE", "Signage"];
const COMMAND_MODELS = ["Single Supervisor", "Tiered Leadership", "ICS-Aligned"];
const SUCCESS_OPTIONS = ["No major incidents", "Controlled crowd flow", "Effective incident response", "Clear communication maintained", "Client satisfaction"];

function Txt({ value, onChange, placeholder, rows = 2, disabled }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; disabled?: boolean }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y disabled:opacity-60" />
  );
}

const EMPTY_OPORD: OpordData = {
  preparedBy: "", version: "1.0",
  venueType: [], environment: "", estimatedAttendance: "", threatTypes: [], riskLevel: "", knownConstraints: [],
  missionStatement: "",
  securityPosture: "", operationalApproach: [], primaryFocusAreas: [], entryPoints: "", highRiskZones: "", restrictedAreas: "",
  supervisorTasks: [], staffTasks: [],
  medicalCapability: "", communicationMethod: "", radioChannels: "", equipment: [],
  commandModel: "", icsEstablished: false, overallLead: "", supervisors: "", clientRepresentative: "", escalationFlow: "",
  primaryPlan: "", alternatePlan: "", contingencyPlan: "", emergencyPlan: "", recoveryPlan: "",
  operationalStart: "", peakPeriods: "", operationalEnd: "",
  successCriteria: [], additionalSuccessMeasures: "",
  specialInstructions: "",
};

interface OpordPanelProps {
  eventId: string;
  companyId: string;
  eventName: string;
  eventStart: string;
  eventEnd: string;
  eventLocation: string;
  companyName: string;
  companyLogo?: string;
  brandColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  intakeData?: Record<string, any> | null;
  onClose: () => void;
  onIssued?: () => void;
}

export default function OpordPanel({ eventId, companyId, eventName, eventStart, eventEnd, eventLocation, companyName, companyLogo, brandColor, intakeData, onClose, onIssued }: OpordPanelProps) {
  const [doc, setDoc] = useState<OperationDocument | null>(null);
  const [data, setData] = useState<OpordData>({ ...EMPTY_OPORD });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const existing = await getLatestDocument(eventId, "opord");
        if (existing) {
          setDoc(existing);
          setData({ ...EMPTY_OPORD, ...(existing.data as Partial<OpordData>) });
        } else if (intakeData) {
          // Build venue type from both intake venueType[] and ops_guide siteType
          const venues: string[] = [];
          if (Array.isArray(intakeData.venueType) && intakeData.venueType.length > 0) venues.push(...intakeData.venueType);
          else if (intakeData.siteType) venues.push(intakeData.siteType);
          // Build equipment from both sources
          const equip: string[] = [];
          if (intakeData.requiredGear) equip.push(...intakeData.requiredGear.split(",").map((s: string) => s.trim()).filter(Boolean));
          if (intakeData.equipmentAvailable) equip.push(...intakeData.equipmentAvailable.split(",").map((s: string) => s.trim()).filter(Boolean));
          // Build engagement description for mission
          const engTypes = Array.isArray(intakeData.engagementType) ? intakeData.engagementType.join(", ") : (intakeData.engagementType || "");
          setData(prev => ({
            ...prev,
            venueType: venues,
            environment: intakeData.environment || "",
            estimatedAttendance: intakeData.estimatedAttendance || "",
            threatTypes: intakeData.threatTypes || [],
            riskLevel: intakeData.riskLevel || "",
            knownConstraints: intakeData.constraints || [],
            missionStatement: intakeData.missionStatement || `${companyName} will provide ${engTypes || "security services"} for ${intakeData.clientName || "client"} at ${eventLocation || intakeData.siteAddress || "TBD"} in order to ensure safe, controlled operations.`,
            medicalCapability: intakeData.medicalCapability || "",
            communicationMethod: intakeData.communicationChannel || "",
            radioChannels: intakeData.radioChannels || "",
            equipment: equip.length > 0 ? equip : prev.equipment,
            commandModel: intakeData.commandModel || "",
            escalationFlow: intakeData.escalationFlow || "",
            clientRepresentative: intakeData.clientContact || "",
            successCriteria: intakeData.successCriteria || [],
            additionalSuccessMeasures: intakeData.additionalSuccessMeasures || "",
            specialInstructions: intakeData.specialInstructions || "",
            operationalStart: eventStart ? new Date(eventStart).toLocaleString() : "",
            operationalEnd: eventEnd ? new Date(eventEnd).toLocaleString() : "",
          }));
          // Auto-run geo-risk assessment if location available and no threat types from intake
          if ((!intakeData.threatTypes || intakeData.threatTypes.length === 0) && (eventLocation || intakeData.siteAddress)) {
            (async () => {
              try {
                const { geocodeAddress, getMultiTierCrimeData, calculateRiskScore } = await import("@/lib/geo-risk-data");
                const loc = eventLocation || intakeData.siteAddress || "";
                // Parse "City, State" or full address
                const parts = loc.split(",").map((s: string) => s.trim());
                const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
                const stateRaw = parts.length >= 2 ? parts[parts.length - 1].replace(/\d+/g, "").trim() : "";
                if (city) {
                  const geo = await geocodeAddress(loc, city, stateRaw);
                  const crime = await getMultiTierCrimeData(geo.city || city, geo.county, geo.state || stateRaw);
                  const score = calculateRiskScore(crime.violent, crime.property, venues[0] || "Event Venue / Arena");
                  // Map crime data to threat types
                  const autoThreats: string[] = [];
                  if (crime.violent >= 600) autoThreats.push("Disorderly Conduct / Fights");
                  if (crime.violent >= 400) autoThreats.push("Medical Emergencies");
                  if (crime.property >= 3000) autoThreats.push("Theft");
                  if (crime.violent >= 800) autoThreats.push("Crowd Surge");
                  autoThreats.push("Unauthorized Access"); // always relevant for security ops
                  // Set risk level from geo data if not already set
                  const autoRisk = score >= 75 ? "Critical" : score >= 55 ? "High" : score >= 35 ? "Moderate" : "Low";
                  setData(prev => ({
                    ...prev,
                    threatTypes: prev.threatTypes.length > 0 ? prev.threatTypes : autoThreats,
                    riskLevel: prev.riskLevel || autoRisk,
                  }));
                }
              } catch (err) { console.error("Geo-risk auto-assessment:", err); }
            })();
          }
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId, intakeData, eventName, eventLocation, eventStart, eventEnd, companyName]);

  function upd<K extends keyof OpordData>(field: K, value: OpordData[K]) {
    setData(prev => ({ ...prev, [field]: value }));
  }

  function toggle(field: keyof OpordData, val: string) {
    const arr = data[field] as string[];
    upd(field as keyof OpordData, (arr.includes(val) ? arr.filter((v: string) => v !== val) : [...arr, val]) as OpordData[keyof OpordData]);
  }

  function toggleSection(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (doc) {
        await updateDocument(doc.id, { data: data as unknown as Record<string, unknown> });
      } else {
        const created = await createDocument({ eventId, companyId, docType: "opord", data: data as unknown as Record<string, unknown> });
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
        const created = await createDocument({ eventId, companyId, docType: "opord", data: data as unknown as Record<string, unknown> });
        docId = created.id;
        setDoc(created);
      } else {
        await updateDocument(docId, { data: data as unknown as Record<string, unknown> });
      }
      await issueDocument(docId);
      await updateTlpStep(eventId, "complete_plan");
      setDoc(prev => prev ? { ...prev, status: "issued" } : prev);
      onIssued?.();
    } catch (err) { console.error(err); }
    finally { setIssuing(false); }
  }

  async function handlePdf() {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          // Strip CSS custom properties using unsupported color functions (lab, oklch, etc.)
          const root = clonedDoc.documentElement;
          const rootStyle = root.style;
          for (let i = rootStyle.length - 1; i >= 0; i--) {
            const prop = rootStyle[i];
            const val = rootStyle.getPropertyValue(prop);
            if (val && (/\blab\s*\(/.test(val) || /\boklch\s*\(/.test(val) || /\blch\s*\(/.test(val))) {
              rootStyle.removeProperty(prop);
            }
          }
          // Also strip from any <style> tags
          clonedDoc.querySelectorAll("style").forEach((el) => {
            if (el.textContent && (/\blab\s*\(/.test(el.textContent) || /\boklch\s*\(/.test(el.textContent))) {
              el.textContent = el.textContent.replace(/[^;{}]*\b(lab|oklch|lch)\s*\([^)]*\)[^;{}]*/g, "");
            }
          });
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      let yOff = 10;
      if (imgH <= pageH - 20) {
        pdf.addImage(imgData, "PNG", 10, yOff, imgW, imgH);
      } else {
        let remaining = imgH;
        while (remaining > 0) {
          pdf.addImage(imgData, "PNG", 10, yOff, imgW, imgH);
          remaining -= (pageH - 20);
          if (remaining > 0) { pdf.addPage(); yOff = -(imgH - remaining) + 10; }
        }
      }
      pdf.save(`OPORD_${eventName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) { console.error(err); }
    finally { setGenerating(false); }
  }

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-6 flex justify-center border-b border-border/20 bg-primary/[0.02]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isIssued = doc?.status === "issued";

  function SectionHeader({ id, title }: { id: string; title: string }) {
    return (
      <button type="button" onClick={() => toggleSection(id)} className="flex items-center justify-between w-full pt-2 border-t border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        {collapsed[id] ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
      </button>
    );
  }

  function Chips({ field, options, color = "primary" }: { field: keyof OpordData; options: string[]; color?: string }) {
    const arr = data[field] as string[];
    const colorClass = color === "red" ? "border-red-500/60 bg-red-500/10 text-red-500" : color === "green" ? "border-green-500/60 bg-green-500/10 text-green-600" : "border-primary bg-primary/10 text-primary";
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map(t => (
          <button key={t} type="button" onClick={() => !isIssued && toggle(field, t)}
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
          <span className="text-xs font-semibold uppercase tracking-wider">OPERATION ORDER (OPORD)</span>
          {isIssued && <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold bg-green-500/15 text-green-600"><Check className="h-2.5 w-2.5" /> Issued</span>}
          {doc && !isIssued && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/15 text-amber-600">Draft v{doc.version}</span>}
        </div>
        <div className="flex items-center gap-1">
          {doc && (
            <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={handlePdf} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Header fields */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label className="text-xs">Prepared By</Label><Input value={data.preparedBy} onChange={(e) => upd("preparedBy", e.target.value)} placeholder="Your name" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        <div><Label className="text-xs">Version</Label><Input value={data.version} onChange={(e) => upd("version", e.target.value)} placeholder="1.0" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
      </div>

      {/* 1. Situation */}
      <SectionHeader id="situation" title="1. Situation" />
      {!collapsed.situation && (
        <div className="space-y-2">
          <div><Label className="text-xs">Venue Type</Label><Chips field="venueType" options={VENUE_TYPES} /></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div><Label className="text-xs">Environment</Label><Input value={data.environment} onChange={(e) => upd("environment", e.target.value)} placeholder="Indoor / Outdoor / Hybrid" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Est. Attendance</Label><Input value={data.estimatedAttendance} onChange={(e) => upd("estimatedAttendance", e.target.value)} placeholder="e.g. 500" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Risk Level</Label>
              <select value={data.riskLevel} onChange={(e) => upd("riskLevel", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
                <option value="">Select...</option>
                {["Low", "Moderate", "High", "Critical"].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div><Label className="text-xs">Threat Types</Label><Chips field="threatTypes" options={THREAT_TYPES} color="red" /></div>
        </div>
      )}

      {/* 2. Mission */}
      <SectionHeader id="mission" title="2. Mission" />
      {!collapsed.mission && (
        <div><Txt value={data.missionStatement} onChange={(v) => upd("missionStatement", v)} placeholder={`${companyName} will provide [service] for [client] at [location] in order to [purpose].`} rows={2} disabled={isIssued} /></div>
      )}

      {/* 3. Execution */}
      <SectionHeader id="execution" title="3. Execution" />
      {!collapsed.execution && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label className="text-xs">Security Posture</Label>
              <select value={data.securityPosture} onChange={(e) => upd("securityPosture", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
                <option value="">Select...</option>
                <option value="Low Visibility">Low Visibility</option>
                <option value="High Visibility">High Visibility</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div><Label className="text-xs">Operational Approach</Label><Chips field="operationalApproach" options={OPS_APPROACHES} /></div>
          <div><Label className="text-xs">Primary Focus Areas</Label><Chips field="primaryFocusAreas" options={FOCUS_AREAS} /></div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div><Label className="text-xs">Entry Points</Label><Input value={data.entryPoints} onChange={(e) => upd("entryPoints", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">High-Risk Zones</Label><Input value={data.highRiskZones} onChange={(e) => upd("highRiskZones", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Restricted Areas</Label><Input value={data.restrictedAreas} onChange={(e) => upd("restrictedAreas", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          </div>
        </div>
      )}

      {/* 4. Support */}
      <SectionHeader id="support" title="4. Support" />
      {!collapsed.support && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><Label className="text-xs">Medical Capability</Label>
              <select value={data.medicalCapability} onChange={(e) => upd("medicalCapability", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
                <option value="">Select...</option>
                {["None", "Basic First Aid", "STOP THE BLEED\u00ae", "EMS On-site"].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Comms Method</Label><Input value={data.communicationMethod} onChange={(e) => upd("communicationMethod", e.target.value)} placeholder="e.g. Radio + WhatsApp" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Radio Channels</Label><Input value={data.radioChannels} onChange={(e) => upd("radioChannels", e.target.value)} placeholder="Ch 1: Cmd, Ch 2: Sec" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          </div>
          <div><Label className="text-xs">Equipment</Label><Chips field="equipment" options={EQUIPMENT_LIST} /></div>
        </div>
      )}

      {/* 5. Command & Control */}
      <SectionHeader id="c2" title="5. Command & Control" />
      {!collapsed.c2 && (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <div><Label className="text-xs">Command Model</Label>
              <select value={data.commandModel} onChange={(e) => upd("commandModel", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
                <option value="">Select...</option>
                {COMMAND_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><Label className="text-xs">Overall Lead</Label><Input value={data.overallLead} onChange={(e) => upd("overallLead", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Client Rep</Label><Input value={data.clientRepresentative} onChange={(e) => upd("clientRepresentative", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label className="text-xs">Supervisors</Label><Input value={data.supervisors} onChange={(e) => upd("supervisors", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
            <div><Label className="text-xs">Escalation Flow</Label>
              <select value={data.escalationFlow} onChange={(e) => upd("escalationFlow", e.target.value)} disabled={isIssued} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm disabled:opacity-60">
                <option value="">Select...</option>
                <option value="Staff → Supervisor → Command">Staff → Supervisor → Command</option>
                <option value="Direct to Command">Direct to Command</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 6. Contingency */}
      <SectionHeader id="contingency" title="6. Contingency (PACE)" />
      {!collapsed.contingency && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label className="text-xs">Primary Plan</Label><Txt value={data.primaryPlan} onChange={(v) => upd("primaryPlan", v)} placeholder="Standard operations continue as planned" rows={1} disabled={isIssued} /></div>
          <div><Label className="text-xs">Alternate Plan</Label><Txt value={data.alternatePlan} onChange={(v) => upd("alternatePlan", v)} placeholder="Adjust posture or redistribute personnel" rows={1} disabled={isIssued} /></div>
          <div><Label className="text-xs">Contingency Plan</Label><Txt value={data.contingencyPlan} onChange={(v) => upd("contingencyPlan", v)} placeholder="Activate contingency team, notify command" rows={1} disabled={isIssued} /></div>
          <div><Label className="text-xs">Emergency Plan</Label><Txt value={data.emergencyPlan} onChange={(v) => upd("emergencyPlan", v)} placeholder="Full activation, coordinate with EMS/LE" rows={1} disabled={isIssued} /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Recovery Plan</Label><Txt value={data.recoveryPlan} onChange={(v) => upd("recoveryPlan", v)} placeholder="Post-incident debrief, AAR, resume normal ops" rows={1} disabled={isIssued} /></div>
        </div>
      )}

      {/* 7. Timeline */}
      <SectionHeader id="timeline" title="7. Timeline" />
      {!collapsed.timeline && (
        <div className="grid gap-2 sm:grid-cols-3">
          <div><Label className="text-xs">Operational Start</Label><Input value={data.operationalStart} onChange={(e) => upd("operationalStart", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Peak Periods</Label><Input value={data.peakPeriods} onChange={(e) => upd("peakPeriods", e.target.value)} placeholder="e.g. 2100–0100" className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
          <div><Label className="text-xs">Operational End</Label><Input value={data.operationalEnd} onChange={(e) => upd("operationalEnd", e.target.value)} className="mt-1 h-8 text-sm" disabled={isIssued} /></div>
        </div>
      )}

      {/* 8. Success Criteria */}
      <SectionHeader id="success" title="8. Success Criteria" />
      {!collapsed.success && (
        <div className="space-y-2">
          <Chips field="successCriteria" options={SUCCESS_OPTIONS} color="green" />
          <div><Label className="text-xs">Additional Measures</Label><Txt value={data.additionalSuccessMeasures} onChange={(v) => upd("additionalSuccessMeasures", v)} placeholder="Any additional success metrics" rows={1} disabled={isIssued} /></div>
        </div>
      )}

      {/* 9. Notes */}
      <SectionHeader id="notes" title="9. Special Instructions / Notes" />
      {!collapsed.notes && (
        <div><Txt value={data.specialInstructions} onChange={(v) => upd("specialInstructions", v)} placeholder="VIP details, restricted areas, weather contingencies..." rows={2} disabled={isIssued} /></div>
      )}

      {/* Actions */}
      {!isIssued && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/20">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />} Save Draft
          </Button>
          <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleIssue} disabled={issuing || !data.missionStatement.trim()}>
            {issuing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Issue OPORD
          </Button>
        </div>
      )}

      {/* Hidden printable OPORD for PDF */}
      <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
        <div ref={printRef} style={{ width: "794px", fontFamily: "system-ui, sans-serif", color: "#1a1a2e", background: "#fff", padding: "32px", lineHeight: 1.5 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${brandColor}`, paddingBottom: "16px", marginBottom: "24px" }}>
            <div>
              {companyLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyLogo} alt="logo" style={{ height: "40px", marginBottom: "8px" }} />
              )}
              <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: brandColor }}>{companyName}</h1>
              <p style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#666", margin: "2px 0 0" }}>Operation Order (OPORD)</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>{eventName}</h2>
              <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>{eventLocation}</p>
              <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>v{data.version} — Prepared by {data.preparedBy || "N/A"}</p>
            </div>
          </div>

          {/* Mission */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Mission</h3>
            <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{data.missionStatement || "—"}</p>
          </div>

          {/* Situation */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Situation</h3>
            <div style={{ display: "flex", fontSize: "12px", gap: "24px", flexWrap: "wrap" }}>
              {data.venueType.length > 0 && <span><strong>Venue:</strong> {data.venueType.join(", ")}</span>}
              {data.environment && <span><strong>Environment:</strong> {data.environment}</span>}
              {data.estimatedAttendance && <span><strong>Attendance:</strong> {data.estimatedAttendance}</span>}
              {data.riskLevel && <span><strong>Risk:</strong> {data.riskLevel}</span>}
            </div>
            {data.threatTypes.length > 0 && <p style={{ fontSize: "11px", marginTop: "4px" }}><strong>Threats:</strong> {data.threatTypes.join(", ")}</p>}
          </div>

          {/* Execution */}
          {(data.securityPosture || data.operationalApproach.length > 0) && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Execution</h3>
              {data.securityPosture && <p style={{ fontSize: "12px" }}><strong>Posture:</strong> {data.securityPosture}</p>}
              {data.operationalApproach.length > 0 && <p style={{ fontSize: "12px" }}><strong>Approach:</strong> {data.operationalApproach.join(", ")}</p>}
              {data.primaryFocusAreas.length > 0 && <p style={{ fontSize: "12px" }}><strong>Focus Areas:</strong> {data.primaryFocusAreas.join(", ")}</p>}
            </div>
          )}

          {/* Command & Control */}
          {(data.commandModel || data.overallLead) && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Command & Control</h3>
              {data.commandModel && <p style={{ fontSize: "12px" }}><strong>Model:</strong> {data.commandModel}</p>}
              {data.overallLead && <p style={{ fontSize: "12px" }}><strong>Lead:</strong> {data.overallLead}</p>}
              {data.escalationFlow && <p style={{ fontSize: "12px" }}><strong>Escalation:</strong> {data.escalationFlow}</p>}
            </div>
          )}

          {/* Timeline */}
          {(data.operationalStart || data.operationalEnd) && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Timeline</h3>
              <p style={{ fontSize: "12px" }}><strong>Start:</strong> {data.operationalStart} | <strong>Peak:</strong> {data.peakPeriods || "N/A"} | <strong>End:</strong> {data.operationalEnd}</p>
            </div>
          )}

          {/* Special Instructions */}
          {data.specialInstructions && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: brandColor, borderBottom: `1px solid ${brandColor}33`, paddingBottom: "4px", marginBottom: "8px" }}>Special Instructions</h3>
              <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{data.specialInstructions}</p>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `2px solid ${brandColor}`, marginTop: "24px", paddingTop: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "10px", color: "#888" }}>CONFIDENTIAL — {companyName} — Generated {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
