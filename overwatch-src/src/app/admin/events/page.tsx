"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Flag, MapPin, Plus, Loader2, Clock, ChevronDown, ChevronRight,
  Trash2, Zap, Calendar, Check, X, FileText, FileDown, Eye,
  Shield, Shirt, AlertTriangle, Building2, Activity, ClipboardList, LogIn, LogOut as LogOutIcon,
  List, LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import {
  getEvents, createEvent, getEventShifts, createShift,
  getCompanyMembers, deleteEvent, deleteShift, updateEventStatus,
  assignShift, getConflictingShifts, getOperationActivity,
  createDocument, getEventAvailability, getLatestDocument,
} from "@/lib/supabase/db";
import type { OperationAvailability } from "@/lib/supabase/db-availability";
import type { IntakeData } from "@/types/operations";
import type { ActivityItem } from "@/lib/supabase/db-operations";
import TlpTracker from "@/components/ops/tlp-tracker";
import WarnoPanel from "@/components/ops/warno-panel";
import OpordPanel from "@/components/ops/opord-panel";
import FragoPanel from "@/components/ops/frago-panel";
import GotwaPanel from "@/components/ops/gotwa-panel";
import DocHub from "@/components/ops/doc-hub";
import type { TlpStep } from "@/types/operations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Event = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

/* ── OPs Guide Type ──────────────────────────────────── */

type OpsGuide = {
  clientName: string;
  clientContact: string;
  clientPhone: string;
  clientEmail: string;
  siteAddress: string;
  siteType: string;
  scope: string;
  postOrders: string;
  dressCode: string;
  requiredGear: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyProcedure: string;
  communicationChannel: string;
  reportingInstructions: string;
  specialInstructions: string;
  parkingInfo: string;
  checkInProcedure: string;
};

const EMPTY_GUIDE: OpsGuide = {
  clientName: "", clientContact: "", clientPhone: "", clientEmail: "",
  siteAddress: "", siteType: "", scope: "", postOrders: "",
  dressCode: "", requiredGear: "",
  emergencyContact: "", emergencyPhone: "", emergencyProcedure: "",
  communicationChannel: "", reportingInstructions: "",
  specialInstructions: "", parkingInfo: "", checkInProcedure: "",
};

const SITE_TYPES = ["Corporate", "Retail", "Warehouse", "Residential", "Construction", "Event/Festival", "Government", "Healthcare", "Education", "Other"];
const DRESS_CODES = ["Full Uniform (Company branded)", "Business Casual", "All Black", "Suit & Tie", "Tactical / BDU", "Client-Provided Uniform", "Plain Clothes", "Other"];

const ENGAGEMENT_TYPES = ["Event Security", "Executive Protection", "Consulting / Assessment", "Recurring Contract", "Loss Prevention", "Training", "Other"];
const VENUE_TYPES = ["Bar / Nightclub", "Festival / Outdoor Event", "Corporate / Office", "Private Property", "Mixed-Use", "Warehouse / Industrial", "Retail", "Other"];
const THREAT_TYPES = ["Crowd Surge", "Disorderly Conduct / Fights", "Medical Emergencies", "Unauthorized Access", "Theft", "Environmental (weather, terrain)", "Other"];
const SERVICES_REQUESTED = ["Access Control", "Crowd Management", "Patrol", "Executive Protection", "Risk Assessment", "Training", "Consulting", "Event Security", "Other"];
const CONSTRAINT_TYPES = ["Budget", "Staffing", "Legal / Licensing", "Venue Restrictions", "Time"];
const MEDICAL_CAPABILITIES = ["None", "Basic First Aid", "STOP THE BLEED®", "EMS On-site"];
const COMMAND_MODELS = ["Single Supervisor", "Tiered Leadership", "ICS-Aligned"];
const COMPANY_ROLES = ["Advisory", "Planning", "Operational Support", "Training"];
const SUCCESS_CRITERIA_OPTIONS = ["No major incidents", "Controlled crowd flow", "Effective incident response", "Clear communication maintained", "Client satisfaction"];

/* ── Helpers ───────────────────────────────────────────── */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const cur = new Date(s);
  while (cur <= e) { days.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate() + 1); }
  return days;
}

const PATTERNS: Record<string, { label: string; sH: number; sM: number; eH: number; eM: number; overnight: boolean }[]> = {
  "8": [
    { label: "Day",   sH: 6,  sM: 0, eH: 14, eM: 0, overnight: false },
    { label: "Swing", sH: 14, sM: 0, eH: 22, eM: 0, overnight: false },
    { label: "Night", sH: 22, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
  "12": [
    { label: "Day",   sH: 6,  sM: 0, eH: 18, eM: 0, overnight: false },
    { label: "Night", sH: 18, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
};

function toISO(dateStr: string, h: number, m: number, nextDay: boolean) {
  const d = new Date(dateStr + "T00:00:00");
  if (nextDay) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const m = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const day = new Date(sh.start_time).toISOString().split("T")[0];
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(sh);
  }
  return m;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

/* ── OPs Guide Preview (Branded) ──────────────────────── */

function OpsGuidePreview({ ev, guide, companyName, companyLogo, brandColor }: {
  ev: Event; guide: OpsGuide; companyName: string; companyLogo?: string; brandColor: string;
}) {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#1a1a2e", background: "#fff", padding: "32px", maxWidth: "800px", lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `3px solid ${brandColor}`, paddingBottom: "16px", marginBottom: "24px" }}>
        <div>
          {companyLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogo} alt="logo" style={{ height: "40px", marginBottom: "8px" }} />
          )}
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: brandColor }}>{companyName}</h1>
          <p style={{ fontSize: "10px", letterSpacing: "2px", textTransform: "uppercase", color: "#666", margin: "2px 0 0" }}>Operations Guide</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>{ev.name}</h2>
          <p style={{ fontSize: "12px", color: "#666", margin: "2px 0 0" }}>
            {fmtDateShort(ev.start_date)} — {fmtDateShort(ev.end_date)}
          </p>
          <p style={{ fontSize: "11px", color: "#888", margin: "2px 0 0" }}>{ev.location ?? guide.siteAddress}</p>
        </div>
      </div>

      {/* Sections */}
      {guide.clientName && (
        <Section title="Client Information" color={brandColor}>
          <Row label="Client" value={guide.clientName} />
          {guide.clientContact && <Row label="Contact" value={guide.clientContact} />}
          {guide.clientPhone && <Row label="Phone" value={guide.clientPhone} />}
          {guide.clientEmail && <Row label="Email" value={guide.clientEmail} />}
        </Section>
      )}

      <Section title="Site Details" color={brandColor}>
        {guide.siteAddress && <Row label="Address" value={guide.siteAddress} />}
        {guide.siteType && <Row label="Site Type" value={guide.siteType} />}
        {guide.parkingInfo && <Row label="Parking" value={guide.parkingInfo} />}
        {guide.checkInProcedure && <Row label="Check-In" value={guide.checkInProcedure} />}
      </Section>

      {guide.scope && (
        <Section title="Scope of Work" color={brandColor}>
          <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{guide.scope}</p>
        </Section>
      )}

      {guide.postOrders && (
        <Section title="Post Orders" color={brandColor}>
          <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{guide.postOrders}</p>
        </Section>
      )}

      <Section title="Uniform & Equipment" color={brandColor}>
        {guide.dressCode && <Row label="Dress Code" value={guide.dressCode} />}
        {guide.requiredGear && <Row label="Required Gear" value={guide.requiredGear} />}
      </Section>

      {guide.communicationChannel && (
        <Section title="Communications" color={brandColor}>
          <Row label="Channel" value={guide.communicationChannel} />
          {guide.reportingInstructions && <Row label="Reporting" value={guide.reportingInstructions} />}
        </Section>
      )}

      <Section title="Emergency Procedures" color={brandColor}>
        {guide.emergencyContact && <Row label="Contact" value={guide.emergencyContact} />}
        {guide.emergencyPhone && <Row label="Phone" value={guide.emergencyPhone} />}
        {guide.emergencyProcedure && <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{guide.emergencyProcedure}</p>}
      </Section>

      {guide.specialInstructions && (
        <Section title="Special Instructions" color={brandColor}>
          <p style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}>{guide.specialInstructions}</p>
        </Section>
      )}

      {/* Footer */}
      <div style={{ borderTop: `2px solid ${brandColor}`, marginTop: "24px", paddingTop: "12px", textAlign: "center" }}>
        <p style={{ fontSize: "10px", color: "#888" }}>
          CONFIDENTIAL — {companyName} — Generated {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color, borderBottom: `1px solid ${color}33`, paddingBottom: "4px", marginBottom: "8px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", fontSize: "12px", marginBottom: "4px" }}>
      <span style={{ fontWeight: 600, width: "120px", flexShrink: 0, color: "#555" }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

/* ── Textarea helper ─────────────────────────────────── */

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
  );
}

/* ── Component ─────────────────────────────────────────── */

export default function AdminEventsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const companyName = activeCompany?.companyName ?? "Company";
  const companyLogo = activeCompany?.companyLogo ?? undefined;
  const brandColor = activeCompany?.brandColor ?? "#6366f1";

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form — step wizard
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guide, setGuide] = useState<OpsGuide>({ ...EMPTY_GUIDE });
  const [creating, setCreating] = useState(false);

  // SOP intake fields (supplement wizard)
  const [intakeEngagement, setIntakeEngagement] = useState<string[]>([]);
  const [intakeMission, setIntakeMission] = useState("");
  const [intakeTimeSensitivity, setIntakeTimeSensitivity] = useState("Medium");
  const [intakeVenueType, setIntakeVenueType] = useState<string[]>([]);
  const [intakeAttendance, setIntakeAttendance] = useState("");
  const [intakeEnvironment, setIntakeEnvironment] = useState("");
  const [intakeEnvNotes, setIntakeEnvNotes] = useState("");
  const [intakeClientRequest, setIntakeClientRequest] = useState("");
  const [intakeServices, setIntakeServices] = useState<string[]>([]);
  const [intakeDeliverables, setIntakeDeliverables] = useState("");
  const [intakeOutOfScope, setIntakeOutOfScope] = useState("");
  const [intakeMedical, setIntakeMedical] = useState("");
  const [intakeEquipment, setIntakeEquipment] = useState("");
  const [intakeRadioChannels, setIntakeRadioChannels] = useState("");
  const [intakeRiskLevel, setIntakeRiskLevel] = useState("");
  const [intakeThreats, setIntakeThreats] = useState<string[]>([]);
  const [intakeClientRisks, setIntakeClientRisks] = useState("");
  const [intakeConstraints, setIntakeConstraints] = useState<string[]>([]);
  const [intakeCommandModel, setIntakeCommandModel] = useState("");
  const [intakeEaRole, setIntakeEaRole] = useState<string[]>([]);
  const [intakeEscalation, setIntakeEscalation] = useState("");
  const [intakeSuccessCriteria, setIntakeSuccessCriteria] = useState<string[]>([]);
  const [intakeSuccessNotes, setIntakeSuccessNotes] = useState("");

  // Expanded op
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState<string | null>(null);

  // Quick Fill builder
  const [posts, setPosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [pattern, setPattern] = useState<"8" | "12">("8");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Custom shift
  const [showCustom, setShowCustom] = useState(false);
  const [cRole, setCRole] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cAssign, setCAssign] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  // Conflict warning
  const [conflictWarning, setConflictWarning] = useState<{ shiftId: string; userId: string; conflicts: { role: string; eventName: string; time: string }[]; pendingAction: () => Promise<void> } | null>(null);

  // OPs Guide viewer
  const [viewingGuide, setViewingGuide] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  // Activity feed
  const [showActivity, setShowActivity] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Shift view mode
  const [shiftView, setShiftView] = useState<"list" | "calendar">("calendar");
  const [calendarDay, setCalendarDay] = useState<string | null>(null);

  // Document panels
  const [showWarno, setShowWarno] = useState(false);
  const [showOpord, setShowOpord] = useState(false);
  const [showFrago, setShowFrago] = useState(false);
  const [showGotwa, setShowGotwa] = useState(false);
  const [showDocHub, setShowDocHub] = useState(false);

  // Availability
  const [availability, setAvailability] = useState<OperationAvailability[]>([]);

  // Merged intake data (ops_guide + intake doc)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mergedIntake, setMergedIntake] = useState<Record<string, any> | null>(null);

  /* ── Data ── */

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setEvents(await getEvents(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function resetCreate() {
    setName(""); setLocation(""); setStartDate(""); setEndDate("");
    setGuide({ ...EMPTY_GUIDE }); setCreateStep(0); setShowCreate(false);
    setIntakeEngagement([]); setIntakeMission(""); setIntakeTimeSensitivity("Medium");
    setIntakeVenueType([]); setIntakeAttendance(""); setIntakeEnvironment(""); setIntakeEnvNotes("");
    setIntakeClientRequest(""); setIntakeServices([]); setIntakeDeliverables(""); setIntakeOutOfScope("");
    setIntakeMedical(""); setIntakeEquipment(""); setIntakeRadioChannels("");
    setIntakeRiskLevel(""); setIntakeThreats([]); setIntakeClientRisks(""); setIntakeConstraints([]);
    setIntakeCommandModel(""); setIntakeEaRole([]); setIntakeEscalation("");
    setIntakeSuccessCriteria([]); setIntakeSuccessNotes("");
  }

  function updateGuide(field: keyof OpsGuide, value: string) {
    setGuide(prev => ({ ...prev, [field]: value }));
  }

  function toggleArr(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  async function handleCreate() {
    if (!name.trim() || !startDate || !endDate || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      const ev = await createEvent({
        companyId: activeCompanyId,
        name: name.trim(),
        location: location || guide.siteAddress || undefined,
        startDate, endDate,
        opsGuide: guide,
        engagementType: intakeEngagement.join(", ") || undefined,
        venueType: intakeVenueType.join(", ") || undefined,
        estimatedAttendance: intakeAttendance || undefined,
        riskLevel: intakeRiskLevel || undefined,
        tlpStep: "receive_mission",
      });
      // Create intake document for SOP tracking
      if (ev?.id) {
        const intakeData: IntakeData = {
          engagementType: intakeEngagement, clientRequest: intakeClientRequest,
          missionStatement: intakeMission, timeSensitivity: intakeTimeSensitivity,
          venueType: intakeVenueType, estimatedAttendance: intakeAttendance,
          environment: intakeEnvironment, environmentNotes: intakeEnvNotes,
          servicesRequested: intakeServices, deliverables: intakeDeliverables, outOfScope: intakeOutOfScope,
          clientPersonnelCount: "", clientLeadershipStructure: "", clientExistingSops: false,
          clientIncidentReporting: "", clientTrainingLevel: "", equipmentAvailable: intakeEquipment,
          medicalCapability: intakeMedical, technologyAvailable: "",
          clientIdentifiedRisks: intakeClientRisks, eaRiskAssessment: "", riskLevel: intakeRiskLevel,
          threatTypes: intakeThreats, constraints: intakeConstraints,
          commandModel: intakeCommandModel, onSiteAuthority: "", eaRole: intakeEaRole,
          escalationFlow: intakeEscalation, chainOfCommand: "",
          successCriteria: intakeSuccessCriteria, additionalSuccessMeasures: intakeSuccessNotes,
        };
        try {
          await createDocument({
            eventId: ev.id, companyId: activeCompanyId, docType: "intake",
            data: intakeData as unknown as Record<string, unknown>,
          });
        } catch (docErr) { console.error("Intake doc creation failed:", docErr); }
      }
      resetCreate(); await load();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function toggleActivity(eventId: string) {
    if (showActivity) { setShowActivity(false); return; }
    setShowActivity(true);
    setLoadingActivity(true);
    try {
      setActivityItems(await getOperationActivity(eventId));
    } catch { setActivityItems([]); }
    finally { setLoadingActivity(false); }
  }

  async function toggleExpand(eventId: string) {
    if (expanded === eventId) { setExpanded(null); return; }
    setExpanded(eventId); setViewingGuide(null);
    setPosts([]); setSelectedDays(new Set()); setShowCustom(false); setShowBuilder(false);
    setShowActivity(false); setActivityItems([]); setShowWarno(false); setShowOpord(false); setShowFrago(false); setShowGotwa(false); setShowDocHub(false);
    setAvailability([]); setMergedIntake(null);
    try {
      const ev = events.find((e: Event) => e.id === eventId);
      const [s, m, avail, intakeDoc] = await Promise.all([
        getEventShifts(eventId),
        activeCompanyId ? getCompanyMembers(activeCompanyId) : Promise.resolve([]),
        getEventAvailability(eventId).catch(() => [] as OperationAvailability[]),
        getLatestDocument(eventId, "intake").catch(() => null),
      ]);
      setShifts(s); setMembers(m); setAvailability(avail);
      // Merge ops_guide + intake doc + event-level fields into unified object
      const guide = ev?.ops_guide || {};
      const intake = (intakeDoc?.data as Record<string, unknown>) || {};
      setMergedIntake({
        ...guide, ...intake,
        // Event-level overrides
        location: ev?.location || guide.siteAddress || "",
        startDate: ev?.start_date || "",
        endDate: ev?.end_date || "",
        radioChannels: intake.radioChannels || guide.radioChannels || "",
      });
    } catch { setShifts([]); }
  }

  async function handleStatusChange(eventId: string, ns: string) {
    try {
      await updateEventStatus(eventId, ns);
      // If publishing, notify assigned employees
      if (ns === "published" || ns === "in_progress") {
        const ev = events.find((e: Event) => e.id === eventId);
        if (ev?.ops_guide && activeCompanyId) {
          const evShifts = await getEventShifts(eventId);
          const assignedIds = [...new Set(evShifts.filter((s: Shift) => s.assigned_user_id).map((s: Shift) => s.assigned_user_id as string))];
          if (assignedIds.length > 0) {
            import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
              for (const uid of assignedIds) {
                dispatch({
                  userId: uid,
                  companyId: activeCompanyId!,
                  title: `OPs Guide: ${ev.name}`,
                  body: `You have been assigned to ${ev.name}. Review the Operations Guide for details.`,
                  type: "ops_guide",
                  actionUrl: "/schedule",
                }).catch(() => {});
              }
            }).catch(() => {});
          }
        }
      }
      await load();
    } catch (err) { console.error(err); }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this operation and all its shifts?")) return;
    setDeletingEvent(eventId);
    try { await deleteEvent(eventId); if (expanded === eventId) setExpanded(null); await load(); }
    catch (err) { console.error(err); } finally { setDeletingEvent(null); }
  }

  async function handleDeleteShift(shiftId: string) {
    setDeletingShift(shiftId);
    try { await deleteShift(shiftId); if (expanded) setShifts(await getEventShifts(expanded)); }
    catch (err) { console.error(err); } finally { setDeletingShift(null); }
  }

  async function handleAssign(shiftId: string, userId: string) {
    if (!userId) {
      // Unassigning — no conflict check needed
      try { await assignShift(shiftId, null); if (expanded) setShifts(await getEventShifts(expanded)); }
      catch (err) { console.error(err); }
      return;
    }
    // Check for conflicts before assigning
    const sh = shifts.find((s: Shift) => s.id === shiftId);
    if (sh) {
      try {
        const conflicts = await getConflictingShifts(userId, sh.start_time, sh.end_time, shiftId);
        if (conflicts.length > 0) {
          setConflictWarning({
            shiftId, userId,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              await assignShift(shiftId, userId);
              if (expanded) setShifts(await getEventShifts(expanded));
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    try { await assignShift(shiftId, userId); if (expanded) setShifts(await getEventShifts(expanded)); }
    catch (err) { console.error(err); }
  }

  /* ── Quick Fill ── */

  async function handleGenerate() {
    if (!expanded || posts.length === 0 || selectedDays.size === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      const pat = PATTERNS[pattern];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of pat) {
          for (const post of posts) {
            batch.push({ eventId: expanded, role: `${post} — ${p.label}`, startTime: toISO(day, p.sH, p.sM, false), endTime: toISO(day, p.eH, p.eM, p.overnight) });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) { await Promise.all(batch.slice(i, i + 5).map(s => createShift(s))); }
      setShifts(await getEventShifts(expanded));
      setPosts([]); setSelectedDays(new Set()); setShowBuilder(false);
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  }

  async function handleAddCustom() {
    if (!expanded || !cStart || !cEnd) return;
    // Check for conflicts if assigning to a user
    if (cAssign) {
      try {
        const conflicts = await getConflictingShifts(cAssign, cStart, cEnd);
        if (conflicts.length > 0) {
          setConflictWarning({
            shiftId: "new", userId: cAssign,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              setAddingCustom(true);
              try {
                await createShift({ eventId: expanded!, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
                setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
                setShifts(await getEventShifts(expanded!));
              } finally { setAddingCustom(false); }
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    setAddingCustom(true);
    try {
      await createShift({ eventId: expanded, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
      setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
      setShifts(await getEventShifts(expanded));
    } catch (err) { console.error(err); } finally { setAddingCustom(false); }
  }

  function addPost() { if (!newPost.trim() || posts.includes(newPost.trim())) return; setPosts([...posts, newPost.trim()]); setNewPost(""); }
  function toggleDay(d: string) { const n = new Set(selectedDays); if (n.has(d)) n.delete(d); else n.add(d); setSelectedDays(n); }

  /* ── PDF Download ── */

  async function downloadGuidePDF(ev: Event) {
    if (!guideRef.current) return;
    setGeneratingPdf(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(guideRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = 210, pdfH = 297, margin = 10;
      const maxW = pdfW - margin * 2, maxH = pdfH - margin * 2;
      let imgW = canvas.width * 0.264583 / 2, imgH = canvas.height * 0.264583 / 2;
      if (imgW > maxW) { const r = maxW / imgW; imgW = maxW; imgH *= r; }
      if (imgH > maxH) { const r = maxH / imgH; imgH = maxH; imgW *= r; }
      pdf.addImage(imgData, "PNG", (pdfW - imgW) / 2, margin, imgW, imgH);
      pdf.save(`OPs_Guide_${ev.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) { console.error(err); } finally { setGeneratingPdf(false); }
  }

  /* ── Derived ── */

  const totalShifts = shifts.length;
  const filledShifts = shifts.filter((s: Shift) => s.assigned_user_id).length;
  const openShifts = totalShifts - filledShifts;
  const shiftsByDay = groupByDay(shifts);
  const previewCount = posts.length * (pattern === "8" ? 3 : 2) * selectedDays.size;
  const fillPct = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

  // Availability lookup by user_id
  const availByUser = new Map<string, string>();
  for (const a of availability) { availByUser.set(a.user_id, a.status); }
  const availableCount = availability.filter(a => a.status === "available").length;
  const unavailableCount = availability.filter(a => a.status === "unavailable").length;
  const tentativeCount = availability.filter(a => a.status === "tentative").length;
  const pendingAvailCount = members.length - availability.length;

  // Detect scheduling conflicts: same user assigned to overlapping time ranges
  const adminConflictIds = new Set<string>();
  const assignedShifts = shifts.filter((s: Shift) => s.assigned_user_id);
  for (let i = 0; i < assignedShifts.length; i++) {
    for (let j = i + 1; j < assignedShifts.length; j++) {
      const a = assignedShifts[i], b = assignedShifts[j];
      if (a.assigned_user_id === b.assigned_user_id &&
          new Date(a.start_time) < new Date(b.end_time) &&
          new Date(a.end_time) > new Date(b.start_time)) {
        adminConflictIds.add(a.id); adminConflictIds.add(b.id);
      }
    }
  }
  const conflictCount = adminConflictIds.size;

  const CREATE_STEPS = ["Basics", "Client & Site", "Scope & Orders", "Uniform & Comms", "Emergency & C2"];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Flag className="h-5 w-5 sm:h-6 sm:w-6" /> OPERATIONS</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Plan and manage security operations</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Operation
          </Button>
        </div>

        {/* ── CREATE WIZARD ── */}
        {showCreate && (
          <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
            {/* Step indicator */}
            <div className="flex border-b border-border/30 bg-muted/30">
              {CREATE_STEPS.map((step, i) => (
                <button key={step} onClick={() => { if (i === 0 || name.trim()) setCreateStep(i); }}
                  className={`flex-1 px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors border-b-2 ${
                    createStep === i ? "border-primary text-primary bg-primary/5" : i < createStep ? "border-green-500/50 text-green-600" : "border-transparent text-muted-foreground"
                  }`}>
                  {i < createStep ? <Check className="h-3 w-3 inline mr-1" /> : null}{step}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3">
              {/* Step 0: Basics */}
              {createStep === 0 && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Label className="text-xs">Operation Name *</Label><Input placeholder="e.g. Spring Festival Security" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Location</Label><Input placeholder="e.g. 123 Main St, Los Angeles, CA" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Start Date & Time *</Label><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">End Date & Time *</Label><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" /></div>
                  </div>
                  <div className="pt-2 border-t border-border/20">
                    <Label className="text-xs">Type of Engagement</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ENGAGEMENT_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => toggleArr(intakeEngagement, setIntakeEngagement, t)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeEngagement.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                          {intakeEngagement.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Time Sensitivity</Label>
                      <select value={intakeTimeSensitivity} onChange={(e) => setIntakeTimeSensitivity(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        {["Low", "Medium", "High", "Immediate"].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <Label className="text-xs">Mission Statement</Label>
                      <Input placeholder={`${companyName || "Company"} will [do what] for [client] at [location] in order to [purpose]`} value={intakeMission} onChange={(e) => setIntakeMission(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </>
              )}

              {/* Step 1: Client & Site */}
              {createStep === 1 && (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Client & site details appear on the OPs Guide shared with your team.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Client Name</Label><Input placeholder="e.g. Acme Corp" value={guide.clientName} onChange={(e) => updateGuide("clientName", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Client Contact Person</Label><Input placeholder="e.g. Jane Smith" value={guide.clientContact} onChange={(e) => updateGuide("clientContact", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Client Phone</Label><Input placeholder="(555) 123-4567" value={guide.clientPhone} onChange={(e) => updateGuide("clientPhone", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Client Email</Label><Input placeholder="jane@acme.com" type="email" value={guide.clientEmail} onChange={(e) => updateGuide("clientEmail", e.target.value)} className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Site Address</Label><Input placeholder="Full site address if different from operation location" value={guide.siteAddress} onChange={(e) => updateGuide("siteAddress", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Site Type</Label>
                      <select value={guide.siteType} onChange={(e) => updateGuide("siteType", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {SITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><Label className="text-xs">Parking Info</Label><Input placeholder="e.g. Lot B, permit required" value={guide.parkingInfo} onChange={(e) => updateGuide("parkingInfo", e.target.value)} className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Check-In Procedure</Label><Input placeholder="e.g. Report to lobby, sign in at front desk" value={guide.checkInProcedure} onChange={(e) => updateGuide("checkInProcedure", e.target.value)} className="mt-1" /></div>
                  </div>
                  <div className="pt-2 border-t border-border/20 space-y-3">
                    <div>
                      <Label className="text-xs">Venue Type</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {VENUE_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => toggleArr(intakeVenueType, setIntakeVenueType, t)}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeVenueType.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                            {intakeVenueType.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><Label className="text-xs">Estimated Attendance</Label><Input placeholder="e.g. 500" value={intakeAttendance} onChange={(e) => setIntakeAttendance(e.target.value)} className="mt-1" /></div>
                      <div><Label className="text-xs">Environment</Label>
                        <select value={intakeEnvironment} onChange={(e) => setIntakeEnvironment(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          <option value="Indoor">Indoor</option>
                          <option value="Outdoor">Outdoor</option>
                          <option value="Hybrid">Hybrid</option>
                        </select>
                      </div>
                      <div className="sm:col-span-1"><Label className="text-xs">Environment Notes</Label><Input placeholder="e.g. Urban, multi-level" value={intakeEnvNotes} onChange={(e) => setIntakeEnvNotes(e.target.value)} className="mt-1" /></div>
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Scope & Post Orders */}
              {createStep === 2 && (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Define what your team is responsible for at this operation.</p>
                  <div>
                    <Label className="text-xs">Services Requested</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {SERVICES_REQUESTED.map(t => (
                        <button key={t} type="button" onClick={() => toggleArr(intakeServices, setIntakeServices, t)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeServices.includes(t) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                          {intakeServices.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div><Label className="text-xs">Client Request (in their words)</Label><Textarea value={intakeClientRequest} onChange={(v) => setIntakeClientRequest(v)} placeholder="What the client asked for verbatim — helps align expectations" rows={2} /></div>
                  <div><Label className="text-xs">Scope of Work</Label><Textarea value={guide.scope} onChange={(v) => updateGuide("scope", v)} placeholder="Describe the overall scope: access control, patrol routes, crowd management, etc." rows={3} /></div>
                  <div><Label className="text-xs">Post Orders / Standing Instructions</Label><Textarea value={guide.postOrders} onChange={(v) => updateGuide("postOrders", v)} placeholder="Detailed instructions for each post position, duties, and responsibilities" rows={3} /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Deliverables</Label><Textarea value={intakeDeliverables} onChange={(v) => setIntakeDeliverables(v)} placeholder="e.g. Security plan, post-event report, incident logs" rows={2} /></div>
                    <div><Label className="text-xs">Out of Scope</Label><Textarea value={intakeOutOfScope} onChange={(v) => setIntakeOutOfScope(v)} placeholder={`What ${companyName || "the company"} is NOT responsible for`} rows={2} /></div>
                  </div>
                </>
              )}

              {/* Step 3: Uniform & Comms */}
              {createStep === 3 && (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Shirt className="h-3.5 w-3.5" /> Dress code, equipment, and communication details.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Dress Code</Label>
                      <select value={guide.dressCode} onChange={(e) => updateGuide("dressCode", e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {DRESS_CODES.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div><Label className="text-xs">Required Gear</Label><Input placeholder="e.g. Flashlight, radio, body cam" value={guide.requiredGear} onChange={(e) => updateGuide("requiredGear", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Communication Channel</Label><Input placeholder="e.g. WhatsApp Ops Chat, Radio Ch. 5" value={guide.communicationChannel} onChange={(e) => updateGuide("communicationChannel", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Radio Channels / Plan</Label><Input placeholder="e.g. Ch 1: Command, Ch 2: Security, Ch 3: Medical" value={intakeRadioChannels} onChange={(e) => setIntakeRadioChannels(e.target.value)} className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Reporting Instructions</Label><Textarea value={guide.reportingInstructions} onChange={(v) => updateGuide("reportingInstructions", v)} placeholder="How and when to submit reports (e.g. Overwatch incident form, end-of-shift DAR)" rows={2} /></div>
                  </div>
                  <div className="pt-2 border-t border-border/20 grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Medical Capability</Label>
                      <select value={intakeMedical} onChange={(e) => setIntakeMedical(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                        <option value="">Select...</option>
                        {MEDICAL_CAPABILITIES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div><Label className="text-xs">Additional Equipment</Label><Input placeholder="e.g. Barriers, lighting, PPE, first aid kits" value={intakeEquipment} onChange={(e) => setIntakeEquipment(e.target.value)} className="mt-1" /></div>
                  </div>
                </>
              )}

              {/* Step 4: Emergency, Risk & C2 */}
              {createStep === 4 && (
                <>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Emergency, risk assessment, command structure, and success criteria.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label className="text-xs">Emergency Contact Name</Label><Input placeholder="e.g. Operations Manager" value={guide.emergencyContact} onChange={(e) => updateGuide("emergencyContact", e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Emergency Phone</Label><Input placeholder="(555) 999-0000" value={guide.emergencyPhone} onChange={(e) => updateGuide("emergencyPhone", e.target.value)} className="mt-1" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs">Emergency Procedure</Label><Textarea value={guide.emergencyProcedure} onChange={(v) => updateGuide("emergencyProcedure", v)} placeholder="Evacuation routes, rally points, chain of command" rows={2} /></div>
                  </div>
                  {/* Risk Assessment */}
                  <div className="pt-2 border-t border-border/20 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Risk Assessment</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label className="text-xs">Risk Level</Label>
                        <select value={intakeRiskLevel} onChange={(e) => setIntakeRiskLevel(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {["Low", "Moderate", "High", "Critical"].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div><Label className="text-xs">Client-Identified Risks</Label><Input placeholder="e.g. Previous incidents, known bad actors" value={intakeClientRisks} onChange={(e) => setIntakeClientRisks(e.target.value)} className="mt-1" /></div>
                    </div>
                    <div>
                      <Label className="text-xs">Threat Types</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {THREAT_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => toggleArr(intakeThreats, setIntakeThreats, t)}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeThreats.includes(t) ? "border-red-500/60 bg-red-500/10 text-red-500" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                            {intakeThreats.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Constraints</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {CONSTRAINT_TYPES.map(t => (
                          <button key={t} type="button" onClick={() => toggleArr(intakeConstraints, setIntakeConstraints, t)}
                            className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeConstraints.includes(t) ? "border-amber-500/60 bg-amber-500/10 text-amber-600" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                            {intakeConstraints.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Command & Control */}
                  <div className="pt-2 border-t border-border/20 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Command & Control</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><Label className="text-xs">Command Model</Label>
                        <select value={intakeCommandModel} onChange={(e) => setIntakeCommandModel(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          {COMMAND_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div><Label className="text-xs">Escalation Flow</Label>
                        <select value={intakeEscalation} onChange={(e) => setIntakeEscalation(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                          <option value="">Select...</option>
                          <option value="Staff → Supervisor → Command">Staff → Supervisor → Command</option>
                          <option value="Direct to Command">Direct to Command</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">{companyName || "Company"} Role</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {COMPANY_ROLES.map(r => (
                            <button key={r} type="button" onClick={() => toggleArr(intakeEaRole, setIntakeEaRole, r)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${intakeEaRole.includes(r) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                              {intakeEaRole.includes(r) && <Check className="h-2 w-2 inline mr-0.5" />}{r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Success Criteria */}
                  <div className="pt-2 border-t border-border/20 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Success Criteria</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SUCCESS_CRITERIA_OPTIONS.map(c => (
                        <button key={c} type="button" onClick={() => toggleArr(intakeSuccessCriteria, setIntakeSuccessCriteria, c)}
                          className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${intakeSuccessCriteria.includes(c) ? "border-green-500/60 bg-green-500/10 text-green-600" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                          {intakeSuccessCriteria.includes(c) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{c}
                        </button>
                      ))}
                    </div>
                    <div><Label className="text-xs">Special Instructions / Additional Notes</Label><Textarea value={guide.specialInstructions} onChange={(v) => updateGuide("specialInstructions", v)} placeholder="VIP details, restricted areas, weather contingencies, additional success measures" rows={2} /></div>
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div className="flex gap-2">
                  {createStep > 0 && <Button size="sm" variant="outline" onClick={() => setCreateStep(createStep - 1)}>Back</Button>}
                  <Button size="sm" variant="ghost" onClick={resetCreate}>Cancel</Button>
                </div>
                {createStep < CREATE_STEPS.length - 1 ? (
                  <Button size="sm" onClick={() => setCreateStep(createStep + 1)} disabled={createStep === 0 && (!name.trim() || !startDate || !endDate)}>
                    Next
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1.5" onClick={handleCreate} disabled={!name.trim() || !startDate || !endDate || creating}>
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                    Create Operation
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── OPS GUIDE VIEWER (modal-style) ── */}
        {viewingGuide && (() => {
          const ev = events.find((e: Event) => e.id === viewingGuide);
          if (!ev?.ops_guide) return null;
          const g: OpsGuide = { ...EMPTY_GUIDE, ...ev.ops_guide };
          return (
            <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-muted/30">
                <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" /> OPs Guide — {ev.name}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => downloadGuidePDF(ev)} disabled={generatingPdf}>
                    {generatingPdf ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} PDF
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setViewingGuide(null)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="overflow-auto max-h-[70vh] bg-white" ref={guideRef}>
                <OpsGuidePreview ev={ev} guide={g} companyName={companyName} companyLogo={companyLogo} brandColor={brandColor} />
              </div>
            </div>
          );
        })()}

        {/* ── Conflict Warning Modal ── */}
        {conflictWarning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setConflictWarning(null)}>
            <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-amber-500/20 bg-amber-500/10 px-5 py-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold">Shift Conflict Detected</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">This person already has overlapping shift(s):</p>
                </div>
              </div>
              <div className="px-5 py-3 space-y-2 max-h-48 overflow-auto">
                {conflictWarning.conflicts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <div className="text-xs">
                      <span className="font-medium">{c.role}</span>
                      <span className="text-muted-foreground"> — {c.eventName}</span>
                      <span className="text-muted-foreground font-mono ml-1.5">{c.time}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/30 px-5 py-3">
                <Button size="sm" variant="outline" onClick={() => setConflictWarning(null)}>Cancel</Button>
                <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                  onClick={async () => {
                    const action = conflictWarning.pendingAction;
                    setConflictWarning(null);
                    try { await action(); } catch (err) { console.error(err); }
                  }}>
                  <AlertTriangle className="h-3.5 w-3.5" /> Assign Anyway
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Event List ── */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Flag className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No operations planned</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create your first operation to start building schedules.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev: Event) => {
              const isExp = expanded === ev.id;
              const opDays = getDaysInRange(ev.start_date, ev.end_date);
              const hasGuide = !!ev.ops_guide && Object.values(ev.ops_guide).some((v: unknown) => typeof v === "string" && v.length > 0);

              return (
                <div key={ev.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  {/* Op Header */}
                  <div className="px-3 sm:px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggleExpand(ev.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-violet-500/10 shrink-0">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{ev.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {ev.location ?? "TBD"} · {fmtDateShort(ev.start_date)} — {fmtDateShort(ev.end_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasGuide && (
                          <button onClick={(e) => { e.stopPropagation(); setViewingGuide(viewingGuide === ev.id ? null : ev.id); setExpanded(null); }}
                            className="hidden sm:flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                            title="View OPs Guide">
                            <Eye className="h-3 w-3" /> Guide
                          </button>
                        )}
                        <select value={ev.status}
                          onChange={(e) => { e.stopPropagation(); handleStatusChange(ev.id, e.target.value); }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 appearance-none rounded border border-border/40 bg-background px-1.5 sm:px-2 pr-4 sm:pr-5 text-[10px] font-medium capitalize cursor-pointer">
                          {["draft", "published", "in_progress", "completed", "cancelled"].map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} disabled={deletingEvent === ev.id}
                          className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete">
                          {deletingEvent === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </button>
                        {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded Shift Builder ── */}
                  {isExp && (
                    <div className="border-t border-border/30 bg-muted/20">
                      {/* Stats Bar */}
                      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/20 bg-muted/30">
                        <span className="text-[10px] font-mono font-semibold">{totalShifts}</span>
                        <span className="text-[10px] text-muted-foreground">shifts ·</span>
                        <span className="text-[10px] font-mono text-green-500">{filledShifts} filled</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] font-mono text-amber-500">{openShifts} open</span>
                        {conflictCount > 0 && (
                          <span className="text-[10px] font-mono text-red-500 flex items-center gap-0.5">· <AlertTriangle className="h-2.5 w-2.5" /> {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}</span>
                        )}
                        {totalShifts > 0 && (
                          <>
                            <div className="h-1.5 w-16 sm:w-20 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${fillPct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{fillPct}%</span>
                          </>
                        )}
                        {availability.length > 0 && (
                          <>
                            <span className="text-[10px] text-muted-foreground">·</span>
                            <span className="text-[10px] font-mono text-green-500">{availableCount}✓</span>
                            {tentativeCount > 0 && <span className="text-[10px] font-mono text-amber-500">{tentativeCount}?</span>}
                            {unavailableCount > 0 && <span className="text-[10px] font-mono text-red-500">{unavailableCount}✗</span>}
                            {pendingAvailCount > 0 && <span className="text-[10px] font-mono text-muted-foreground/50">{pendingAvailCount} pending</span>}
                          </>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground ml-auto">{opDays.length} day{opDays.length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* TLP Pipeline */}
                      <div className="px-3 sm:px-4 py-1.5 border-b border-border/20 bg-muted/20 overflow-x-auto">
                        <TlpTracker currentStep={(ev.tlp_step as TlpStep) || "receive_mission"} compact />
                      </div>

                      {/* Action Buttons */}
                      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 border-b border-border/20">
                        <Button size="sm" variant={showBuilder ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                          onClick={() => { setShowBuilder(!showBuilder); setShowCustom(false); }}>
                          <Zap className="h-3.5 w-3.5" /> Quick Fill
                        </Button>
                        <Button size="sm" variant={showCustom ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                          onClick={() => { setShowCustom(!showCustom); setShowBuilder(false); }}>
                          <Plus className="h-3.5 w-3.5" /> Custom Shift
                        </Button>
                        {/* View toggle */}
                        <div className="flex rounded-lg border border-border/40 overflow-hidden ml-1">
                          <button onClick={() => setShiftView("calendar")} className={`px-2 py-1 text-[10px] font-medium flex items-center gap-1 transition-colors ${shiftView === "calendar" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}>
                            <LayoutGrid className="h-3 w-3" /> Calendar
                          </button>
                          <button onClick={() => setShiftView("list")} className={`px-2 py-1 text-[10px] font-medium flex items-center gap-1 transition-colors border-l border-border/40 ${shiftView === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}>
                            <List className="h-3 w-3" /> List
                          </button>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <Button size="sm" variant={showDocHub ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                            onClick={() => { setShowDocHub(!showDocHub); setShowWarno(false); setShowOpord(false); setShowFrago(false); setShowGotwa(false); setShowActivity(false); }}>
                            <FileText className="h-3.5 w-3.5" /> Docs
                          </Button>
                          <Button size="sm" variant={showActivity ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                            onClick={() => { toggleActivity(ev.id); setShowWarno(false); setShowDocHub(false); }}>
                            <Activity className="h-3.5 w-3.5" /> Activity
                          </Button>
                          {hasGuide && (
                            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                              onClick={() => { setViewingGuide(ev.id); setExpanded(null); }}>
                              <FileText className="h-3.5 w-3.5" /> View Guide
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* ── WARNO Panel ── */}
                      {showWarno && activeCompanyId && activeCompanyId !== "pending" && (
                        <WarnoPanel
                          eventId={ev.id}
                          companyId={activeCompanyId}
                          eventName={ev.name}
                          companyName={companyName}
                          intakeData={mergedIntake}
                          onClose={() => setShowWarno(false)}
                          onIssued={() => load()}
                        />
                      )}

                      {/* ── FRAGO Panel ── */}
                      {showFrago && activeCompanyId && activeCompanyId !== "pending" && (
                        <FragoPanel
                          eventId={ev.id}
                          companyId={activeCompanyId}
                          eventName={ev.name}
                          onClose={() => setShowFrago(false)}
                          onIssued={() => load()}
                        />
                      )}

                      {/* ── GOTWA Panel ── */}
                      {showGotwa && activeCompanyId && activeCompanyId !== "pending" && (
                        <GotwaPanel
                          eventId={ev.id}
                          companyId={activeCompanyId}
                          eventName={ev.name}
                          eventLocation={ev.location ?? ""}
                          intakeData={mergedIntake}
                          onClose={() => setShowGotwa(false)}
                          onIssued={() => load()}
                        />
                      )}

                      {/* ── Document Hub ── */}
                      {showDocHub && (
                        <DocHub
                          eventId={ev.id}
                          onClose={() => setShowDocHub(false)}
                          onOpenDoc={(type) => {
                            setShowDocHub(false);
                            if (type === "warno") setShowWarno(true);
                            else if (type === "opord") setShowOpord(true);
                            else if (type === "frago") setShowFrago(true);
                            else if (type === "gotwa") setShowGotwa(true);
                          }}
                        />
                      )}

                      {/* ── OPORD Panel ── */}
                      {showOpord && activeCompanyId && activeCompanyId !== "pending" && (
                        <OpordPanel
                          eventId={ev.id}
                          companyId={activeCompanyId}
                          eventName={ev.name}
                          eventStart={ev.start_date}
                          eventEnd={ev.end_date}
                          eventLocation={ev.location ?? ""}
                          companyName={companyName}
                          companyLogo={companyLogo}
                          brandColor={brandColor}
                          intakeData={mergedIntake}
                          onClose={() => setShowOpord(false)}
                          onIssued={() => load()}
                        />
                      )}

                      {/* ── Quick Fill Panel ── */}
                      {showBuilder && (
                        <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posts / Positions</label>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {posts.map(p => (
                                <Badge key={p} variant="secondary" className="gap-1 text-xs pr-1">
                                  {p}
                                  <button onClick={() => setPosts(posts.filter(x => x !== p))} className="hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
                                </Badge>
                              ))}
                              <div className="flex gap-1">
                                <Input value={newPost} onChange={(e) => setNewPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPost()} placeholder="e.g. Front Gate" className="h-6 w-32 text-xs" />
                                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={addPost} disabled={!newPost.trim()}><Plus className="h-3 w-3" /></Button>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shift Pattern</label>
                            <div className="flex gap-2 mt-1">
                              {(["8", "12"] as const).map(p => (
                                <button key={p} onClick={() => setPattern(p)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pattern === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                                  {p === "8" ? "8-Hour (Day / Swing / Night)" : "12-Hour (Day / Night)"}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-3 mt-1.5">{PATTERNS[pattern].map(p => <span key={p.label} className="text-[10px] text-muted-foreground font-mono">{p.label}: {pad2(p.sH)}{pad2(p.sM)}–{pad2(p.eH)}{pad2(p.eM)}</span>)}</div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coverage Days</label>
                              <button onClick={() => setSelectedDays(new Set(opDays))} className="text-[10px] text-primary hover:underline">Select All</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {opDays.map(day => {
                                const d = new Date(day + "T12:00:00");
                                const lbl = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
                                const sel = selectedDays.has(day);
                                return (<button key={day} onClick={() => toggleDay(day)} className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>{sel && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{lbl}</button>);
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 pt-1">
                            <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={posts.length === 0 || selectedDays.size === 0 || generating}>
                              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate {previewCount} Shift{previewCount !== 1 ? "s" : ""}
                            </Button>
                            {previewCount > 0 && <span className="text-[10px] text-muted-foreground font-mono">{posts.length} post{posts.length > 1 ? "s" : ""} × {pattern === "8" ? "3" : "2"} periods × {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}</span>}
                          </div>
                        </div>
                      )}

                      {/* ── Custom Shift Form ── */}
                      {showCustom && (
                        <div className="px-3 sm:px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
                          <Input placeholder="Role / Position (e.g. Supervisor)" value={cRole} onChange={(e) => setCRole(e.target.value)} className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <div className="flex-1"><label className="text-[10px] text-muted-foreground">Start</label><Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} className="h-8 text-sm" /></div>
                            <div className="flex-1"><label className="text-[10px] text-muted-foreground">End</label><Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} className="h-8 text-sm" /></div>
                          </div>
                          <select value={cAssign} onChange={(e) => setCAssign(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                            <option value="">Unassigned</option>
                            {[...members].sort((a: Member, b: Member) => {
                              const as = availByUser.get(a.users?.id) ?? "pending";
                              const bs = availByUser.get(b.users?.id) ?? "pending";
                              const order: Record<string, number> = { available: 0, tentative: 1, pending: 2, unavailable: 3 };
                              return (order[as] ?? 2) - (order[bs] ?? 2);
                            }).map((m: Member) => {
                              const s = availByUser.get(m.users?.id);
                              const tag = s === "available" ? " ✓" : s === "tentative" ? " ?" : s === "unavailable" ? " ✗" : "";
                              return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
                            })}
                          </select>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={handleAddCustom} disabled={!cStart || !cEnd || addingCustom}>{addingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Shift"}</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCustom(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {/* ── Activity Feed ── */}
                      {showActivity && (
                        <div className="px-3 sm:px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <Activity className="h-3 w-3" /> Operation Activity
                            </p>
                            <span className="text-[10px] text-muted-foreground">{activityItems.length} event{activityItems.length !== 1 ? "s" : ""}</span>
                          </div>
                          {loadingActivity ? (
                            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                          ) : activityItems.length === 0 ? (
                            <div className="text-center py-6">
                              <Activity className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                              <p className="text-xs text-muted-foreground/60">No activity recorded yet</p>
                              <p className="text-[10px] text-muted-foreground/40 mt-0.5">Activity will appear here when guards clock in, file reports, or log incidents</p>
                            </div>
                          ) : (
                            <div className="space-y-1 max-h-[300px] overflow-y-auto">
                              {activityItems.map((item) => {
                                const iconMap = {
                                  clock_in: <LogIn className="h-3 w-3 text-green-500" />,
                                  clock_out: <LogOutIcon className="h-3 w-3 text-red-500" />,
                                  report: <ClipboardList className="h-3 w-3 text-blue-500" />,
                                  incident: <AlertTriangle className="h-3 w-3 text-amber-500" />,
                                  patrol: <Flag className="h-3 w-3 text-violet-500" />,
                                };
                                const colorMap = {
                                  clock_in: "border-green-500/20 bg-green-500/5",
                                  clock_out: "border-red-500/20 bg-red-500/5",
                                  report: "border-blue-500/20 bg-blue-500/5",
                                  incident: "border-amber-500/20 bg-amber-500/5",
                                  patrol: "border-violet-500/20 bg-violet-500/5",
                                };
                                return (
                                  <div key={item.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${colorMap[item.type]}`}>
                                    <div className="mt-0.5 shrink-0">{iconMap[item.type]}</div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-semibold truncate">{item.userName}</span>
                                        <span className="text-[9px] text-muted-foreground/60">{item.detail}</span>
                                      </div>
                                      {item.meta?.severity && (
                                        <Badge variant="secondary" className="text-[8px] h-4 mt-0.5 capitalize">{item.meta.severity}</Badge>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-muted-foreground/50 shrink-0 font-mono">
                                      {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Shift Grid by Day (List View) ── */}
                      {shiftView === "list" && (
                      <div className="px-3 sm:px-4 py-3 space-y-4">
                        {shifts.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm font-medium text-muted-foreground/60">No shifts yet</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Use Quick Fill to batch-generate shifts, or add a custom shift.</p>
                          </div>
                        ) : (
                          Array.from(shiftsByDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayShifts]) => (
                            <div key={day}>
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> {fmtDateLong(day)}
                                <span className="text-muted-foreground/30 font-normal">· {dayShifts.length} shift{dayShifts.length > 1 ? "s" : ""} · {dayShifts.filter((s: Shift) => s.assigned_user_id).length} filled</span>
                              </h4>
                              <div className="space-y-1">
                                {dayShifts.map((sh: Shift) => {
                                  const filled = !!sh.assigned_user_id;
                                  const hasConflict = adminConflictIds.has(sh.id);
                                  return (
                                    <div key={sh.id} className={`rounded-lg border px-2.5 sm:px-3 py-2 transition-colors ${hasConflict ? "border-red-500/40 bg-red-500/[0.06]" : filled ? "border-green-500/20 bg-green-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}>
                                      <div className="flex items-center gap-2 sm:gap-3">
                                        {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <Clock className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-green-500" : "text-amber-500"}`} />}
                                        <div className="flex-1 min-w-0 text-xs truncate">
                                          <span className="font-medium">{sh.role ?? "Shift"}</span>
                                          <span className="text-muted-foreground ml-1.5 sm:ml-2 font-mono">{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}</span>
                                          {hasConflict && <span className="ml-1 sm:ml-2 text-red-500 font-semibold text-[10px]">CONFLICT</span>}
                                        </div>
                                        <button onClick={() => handleDeleteShift(sh.id)} disabled={deletingShift === sh.id}
                                          className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 shrink-0" title="Delete">
                                          {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                        </button>
                                      </div>
                                      <div className="mt-1.5 ml-5.5 sm:ml-[26px]">
                                        <select value={sh.assigned_user_id ?? ""} onChange={(e) => handleAssign(sh.id, e.target.value)}
                                          className={`h-6 w-full sm:w-auto sm:max-w-[180px] truncate rounded border bg-background px-1.5 text-[10px] font-medium cursor-pointer ${hasConflict ? "border-red-500/40 text-red-500" : filled ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"}`}>
                                          <option value="">Open</option>
                                          {[...members].sort((a: Member, b: Member) => {
                                            const as = availByUser.get(a.users?.id) ?? "pending";
                                            const bs = availByUser.get(b.users?.id) ?? "pending";
                                            const order: Record<string, number> = { available: 0, tentative: 1, pending: 2, unavailable: 3 };
                                            return (order[as] ?? 2) - (order[bs] ?? 2);
                                          }).map((m: Member) => {
                                            const s = availByUser.get(m.users?.id);
                                            const tag = s === "available" ? " ✓" : s === "tentative" ? " ?" : s === "unavailable" ? " ✗" : "";
                                            return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
                                          })}
                                        </select>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      )}

                      {/* ── Calendar View ── */}
                      {shiftView === "calendar" && (
                        <div className="px-3 sm:px-4 py-3">
                          {shifts.length === 0 ? (
                            <div className="text-center py-8">
                              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                              <p className="text-sm font-medium text-muted-foreground/60">No shifts yet</p>
                            </div>
                          ) : (() => {
                            const sortedDays = Array.from(shiftsByDay.entries()).sort(([a], [b]) => a.localeCompare(b));
                            const firstDay = new Date(sortedDays[0][0] + "T12:00:00");
                            const startOfWeek = new Date(firstDay);
                            startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
                            const lastDay = new Date(sortedDays[sortedDays.length - 1][0] + "T12:00:00");
                            const endOfWeek = new Date(lastDay);
                            endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
                            const calDays: string[] = [];
                            const cur = new Date(startOfWeek);
                            while (cur <= endOfWeek) {
                              calDays.push(cur.toISOString().slice(0, 10));
                              cur.setDate(cur.getDate() + 1);
                            }
                            const opDaySet = new Set(opDays);
                            return (
                              <div>
                                <div className="grid grid-cols-7 gap-px mb-1">
                                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                    <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 py-1">{d}</div>
                                  ))}
                                </div>
                                <div className="grid grid-cols-7 gap-1">
                                  {(() => {
                                    const memberMap = new Map<string, { fn: string; ln: string; role: string; avatar: string }>();
                                    members.forEach((m: Member) => { if (m.users?.id) memberMap.set(m.users.id, { fn: m.users.first_name ?? "", ln: m.users.last_name ?? "", role: m.role ?? "member", avatar: m.users.avatar_url ?? "" }); });
                                    return calDays.map(day => {
                                      const dayShifts = shiftsByDay.get(day) ?? [];
                                      const isOpDay = opDaySet.has(day);
                                      const filled = dayShifts.filter((s: Shift) => s.assigned_user_id).length;
                                      const open = dayShifts.length - filled;
                                      const hasConflicts = dayShifts.some((s: Shift) => adminConflictIds.has(s.id));
                                      const isSelected = calendarDay === day;
                                      const dayNum = new Date(day + "T12:00:00").getDate();
                                      const isToday = day === new Date().toISOString().slice(0, 10);
                                      const totalHrs = dayShifts.reduce((sum: number, s: Shift) => {
                                        const ms = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
                                        return sum + (ms > 0 ? ms / 3600000 : ms / 3600000 + 24);
                                      }, 0);
                                      const uniqueStaff = [...new Set(dayShifts.filter((s: Shift) => s.assigned_user_id).map((s: Shift) => s.assigned_user_id as string))];
                                      const staffData = uniqueStaff.slice(0, 3).map(uid => {
                                        const u = memberMap.get(uid);
                                        return { uid, ini: u ? `${u.fn[0] ?? ""}${u.ln[0] ?? ""}` : "?", fn: u?.fn ?? "", ln: u?.ln ?? "", role: u?.role ?? "member", avatar: u?.avatar ?? "" };
                                      });

                                      return (
                                        <button key={day} onClick={() => isOpDay ? setCalendarDay(isSelected ? null : day) : undefined}
                                          className={`relative rounded-lg p-1.5 min-h-[68px] text-left transition-all border ${
                                            isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" :
                                            !isOpDay ? "border-transparent opacity-30" :
                                            hasConflicts ? "border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.08]" :
                                            dayShifts.length > 0 && open === 0 ? "border-green-500/20 bg-green-500/[0.04] hover:bg-green-500/[0.08]" :
                                            dayShifts.length > 0 ? "border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]" :
                                            "border-border/20 hover:bg-muted/30"
                                          }`}>
                                          <div className="flex items-center justify-between">
                                            <span className={`text-[11px] font-mono font-semibold ${isToday ? "text-primary" : isOpDay ? "" : "text-muted-foreground/30"}`}>{dayNum}</span>
                                            {dayShifts.length > 0 && <span className="text-[8px] font-mono text-muted-foreground/60">{totalHrs.toFixed(0)}h</span>}
                                          </div>
                                          {dayShifts.length > 0 && (
                                            <div className="mt-0.5 flex flex-wrap gap-0.5">
                                              {filled > 0 && (
                                                <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold bg-green-500/15 text-green-600">
                                                  <Check className="h-2 w-2" />{filled}
                                                </span>
                                              )}
                                              {open > 0 && (
                                                <span className="inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold bg-amber-500/15 text-amber-600">
                                                  {open}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                          {staffData.length > 0 && (
                                            <TooltipProvider>
                                            <div className="mt-0.5 flex gap-0.5">
                                              {staffData.map((s) => (
                                                <Tooltip key={s.uid}>
                                                  <TooltipTrigger>
                                                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[7px] font-bold text-primary/70 cursor-default">{s.ini}</span>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="top" className="p-0 overflow-hidden rounded-lg">
                                                    <div className="flex items-center gap-2 px-3 py-2">
                                                      <Avatar className="h-7 w-7">
                                                        {s.avatar && <AvatarImage src={s.avatar} />}
                                                        <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">{s.ini}</AvatarFallback>
                                                      </Avatar>
                                                      <div>
                                                        <p className="text-xs font-semibold leading-tight">{s.fn} {s.ln}</p>
                                                        <p className="text-[10px] capitalize opacity-70">{s.role}</p>
                                                      </div>
                                                    </div>
                                                  </TooltipContent>
                                                </Tooltip>
                                              ))}
                                              {uniqueStaff.length > 3 && (() => {
                                                const overflow = uniqueStaff.slice(3).map(uid => {
                                                  const u = memberMap.get(uid);
                                                  return { uid, ini: u ? `${u.fn[0] ?? ""}${u.ln[0] ?? ""}` : "?", fn: u?.fn ?? "", ln: u?.ln ?? "", role: u?.role ?? "member", avatar: u?.avatar ?? "" };
                                                });
                                                return (
                                                  <Tooltip>
                                                    <TooltipTrigger>
                                                      <span className="inline-flex h-4 items-center rounded-full bg-muted/40 px-1 text-[7px] font-bold text-muted-foreground/60 cursor-default">+{uniqueStaff.length - 3}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="p-0 overflow-hidden rounded-lg">
                                                      <div className="py-1">
                                                        {overflow.map(s => (
                                                          <div key={s.uid} className="flex items-center gap-2 px-3 py-1.5">
                                                            <Avatar className="h-6 w-6">
                                                              {s.avatar && <AvatarImage src={s.avatar} />}
                                                              <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">{s.ini}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                              <p className="text-[11px] font-semibold leading-tight">{s.fn} {s.ln}</p>
                                                              <p className="text-[9px] capitalize opacity-70">{s.role}</p>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                );
                                              })()}
                                            </div>
                                            </TooltipProvider>
                                          )}
                                          {hasConflicts && (
                                            <AlertTriangle className="absolute top-1 right-1 h-2.5 w-2.5 text-red-500" />
                                          )}
                                        </button>
                                      );
                                    });
                                  })()}
                                </div>

                                {/* Legend */}
                                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/10">
                                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-green-500/30" /> Fully Staffed</span>
                                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-amber-500/30" /> Open Slots</span>
                                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><AlertTriangle className="h-2 w-2 text-red-500" /> Conflict</span>
                                </div>

                                {/* Expanded Day Detail */}
                                {calendarDay && shiftsByDay.has(calendarDay) && (
                                  <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.02] p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-xs font-semibold flex items-center gap-1.5">
                                        <Calendar className="h-3.5 w-3.5 text-primary" />
                                        {fmtDateLong(calendarDay)}
                                      </h4>
                                      <button onClick={() => setCalendarDay(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                    <div className="space-y-1">
                                      {(shiftsByDay.get(calendarDay) ?? []).map((sh: Shift) => {
                                        const filled = !!sh.assigned_user_id;
                                        const hasConflict = adminConflictIds.has(sh.id);
                                        return (
                                          <div key={sh.id} className={`rounded-lg border px-2.5 py-2 ${hasConflict ? "border-red-500/40 bg-red-500/[0.06]" : filled ? "border-green-500/20 bg-green-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}>
                                            <div className="flex items-center gap-2">
                                              {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <Clock className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-green-500" : "text-amber-500"}`} />}
                                              <div className="flex-1 min-w-0 text-xs truncate">
                                                <span className="font-medium">{sh.role ?? "Shift"}</span>
                                                <span className="text-muted-foreground ml-2 font-mono">{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}</span>
                                              </div>
                                              <button onClick={() => handleDeleteShift(sh.id)} disabled={deletingShift === sh.id}
                                                className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 shrink-0">
                                                {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                              </button>
                                            </div>
                                            <div className="mt-1.5 ml-[22px]">
                                              <select value={sh.assigned_user_id ?? ""} onChange={(e) => handleAssign(sh.id, e.target.value)}
                                                className={`h-6 w-full sm:w-auto sm:max-w-[180px] truncate rounded border bg-background px-1.5 text-[10px] font-medium cursor-pointer ${hasConflict ? "border-red-500/40 text-red-500" : filled ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"}`}>
                                                <option value="">Open</option>
                                                {[...members].sort((a: Member, b: Member) => {
                                                  const as = availByUser.get(a.users?.id) ?? "pending";
                                                  const bs = availByUser.get(b.users?.id) ?? "pending";
                                                  const order: Record<string, number> = { available: 0, tentative: 1, pending: 2, unavailable: 3 };
                                                  return (order[as] ?? 2) - (order[bs] ?? 2);
                                                }).map((m: Member) => {
                                                  const s = availByUser.get(m.users?.id);
                                                  const tag = s === "available" ? " ✓" : s === "tentative" ? " ?" : s === "unavailable" ? " ✗" : "";
                                                  return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
                                                })}
                                              </select>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
