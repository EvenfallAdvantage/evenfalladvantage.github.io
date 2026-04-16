"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Loader2, FileText, Activity, DollarSign, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getEventShifts, getCompanyMembers,
  getLatestDocument, getEventAvailability,
  loadStoryboard, saveStoryboard,
} from "@/lib/supabase/db";
import { updateEventPayRate } from "@/lib/supabase/db-pay";
import type { OperationAvailability } from "@/lib/supabase/db-availability";
import { getAssessmentsByEventId, type SiteAssessment } from "@/lib/supabase/db-assessments";
import TlpTracker from "@/components/ops/tlp-tracker";
import type { TlpStep } from "@/types/operations";
import StoryboardEditor from "@/components/storyboard-editor";
import type { StoryboardPin } from "@/components/storyboard-editor";
import type { ConflictWarningData } from "./conflict-warning-modal";
import { type Event, type Shift, type Member } from "./shared";

import { StatsBar } from "./stats-bar";
import { ActivityFeed } from "./activity-feed";
import { AssessmentBadge } from "./assessment-linking";
import { DocumentPanels, type DocPanelType } from "./document-panels";
import { ShiftManagement } from "./shift-management";

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
  const [availability, setAvailability] = useState<OperationAvailability[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [mergedIntake, setMergedIntake] = useState<Record<string, any> | null>(null);

  // Linked assessment
  const [linkedAssessment, setLinkedAssessment] = useState<SiteAssessment | null>(null);

  // Document panel
  const [activeDocPanel, setActiveDocPanel] = useState<DocPanelType>(null);

  // Activity feed
  const [showActivity, setShowActivity] = useState(false);

  // Pay rate
  const [editingPayRate, setEditingPayRate] = useState(false);
  const [payRateInput, setPayRateInput] = useState("");
  const [currentPayRate, setCurrentPayRate] = useState<number | null>(ev.pay_rate != null ? Number(ev.pay_rate) : null);

  // Storyboard
  const [storyboardPins, setStoryboardPins] = useState<StoryboardPin[]>([]);
  const [_storyboardId, setStoryboardId] = useState<string | null>(null);
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

  /* ── Derived ── */

  const totalShifts = shifts.length;
  const filledShifts = shifts.filter((s: Shift) => s.assigned_user_id).length;
  const openShifts = totalShifts - filledShifts;
  const fillPct = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

  // Detect scheduling conflicts for stats
  const assignedShifts = shifts.filter((s: Shift) => s.assigned_user_id);
  const adminConflictIds = new Set<string>();
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

  const opDaysCount = (() => {
    const days: string[] = [];
    const s = new Date(ev.start_date); s.setHours(0, 0, 0, 0);
    const e = new Date(ev.end_date); e.setHours(0, 0, 0, 0);
    const cur = new Date(s);
    while (cur <= e) { days.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate() + 1); }
    return days.length;
  })();

  /* ── Storyboard save handler ── */

  function handleStoryboardPinsChange(newPins: StoryboardPin[]) {
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
  }

  async function saveEventPayRate() {
    const rate = payRateInput.trim() === "" ? null : parseFloat(payRateInput);
    if (rate !== null && (isNaN(rate) || rate < 0)) { toast.error("Invalid rate"); return; }
    try {
      await updateEventPayRate(ev.id, rate);
      setCurrentPayRate(rate);
      toast.success("Event pay rate updated");
      setEditingPayRate(false);
    } catch { toast.error("Failed to update pay rate"); }
  }

  return (
    <div className="border-t border-border/30 bg-muted/20">
      {/* Stats Bar */}
      <StatsBar
        totalShifts={totalShifts}
        filledShifts={filledShifts}
        openShifts={openShifts}
        fillPct={fillPct}
        conflictCount={adminConflictIds.size}
        opDaysCount={opDaysCount}
        availability={availability}
        membersCount={members.length}
      />

      {/* TLP Pipeline */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-border/20 bg-muted/20 overflow-x-auto">
        <TlpTracker currentStep={(ev.tlp_step as TlpStep) || "receive_mission"} compact />
      </div>

      {/* Shift toolbar + docs / activity / assessment buttons */}
      <ShiftManagement
        eventId={ev.id}
        startDate={ev.start_date}
        endDate={ev.end_date}
        shifts={shifts}
        members={members}
        availability={availability}
        onShiftsChange={setShifts}
        onConflictWarning={onConflictWarning}
        eventTimezone={ev.timezone ?? undefined}
      />

      {/* Secondary action bar: Docs, Activity, Assessment */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 border-b border-border/20">
        <Button size="sm" variant={activeDocPanel === "dochub" ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setActiveDocPanel(activeDocPanel === "dochub" ? null : "dochub"); setShowActivity(false); }}>
          <FileText className="h-3.5 w-3.5" /> Docs
        </Button>
        <Button size="sm" variant={showActivity ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowActivity(!showActivity); setActiveDocPanel(null); }}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Button>
        <AssessmentBadge
          eventId={ev.id}
          activeCompanyId={activeCompanyId}
          linkedAssessment={linkedAssessment}
          onLinkedAssessmentChange={setLinkedAssessment}
        />
        {/* Pay Rate */}
        <div className="ml-auto flex items-center gap-1.5">
          {editingPayRate ? (
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-500" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={payRateInput}
                onChange={(e) => setPayRateInput(e.target.value)}
                className="w-16 h-6 text-xs rounded border border-border bg-background px-1 text-right"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveEventPayRate(); if (e.key === "Escape") setEditingPayRate(false); }}
              />
              <span className="text-[10px] text-muted-foreground">/hr</span>
              <button onClick={saveEventPayRate} className="text-green-500 hover:text-green-400"><Check className="h-3 w-3" /></button>
              <button onClick={() => setEditingPayRate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingPayRate(true); setPayRateInput(currentPayRate?.toString() ?? ""); }}
              className="flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-border/40 hover:border-border hover:bg-muted/50 transition-colors"
              title="Set event pay rate"
            >
              <DollarSign className="h-3 w-3 text-green-500" />
              {currentPayRate != null
                ? <span className="text-green-500 font-medium">${currentPayRate.toFixed(2)}/hr</span>
                : <span className="text-muted-foreground">Pay Rate</span>
              }
            </button>
          )}
        </div>
      </div>

      {/* Document Panels */}
      <DocumentPanels
        eventId={ev.id}
        activeCompanyId={activeCompanyId}
        eventName={ev.name}
        eventStart={ev.start_date}
        eventEnd={ev.end_date}
        eventLocation={ev.location ?? ""}
        companyName={companyName}
        companyLogo={companyLogo}
        brandColor={brandColor}
        mergedIntake={mergedIntake}
        activePanel={activeDocPanel}
        onPanelChange={setActiveDocPanel}
        onReload={onReload}
      />

      {/* Activity Feed */}
      <ActivityFeed eventId={ev.id} visible={showActivity} />

      {/* Site Map */}
      <div className="px-3 sm:px-4 py-3 border-b border-border/20">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
          <MapPin className="h-3 w-3" /> Site Map
        </p>
        {ev.site_map_url ? (
          storyboardLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <StoryboardEditor
              imageUrl={ev.site_map_url}
              pins={storyboardPins}
              onPinsChange={handleStoryboardPinsChange}
            />
          )
        ) : (
          <div className="text-center py-6 text-xs text-muted-foreground/60">
            <MapPin className="h-6 w-6 mx-auto text-muted-foreground/30 mb-1" />
            <p>No site map uploaded. Edit this operation to add one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
