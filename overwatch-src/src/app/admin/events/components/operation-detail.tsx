"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Flag, MapPin, Plus, Loader2, Clock, Zap, Calendar, Check, X, FileText,
  AlertTriangle, Activity, ClipboardList, LogIn, LogOut as LogOutIcon,
  List, LayoutGrid, Trash2, ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  getEventShifts, createShift, getCompanyMembers,
  deleteShift, assignShift, getConflictingShifts, getOperationActivity,
  getLatestDocument, getEventAvailability,
  loadStoryboard, saveStoryboard,
} from "@/lib/supabase/db";
import { updateDocument as updateDocumentById, createDocument as createDocumentById, getLatestDocument as getLatestDocById } from "@/lib/supabase/db-documents";
import { IntakePanel } from "@/components/ops/intake-panel";
import type { IntakeChange } from "@/components/ops/intake-panel";
import type { OperationDocument } from "@/types/operations";
import type { OperationAvailability } from "@/lib/supabase/db-availability";
import type { ActivityItem } from "@/lib/supabase/db-operations";
import { getAssessmentsByEventId, getUnlinkedAssessments, linkAssessmentToEvent, unlinkAssessment, type SiteAssessment } from "@/lib/supabase/db-assessments";
import TlpTracker from "@/components/ops/tlp-tracker";
import WarnoPanel from "@/components/ops/warno-panel";
import OpordPanel from "@/components/ops/opord-panel";
import FragoPanel from "@/components/ops/frago-panel";
import GotwaPanel from "@/components/ops/gotwa-panel";
import DocHub from "@/components/ops/doc-hub";
import type { TlpStep } from "@/types/operations";
import StoryboardEditor from "@/components/storyboard-editor";
import type { StoryboardPin } from "@/components/storyboard-editor";
import type { ConflictWarningData } from "./conflict-warning-modal";
import {
  type Event, type Shift, type Member,
  fmtTime, fmtDateLong, getDaysInRange, groupByDay, pad2,
  PATTERNS, toISO,
} from "./shared";

interface OperationDetailProps {
  event: Event;
  activeCompanyId: string;
  internalUserId: string | null;
  companyName: string;
  companyLogo?: string;
  brandColor: string;
  onReload: () => Promise<void>;
  onConflictWarning: (data: ConflictWarningData) => void;
}

export function OperationDetail({
  event: ev,
  activeCompanyId,
  internalUserId,
  companyName,
  companyLogo,
  brandColor,
  onReload,
  onConflictWarning,
}: OperationDetailProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
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
  const [showIntake, setShowIntake] = useState(false);

  // Availability
  const [availability, setAvailability] = useState<OperationAvailability[]>([]);

  // Merged intake data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mergedIntake, setMergedIntake] = useState<Record<string, any> | null>(null);

  // Linked assessment
  const [linkedAssessment, setLinkedAssessment] = useState<SiteAssessment | null>(null);
  const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);
  const [unlinkedAssessments, setUnlinkedAssessments] = useState<SiteAssessment[]>([]);

  // Storyboard
  const [storyboardPins, setStoryboardPins] = useState<StoryboardPin[]>([]);
  const [storyboardId, setStoryboardId] = useState<string | null>(null);
  const storyboardIdRef = useRef<string | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);

  /* ── Load data on mount ── */
  const loadDetail = useCallback(async () => {
    try {
      const [s, m, avail, intakeDoc] = await Promise.all([
        getEventShifts(ev.id),
        activeCompanyId ? getCompanyMembers(activeCompanyId) : Promise.resolve([]),
        getEventAvailability(ev.id).catch(() => [] as OperationAvailability[]),
        getLatestDocument(ev.id, "intake").catch(() => null),
      ]);
      setShifts(s); setMembers(m); setAvailability(avail);
      const guide = ev?.ops_guide || {};
      const intake = (intakeDoc?.data as Record<string, unknown>) || {};
      setMergedIntake({
        ...guide, ...intake,
        location: ev?.location || guide.siteAddress || "",
        startDate: ev?.start_date || "",
        endDate: ev?.end_date || "",
        radioChannels: intake.radioChannels || guide.radioChannels || "",
      });

      // Load linked assessment
      try {
        const assessments = await getAssessmentsByEventId(ev.id);
        if (assessments.length > 0) setLinkedAssessment(assessments[0]);
      } catch { /* assessment load optional */ }

      // Load storyboard if event has a site map
      if (ev?.site_map_url) {
        setStoryboardLoading(true);
        try {
          const sb = await loadStoryboard(ev.id);
          if (sb) {
            setStoryboardId(sb.id);
            storyboardIdRef.current = sb.id;
            const allPins = (sb.pins as StoryboardPin[]) ?? [];
            setStoryboardPins(allPins.filter(p => p.icon !== "incident"));
          }
        } catch (e) { console.error("Failed to load storyboard:", e); }
        finally { setStoryboardLoading(false); }
      }
    } catch { setShifts([]); }
  }, [ev.id, ev?.ops_guide, ev?.location, ev?.start_date, ev?.end_date, ev?.site_map_url, activeCompanyId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  /* ── Handlers ── */

  async function toggleActivity() {
    if (showActivity) { setShowActivity(false); return; }
    setShowActivity(true);
    setLoadingActivity(true);
    try {
      setActivityItems(await getOperationActivity(ev.id));
    } catch { setActivityItems([]); }
    finally { setLoadingActivity(false); }
  }

  async function handleDeleteShift(shiftId: string) {
    setDeletingShift(shiftId);
    try { await deleteShift(shiftId); setShifts(await getEventShifts(ev.id)); toast.success("Shift removed"); }
    catch (err) { console.error(err); toast.error("Failed to remove shift"); } finally { setDeletingShift(null); }
  }

  async function handleAssign(shiftId: string, userId: string) {
    if (!userId) {
      try { await assignShift(shiftId, null); setShifts(await getEventShifts(ev.id)); }
      catch (err) { console.error(err); }
      return;
    }
    const sh = shifts.find((s: Shift) => s.id === shiftId);
    if (sh) {
      try {
        const conflicts = await getConflictingShifts(userId, sh.start_time, sh.end_time, shiftId);
        if (conflicts.length > 0) {
          onConflictWarning({
            shiftId, userId,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              await assignShift(shiftId, userId);
              setShifts(await getEventShifts(ev.id));
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    try { await assignShift(shiftId, userId); setShifts(await getEventShifts(ev.id)); }
    catch (err) { console.error(err); }
  }

  /* ── Quick Fill ── */

  async function handleGenerate() {
    if (posts.length === 0 || selectedDays.size === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      const pat = PATTERNS[pattern];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of pat) {
          for (const post of posts) {
            batch.push({ eventId: ev.id, role: `${post} — ${p.label}`, startTime: toISO(day, p.sH, p.sM, false), endTime: toISO(day, p.eH, p.eM, p.overnight) });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) { await Promise.all(batch.slice(i, i + 5).map(s => createShift(s))); }
      setShifts(await getEventShifts(ev.id));
      setPosts([]); setSelectedDays(new Set()); setShowBuilder(false);
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  }

  async function handleAddCustom() {
    if (!cStart || !cEnd) return;
    if (cAssign) {
      try {
        const conflicts = await getConflictingShifts(cAssign, cStart, cEnd);
        if (conflicts.length > 0) {
          onConflictWarning({
            shiftId: "new", userId: cAssign,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              setAddingCustom(true);
              try {
                await createShift({ eventId: ev.id, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
                setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
                setShifts(await getEventShifts(ev.id));
              } finally { setAddingCustom(false); }
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    setAddingCustom(true);
    try {
      await createShift({ eventId: ev.id, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
      setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
      setShifts(await getEventShifts(ev.id));
    } catch (err) { console.error(err); } finally { setAddingCustom(false); }
  }

  const handleLinkAssessment = async (assessmentId: string) => {
    await linkAssessmentToEvent(assessmentId, ev.id);
    const assessments = await getAssessmentsByEventId(ev.id);
    if (assessments.length > 0) setLinkedAssessment(assessments[0]);
    setShowAssessmentPicker(false);
    toast.success("Assessment linked to operation");
  };

  const handleUnlinkAssessment = async () => {
    if (!linkedAssessment) return;
    await unlinkAssessment(linkedAssessment.id);
    setLinkedAssessment(null);
    toast.success("Assessment unlinked");
  };

  const openAssessmentPicker = async () => {
    if (!activeCompanyId) return;
    const unlinked = await getUnlinkedAssessments(activeCompanyId);
    setUnlinkedAssessments(unlinked);
    setShowAssessmentPicker(true);
  };

  function addPost() { if (!newPost.trim() || posts.includes(newPost.trim())) return; setPosts([...posts, newPost.trim()]); setNewPost(""); }
  function toggleDay(d: string) { const n = new Set(selectedDays); if (n.has(d)) n.delete(d); else n.add(d); setSelectedDays(n); }

  /* ── Derived ── */

  const opDays = getDaysInRange(ev.start_date, ev.end_date);
  const totalShifts = shifts.length;
  const filledShifts = shifts.filter((s: Shift) => s.assigned_user_id).length;
  const openShifts = totalShifts - filledShifts;
  const shiftsByDay = groupByDay(shifts);
  const previewCount = posts.length * (pattern === "8" ? 3 : 2) * selectedDays.size;
  const fillPct = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

  // Availability lookup
  const availByUser = new Map<string, string>();
  for (const a of availability) { availByUser.set(a.user_id, a.status); }
  const availableCount = availability.filter(a => a.status === "available").length;
  const unavailableCount = availability.filter(a => a.status === "unavailable").length;
  const tentativeCount = availability.filter(a => a.status === "tentative").length;
  const pendingAvailCount = members.length - availability.length;

  // Detect scheduling conflicts
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

  // Sort members by availability
  const sortedMembers = [...members].sort((a: Member, b: Member) => {
    const as = availByUser.get(a.users?.id) ?? "pending";
    const bs = availByUser.get(b.users?.id) ?? "pending";
    const order: Record<string, number> = { available: 0, tentative: 1, pending: 2, unavailable: 3 };
    return (order[as] ?? 2) - (order[bs] ?? 2);
  });

  function renderMemberOptions() {
    return sortedMembers.map((m: Member) => {
      const s = availByUser.get(m.users?.id);
      const tag = s === "available" ? " \u2713" : s === "tentative" ? " ?" : s === "unavailable" ? " \u2717" : "";
      return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
    });
  }

  return (
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
            <span className="text-[10px] font-mono text-green-500">{availableCount}\u2713</span>
            {tentativeCount > 0 && <span className="text-[10px] font-mono text-amber-500">{tentativeCount}?</span>}
            {unavailableCount > 0 && <span className="text-[10px] font-mono text-red-500">{unavailableCount}\u2717</span>}
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
            onClick={() => { toggleActivity(); setShowWarno(false); setShowDocHub(false); }}>
            <Activity className="h-3.5 w-3.5" /> Activity
          </Button>
          {/* Assessment Link */}
          {linkedAssessment ? (
            <div className="flex items-center gap-1">
              <a
                href={`/overwatch/site-assessment?id=${linkedAssessment.id}`}
                onClick={(e) => e.stopPropagation()}
                className={`h-7 px-2 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  linkedAssessment.risk_level === "Critical" ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" :
                  linkedAssessment.risk_level === "High" ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" :
                  linkedAssessment.risk_level === "Moderate" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" :
                  "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                }`}
                title="View linked assessment"
              >
                <ClipboardCheck className="h-3.5 w-3.5" /> Assessment: {linkedAssessment.risk_level || "N/A"}
              </a>
              <button
                onClick={handleUnlinkAssessment}
                className="h-7 w-7 rounded-md border border-border/40 flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                title="Unlink assessment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openAssessmentPicker}>
              <ClipboardCheck className="h-3.5 w-3.5" /> Link Assessment
            </Button>
          )}
        </div>
      </div>

      {/* ── Assessment Picker ── */}
      {showAssessmentPicker && (
        <div className="px-3 sm:px-4 py-3 border-b border-border/20">
          <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Link Assessment</span>
              <button onClick={() => setShowAssessmentPicker(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
            </div>
            {unlinkedAssessments.length === 0 ? (
              <p className="text-xs text-zinc-500">No unlinked assessments available</p>
            ) : (
              unlinkedAssessments.map(a => (
                <button key={a.id} onClick={() => handleLinkAssessment(a.id)}
                  className="w-full text-left px-3 py-2 rounded bg-zinc-800/50 hover:bg-zinc-800 text-xs">
                  <span className="text-zinc-200">{a.client_name || "Unnamed"}</span>
                  {a.risk_level && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      a.risk_level === "Critical" ? "bg-red-500/20 text-red-400" :
                      a.risk_level === "High" ? "bg-orange-500/20 text-orange-400" :
                      a.risk_level === "Moderate" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>{a.risk_level}</span>
                  )}
                  {a.address && <span className="ml-2 text-zinc-500">{a.address}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── WARNO Panel ── */}
      {showWarno && (
        <WarnoPanel
          eventId={ev.id}
          companyId={activeCompanyId}
          eventName={ev.name}
          companyName={companyName}
          intakeData={mergedIntake}
          onClose={() => setShowWarno(false)}
          onIssued={() => onReload()}
        />
      )}

      {/* ── FRAGO Panel ── */}
      {showFrago && (
        <FragoPanel
          eventId={ev.id}
          companyId={activeCompanyId}
          eventName={ev.name}
          onClose={() => setShowFrago(false)}
          onIssued={() => onReload()}
        />
      )}

      {/* ── GOTWA Panel ── */}
      {showGotwa && (
        <GotwaPanel
          eventId={ev.id}
          companyId={activeCompanyId}
          eventName={ev.name}
          eventLocation={ev.location ?? ""}
          intakeData={mergedIntake}
          onClose={() => setShowGotwa(false)}
          onIssued={() => onReload()}
        />
      )}

      {/* ── Intake Panel ── */}
      {showIntake && (
        <IntakePanel
          eventId={ev.id}
          companyId={activeCompanyId}
          eventName={ev.name}
          eventLocation={ev.location}
          companyName={companyName}
          onClose={() => setShowIntake(false)}
          onSaved={async (changes: IntakeChange[]) => {
            if (changes.length === 0) return;
            try {
              // 1. Load latest OPORD (if exists)
              const opord = await getLatestDocById(ev.id, "opord");
              if (opord) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const opordData = (opord.data || {}) as Record<string, any>;
                const intakeToOpord: Record<string, string> = {
                  venueType: "venueType",
                  environment: "environment",
                  estimatedAttendance: "estimatedAttendance",
                  missionStatement: "missionStatement",
                  threatTypes: "threatTypes",
                  riskLevel: "riskLevel",
                  constraints: "knownConstraints",
                  medicalCapability: "medicalCapability",
                  commandModel: "commandModel",
                  escalationFlow: "escalationFlow",
                  successCriteria: "successCriteria",
                  additionalSuccessMeasures: "additionalSuccessMeasures",
                };
                let opordUpdated = false;
                const updatedOpordData = { ...opordData };
                for (const change of changes) {
                  const opordField = intakeToOpord[change.field];
                  if (opordField) {
                    updatedOpordData[opordField] = JSON.parse(change.to);
                    opordUpdated = true;
                  }
                }
                if (opordUpdated) {
                  updatedOpordData._intakeUpdated = true;
                  updatedOpordData._intakeUpdateDate = new Date().toISOString();
                  await updateDocumentById(opord.id, { data: updatedOpordData });
                }
              }

              // 2. Load latest GOTWA (if exists)
              const gotwa = await getLatestDocById(ev.id, "gotwa");
              if (gotwa) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gotwaData = (gotwa.data || {}) as Record<string, any>;
                const intakeToGotwa: Record<string, string> = {
                  missionStatement: "objective",
                  riskLevel: "status",
                };
                let gotwaUpdated = false;
                const updatedGotwaData = { ...gotwaData };
                for (const change of changes) {
                  const gotwaField = intakeToGotwa[change.field];
                  if (gotwaField) {
                    const parsed = JSON.parse(change.to);
                    updatedGotwaData[gotwaField] = typeof parsed === 'string' ? parsed : change.to;
                    gotwaUpdated = true;
                  }
                }
                if (gotwaUpdated) {
                  updatedGotwaData._intakeUpdated = true;
                  updatedGotwaData._intakeUpdateDate = new Date().toISOString();
                  await updateDocumentById(gotwa.id, { data: updatedGotwaData });
                }
              }

              // 3. Auto-create draft FRAGO
              const changeSummary = changes.map(c => `\u2022 ${c.label}: ${c.from || '(empty)'} \u2192 ${c.to || '(empty)'}`).join('\n');
              await createDocumentById({
                eventId: ev.id,
                companyId: activeCompanyId,
                docType: "frago",
                data: {
                  reason: "Intake document updated",
                  changes: changeSummary,
                  changesDetail: changes,
                  effectiveDateTime: new Date().toISOString(),
                  affectedElements: changes.map(c => c.label),
                  newTasking: "",
                  newCoordination: "",
                  supplyChanges: "",
                  commandChanges: "",
                  safetyUpdates: "",
                  issuerNotes: `Auto-generated from Intake update on ${new Date().toLocaleDateString()}`,
                },
              });

              toast.success(`Intake saved. ${opord ? 'OPORD updated. ' : ''}${gotwa ? 'GOTWA updated. ' : ''}Draft FRAGO created.`);
              await onReload();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (e: any) {
              console.error("Cascade failed:", e);
              toast.error(`Cascade update failed: ${e?.message || 'unknown error'}`);
            }
          }}
        />
      )}

      {/* ── Document Hub ── */}
      {showDocHub && (
        <DocHub
          eventId={ev.id}
          onClose={() => setShowDocHub(false)}
          onOpenDoc={async (type) => {
            setShowDocHub(false);
            if (type === "intake") setShowIntake(true);
            else if (type === "warno") setShowWarno(true);
            else if (type === "opord") setShowOpord(true);
            else if (type === "frago") setShowFrago(true);
            else if (type === "gotwa") setShowGotwa(true);
          }}
        />
      )}

      {/* ── OPORD Panel ── */}
      {showOpord && (
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
          onIssued={() => onReload()}
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
            {renderMemberOptions()}
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

      {/* ── Site Map ── */}
      {(() => {
        const hasSiteMap = !!ev.site_map_url;
        return (
          <div className="px-3 sm:px-4 py-3 border-b border-border/20">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
              <MapPin className="h-3 w-3" /> Site Map
            </p>
            {hasSiteMap ? (
              storyboardLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <StoryboardEditor
                  imageUrl={ev.site_map_url}
                  pins={storyboardPins}
                  onPinsChange={(newPins) => {
                    setStoryboardPins(newPins);
                    if (activeCompanyId && activeCompanyId !== "pending") {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      if ((window as any).__sbSaveTimer) clearTimeout((window as any).__sbSaveTimer);
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (window as any).__sbSaveTimer = setTimeout(async () => {
                        try {
                          const currentSbId = storyboardIdRef.current;
                          let incidentPins: StoryboardPin[] = [];
                          if (currentSbId) {
                            const fullSb = await loadStoryboard(ev.id);
                            if (fullSb?.pins) {
                              incidentPins = (fullSb.pins as StoryboardPin[]).filter(p => p.icon === "incident");
                            }
                          }
                          const mergedPins = [...newPins, ...incidentPins];
                          const result = await saveStoryboard(activeCompanyId, ev.id, mergedPins, currentSbId ?? undefined, internalUserId);
                          if (result && !currentSbId) {
                            setStoryboardId(result.id);
                            storyboardIdRef.current = result.id;
                          }
                          toast.success("Storyboard saved");
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        } catch (e: any) {
                          console.error("Failed to save storyboard:", e);
                          toast.error(`Storyboard save failed: ${e?.message || "unknown error"}`);
                        }
                      }, 600);
                    }
                  }}
                />
              )
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground/60">
                <MapPin className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
                <p>No site map uploaded. Edit this operation to add one.</p>
              </div>
            )}
          </div>
        );
      })()}

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
                          {renderMemberOptions()}
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
                                {renderMemberOptions()}
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
  );
}
