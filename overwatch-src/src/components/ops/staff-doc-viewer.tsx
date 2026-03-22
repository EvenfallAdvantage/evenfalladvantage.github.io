"use client";

import { X, FileText, Shield, AlertTriangle, Target, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OperationDocument, WarnoData, OpordData, FragoData, GotwaData, IntakeData } from "@/types/operations";

/* ── Helpers ── */
function Section({ title, icon, color, children }: { title: string; icon?: React.ReactNode; color?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/20 last:border-0">
      <div className={`px-4 py-2 bg-muted/30 flex items-center gap-2 ${color ?? ""}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (!value && value !== 0 && value !== false) return null;
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground text-xs min-w-[120px] shrink-0">{label}</span>
      <span className="text-xs">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</span>
    </div>
  );
}

function Chips({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(i => (
        <span key={i} className="rounded-md border border-border/40 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium">{i}</span>
      ))}
    </div>
  );
}

function Tasks({ items }: { items?: { text: string; checked: boolean }[] }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      {items.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className={`h-3.5 w-3.5 rounded border flex items-center justify-center text-[8px] ${t.checked ? "bg-green-500/20 border-green-500/40 text-green-600" : "border-border/40"}`}>
            {t.checked ? "✓" : ""}
          </span>
          <span className={t.checked ? "" : "text-muted-foreground"}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ── WARNO Viewer ── */
function WarnoViewer({ data }: { data: WarnoData }) {
  return (
    <>
      <Section title="Situation" icon={<Shield className="h-3.5 w-3.5" />}>
        <Field label="Overview" value={data.operationalOverview} />
        <Field label="Crowd / Density" value={data.crowdSizeDensity} />
        <Field label="Environment" value={data.environment} />
        <Field label="Known Concerns" value={data.knownConcerns} />
      </Section>
      <Section title="Mission" icon={<Target className="h-3.5 w-3.5" />}>
        <p className="text-xs">{data.missionStatement || "—"}</p>
      </Section>
      <Section title="Initial Tasks">
        <Tasks items={data.initialTasks} />
      </Section>
      <Section title="Timeline">
        <Field label="Assessment Start" value={data.assessmentStart} />
        <Field label="Key Milestones" value={data.keyMilestones} />
        <Field label="Deliverables Date" value={data.finalDeliverablesDate} />
      </Section>
      <Section title="Coordination" icon={<Radio className="h-3.5 w-3.5" />}>
        <Field label="Client POC" value={data.clientPoc} />
        <Field label="Company POC" value={data.eaPoc} />
        <Chips items={data.communicationMethod} />
      </Section>
      <Section title="Command & Control">
        <Chips items={data.eaRole} />
        <Field label="Client Authority" value={data.clientAuthority} />
      </Section>
    </>
  );
}

/* ── OPORD Viewer ── */
function OpordViewer({ data }: { data: OpordData }) {
  return (
    <>
      <Section title="1. Situation" icon={<Shield className="h-3.5 w-3.5" />}>
        <Chips items={data.venueType} />
        <Field label="Environment" value={data.environment} />
        <Field label="Attendance" value={data.estimatedAttendance} />
        <Field label="Risk Level" value={data.riskLevel} />
        {data.threatTypes?.length > 0 && <><span className="text-xs text-muted-foreground">Threats:</span><Chips items={data.threatTypes} /></>}
        {data.knownConstraints?.length > 0 && <><span className="text-xs text-muted-foreground">Constraints:</span><Chips items={data.knownConstraints} /></>}
      </Section>
      <Section title="2. Mission" icon={<Target className="h-3.5 w-3.5" />}>
        <p className="text-xs">{data.missionStatement || "—"}</p>
      </Section>
      <Section title="3. Execution">
        <Field label="Security Posture" value={data.securityPosture} />
        {data.operationalApproach?.length > 0 && <><span className="text-xs text-muted-foreground">Approach:</span><Chips items={data.operationalApproach} /></>}
        {data.primaryFocusAreas?.length > 0 && <><span className="text-xs text-muted-foreground">Focus Areas:</span><Chips items={data.primaryFocusAreas} /></>}
        <Field label="Entry Points" value={data.entryPoints} />
        <Field label="High-Risk Zones" value={data.highRiskZones} />
        <Field label="Restricted Areas" value={data.restrictedAreas} />
        {data.supervisorTasks?.length > 0 && <><span className="text-xs text-muted-foreground">Supervisor Tasks:</span><Chips items={data.supervisorTasks} /></>}
        {data.staffTasks?.length > 0 && <><span className="text-xs text-muted-foreground">Staff Tasks:</span><Chips items={data.staffTasks} /></>}
      </Section>
      <Section title="4. Support" icon={<Radio className="h-3.5 w-3.5" />}>
        <Field label="Medical" value={data.medicalCapability} />
        <Field label="Comms" value={data.communicationMethod} />
        <Field label="Radio Channels" value={data.radioChannels} />
        {data.equipment?.length > 0 && <><span className="text-xs text-muted-foreground">Equipment:</span><Chips items={data.equipment} /></>}
      </Section>
      <Section title="5. Command & Control">
        <Field label="Command Model" value={data.commandModel} />
        <Field label="ICS Established" value={data.icsEstablished} />
        <Field label="Overall Lead" value={data.overallLead} />
        <Field label="Supervisors" value={data.supervisors} />
        <Field label="Client Rep" value={data.clientRepresentative} />
        <Field label="Escalation" value={data.escalationFlow} />
      </Section>
      <Section title="6. Contingency (PACE)">
        <Field label="Primary" value={data.primaryPlan} />
        <Field label="Alternate" value={data.alternatePlan} />
        <Field label="Contingency" value={data.contingencyPlan} />
        <Field label="Emergency" value={data.emergencyPlan} />
        <Field label="Recovery" value={data.recoveryPlan} />
      </Section>
      <Section title="7. Timeline">
        <Field label="Op Start" value={data.operationalStart} />
        <Field label="Peak Periods" value={data.peakPeriods} />
        <Field label="Op End" value={data.operationalEnd} />
      </Section>
      {(data.successCriteria?.length > 0 || data.additionalSuccessMeasures) && (
        <Section title="8. Success Criteria">
          <Chips items={data.successCriteria} />
          <Field label="Notes" value={data.additionalSuccessMeasures} />
        </Section>
      )}
      {data.specialInstructions && (
        <Section title="9. Special Instructions">
          <p className="text-xs whitespace-pre-wrap">{data.specialInstructions}</p>
        </Section>
      )}
    </>
  );
}

/* ── FRAGO Viewer ── */
function FragoViewer({ data }: { data: FragoData }) {
  return (
    <>
      <Section title="Situation Update" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} color="text-amber-600">
        <Field label="FRAGO #" value={data.fragoNumber} />
        {data.whatChanged?.length > 0 && <><span className="text-xs text-muted-foreground">What Changed:</span><Chips items={data.whatChanged} /></>}
        <Field label="Description" value={data.changeDescription} />
        <Field label="Updated Risk" value={data.updatedRiskLevel} />
      </Section>
      <Section title="Mission">
        <Field label="Mission Changed" value={data.missionChanged} />
        {data.missionChanged && <p className="text-xs">{data.updatedMission || "—"}</p>}
      </Section>
      <Section title="Execution Changes">
        {data.updatedTasks?.length > 0 && <Chips items={data.updatedTasks} />}
        <Field label="Instructions" value={data.specificInstructions} />
        {data.areasAffected?.length > 0 && <><span className="text-xs text-muted-foreground">Areas Affected:</span><Chips items={data.areasAffected} /></>}
      </Section>
      <Section title="Support Changes">
        <Field label="Medical" value={data.medicalChange} />
        <Field label="Comms" value={data.commsChange} />
        <Field label="Equipment" value={data.equipmentChange} />
      </Section>
      <Section title="Command & Control">
        <Field label="Structure Change" value={data.structureChange} />
        <Field label="Updated Lead" value={data.updatedCommandLead} />
        <Field label="Updated Supervisors" value={data.updatedSupervisors} />
        <Field label="Escalation" value={data.escalationChange} />
      </Section>
      <Section title="Contingency">
        <Field label="Current Level" value={data.currentLevel} />
        <Field label="Action" value={data.actionBeingTaken} />
      </Section>
      <Section title="Timeline">
        <Field label="Effective Immediately" value={data.effectiveImmediately} />
        {!data.effectiveImmediately && <Field label="Effective Time" value={data.effectiveTime} />}
        <Field label="Duration" value={data.duration} />
      </Section>
    </>
  );
}

/* ── GOTWA Viewer ── */
function GotwaViewer({ data }: { data: GotwaData }) {
  return (
    <>
      <Section title="Going">
        <Field label="Area" value={data.area} />
        <Field label="Objective" value={data.objective} />
      </Section>
      <Section title="Others">
        <Field label="Personnel" value={data.personnelAssigned} />
        <Field label="Supervisor" value={data.supervisor} />
        <Field label="Support" value={data.supportElements} />
      </Section>
      <Section title="Time">
        <Field label="Start" value={data.startTime} />
        <Field label="Duration" value={data.expectedDuration} />
        <Field label="Return / Check-In" value={data.returnCheckInTime} />
      </Section>
      <Section title="What If" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        {data.primaryConcern?.length > 0 && <Chips items={data.primaryConcern} />}
        <Field label="Immediate Action" value={data.immediateAction} />
        <Field label="Escalation Trigger" value={data.escalationTrigger} />
      </Section>
      <Section title="Actions">
        <Field label="If No Issue" value={data.ifNoIssue} />
        <Field label="Notify" value={data.whoToNotify} />
        <Field label="Follow-On" value={data.followOnActions} />
      </Section>
      <Section title="Status & Comms" icon={<Radio className="h-3.5 w-3.5" />}>
        <Field label="Status" value={data.status} />
        <Chips items={data.communicationMethod} />
        <Field label="Channel" value={data.channel} />
        {data.notes && <p className="text-xs whitespace-pre-wrap text-muted-foreground">{data.notes}</p>}
      </Section>
    </>
  );
}

/* ── Intake Viewer ── */
function IntakeViewer({ data }: { data: IntakeData }) {
  return (
    <>
      <Section title="Mission Overview" icon={<Target className="h-3.5 w-3.5" />}>
        <Chips items={data.engagementType} />
        <Field label="Client Request" value={data.clientRequest} />
        <Field label="Mission Statement" value={data.missionStatement} />
        <Field label="Time Sensitivity" value={data.timeSensitivity} />
      </Section>
      <Section title="Location & Environment">
        <Chips items={data.venueType} />
        <Field label="Attendance" value={data.estimatedAttendance} />
        <Field label="Environment" value={data.environment} />
        <Field label="Notes" value={data.environmentNotes} />
      </Section>
      <Section title="Scope of Work">
        <Chips items={data.servicesRequested} />
        <Field label="Deliverables" value={data.deliverables} />
        <Field label="Out of Scope" value={data.outOfScope} />
      </Section>
      <Section title="Client Capability">
        <Field label="Personnel Count" value={data.clientPersonnelCount} />
        <Field label="Leadership" value={data.clientLeadershipStructure} />
        <Field label="Existing SOPs" value={data.clientExistingSops} />
        <Field label="Incident Reporting" value={data.clientIncidentReporting} />
        <Field label="Training Level" value={data.clientTrainingLevel} />
        <Field label="Equipment" value={data.equipmentAvailable} />
        <Field label="Medical" value={data.medicalCapability} />
        <Field label="Technology" value={data.technologyAvailable} />
      </Section>
      <Section title="Risks & Constraints" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        <Field label="Client Risks" value={data.clientIdentifiedRisks} />
        <Field label="EA Assessment" value={data.eaRiskAssessment} />
        <Field label="Risk Level" value={data.riskLevel} />
        {data.threatTypes?.length > 0 && <><span className="text-xs text-muted-foreground">Threats:</span><Chips items={data.threatTypes} /></>}
        {data.constraints?.length > 0 && <><span className="text-xs text-muted-foreground">Constraints:</span><Chips items={data.constraints} /></>}
      </Section>
      <Section title="Command & Control">
        <Field label="Command Model" value={data.commandModel} />
        <Field label="On-Site Authority" value={data.onSiteAuthority} />
        <Chips items={data.eaRole} />
        <Field label="Escalation" value={data.escalationFlow} />
        <Field label="Chain of Command" value={data.chainOfCommand} />
      </Section>
      {(data.successCriteria?.length > 0 || data.additionalSuccessMeasures) && (
        <Section title="Success Criteria">
          <Chips items={data.successCriteria} />
          <Field label="Additional" value={data.additionalSuccessMeasures} />
        </Section>
      )}
    </>
  );
}

/* ── Doc type styling ── */
const DOC_COLORS: Record<string, { border: string; bg: string; text: string; label: string }> = {
  warno: { border: "border-primary/40", bg: "bg-primary/5", text: "text-primary", label: "WARNO" },
  opord: { border: "border-green-500/40", bg: "bg-green-500/5", text: "text-green-600", label: "OPORD" },
  frago: { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-600", label: "FRAGO" },
  gotwa: { border: "border-violet-500/40", bg: "bg-violet-500/5", text: "text-violet-500", label: "GOTWA" },
  intake: { border: "border-blue-500/40", bg: "bg-blue-500/5", text: "text-blue-500", label: "Intake" },
};

/* ── Main Exports ── */

/** Popup list of docs for an event */
export function DocsPopup({
  docs,
  onViewDoc,
  onClose,
}: {
  docs: OperationDocument[];
  onViewDoc: (doc: OperationDocument) => void;
  onClose: () => void;
}) {
  // Show issued docs of all types (including intake)
  const visibleDocs = docs.filter(d => d.status === "issued" || d.doc_type === "intake");

  return (
    <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
      </div>
      {visibleDocs.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground text-center">No documents yet</p>
      ) : (
        <div className="py-1">
          {visibleDocs.map(d => {
            const c = DOC_COLORS[d.doc_type] ?? DOC_COLORS.intake;
            return (
              <button key={d.id} onClick={() => onViewDoc(d)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors text-left">
                <FileText className={`h-3.5 w-3.5 ${c.text}`} />
                <span>{c.label}{d.doc_type !== "intake" ? ` v${d.version}` : ""}</span>
                {d.issued_at && <span className="text-[9px] text-muted-foreground ml-auto">{new Date(d.issued_at).toLocaleDateString()}</span>}
                {!d.issued_at && d.updated_at && <span className="text-[9px] text-muted-foreground ml-auto">{new Date(d.updated_at).toLocaleDateString()}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Full-screen modal to view a document read-only */
export function DocViewerModal({
  doc,
  onClose,
}: {
  doc: OperationDocument;
  onClose: () => void;
}) {
  const c = DOC_COLORS[doc.doc_type] ?? DOC_COLORS.intake;
  const data = doc.data as Record<string, unknown>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b border-border/30 ${c.bg}`}>
          <div className="flex items-center gap-2">
            <FileText className={`h-4 w-4 ${c.text}`} />
            <span className={`text-sm font-bold ${c.text}`}>{c.label}</span>
            <span className="text-xs text-muted-foreground">v{doc.version}</span>
            {doc.issued_at && <span className="text-[10px] text-muted-foreground">· Issued {new Date(doc.issued_at).toLocaleDateString()}</span>}
          </div>
          <Button size="sm" variant="ghost" className="h-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {doc.doc_type === "warno" && <WarnoViewer data={data as unknown as WarnoData} />}
          {doc.doc_type === "opord" && <OpordViewer data={data as unknown as OpordData} />}
          {doc.doc_type === "frago" && <FragoViewer data={data as unknown as FragoData} />}
          {doc.doc_type === "gotwa" && <GotwaViewer data={data as unknown as GotwaData} />}
          {doc.doc_type === "intake" && <IntakeViewer data={data as unknown as IntakeData} />}
        </div>
      </div>
    </div>
  );
}
