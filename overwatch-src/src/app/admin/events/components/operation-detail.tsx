"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Loader2, FileText, Activity, ChevronDown, ScrollText, Save, Pencil, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getEventShifts, getCompanyMembers,
  getLatestDocument, getEventAvailability,
  loadStoryboard, saveStoryboard,
  getEventPostOrders, updateEventPostOrders,
} from "@/lib/supabase/db";
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
import { logger } from "@/lib/logger";

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

  // Post Orders
  const [postOrders, setPostOrders] = useState("");
  const [postOrdersEditing, setPostOrdersEditing] = useState(false);
  const [postOrdersDraft, setPostOrdersDraft] = useState("");
  const [postOrdersSaving, setPostOrdersSaving] = useState(false);
  const [postOrdersOpen, setPostOrdersOpen] = useState(false);

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
      const guide = (ev?.ops_guide ?? {}) as Record<string, string>;
      const intake = (intakeDoc?.data as Record<string, unknown>) ?? {};
      setMergedIntake({
        ...guide, ...intake,
        location: ev?.location || guide.siteAddress || "",
        startDate: ev?.start_date || "",
        endDate: ev?.end_date || "",
        radioChannels: (intake.radioChannels as string) || guide.radioChannels || "",
      });

      // Load linked assessment
      try {
        const assessments = await getAssessmentsByEventId(ev.id);
        if (assessments.length > 0) setLinkedAssessment(assessments[0]);
      } catch (e) { logger.swallow("operation-detail:load-assessment", e, "debug"); }

      // Load post orders
      try {
        const po = await getEventPostOrders(ev.id);
        if (po) { setPostOrders(po); setPostOrdersDraft(po); }
      } catch (e) { logger.swallow("operation-detail:load-post-orders", e, "debug"); }

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
    if (activeCompanyId) {
      if (window.__sbSaveTimer) clearTimeout(window.__sbSaveTimer);
      window.__sbSaveTimer = setTimeout(async () => {
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

  async function savePostOrders() {
    setPostOrdersSaving(true);
    try {
      await updateEventPostOrders(ev.id, postOrdersDraft);
      setPostOrders(postOrdersDraft);
      setPostOrdersEditing(false);
      toast.success("Post orders saved");
    } catch { toast.error("Failed to save post orders"); }
    finally { setPostOrdersSaving(false); }
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
        companyId={activeCompanyId}
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
        {(ev.status === "completed" || ev.status === "in_progress") && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
            onClick={async () => {
              try {
                const { generateEventDARs } = await import("@/lib/supabase/db-dar");
                const today = new Date().toISOString().split("T")[0];
                const dars = await generateEventDARs(ev.id, today);
                if (dars.length === 0) { toast.info("No completed shifts found for today"); return; }
                // Build a simple text DAR and copy to clipboard
                const text = dars.map(d => [
                  `=== DAR: ${d.staffName} — ${d.eventName} (${d.date}) ===`,
                  `Clock: ${new Date(d.clockIn).toLocaleTimeString()} — ${new Date(d.clockOut).toLocaleTimeString()} (${d.totalHours}h)`,
                  `Patrols: ${d.patrolCount} | Incidents: ${d.incidentCount} | Break: ${d.breakMinutes}m`,
                  ...d.entries.map(e => `  ${new Date(e.time).toLocaleTimeString()} [${e.type}] ${e.description}`),
                  "",
                ].join("\n")).join("\n");
                await navigator.clipboard.writeText(text);
                toast.success(`${dars.length} DAR${dars.length > 1 ? "s" : ""} copied to clipboard`);
              } catch (err) { toast.error("Failed to generate DARs"); console.error(err); }
            }}>
            <ClipboardList className="h-3.5 w-3.5" /> DAR
          </Button>
        )}
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

      {/* Post Orders */}
      <div className="px-3 sm:px-4 py-3 border-b border-border/20">
        <button
          onClick={() => setPostOrdersOpen(!postOrdersOpen)}
          className="flex items-center gap-1.5 w-full text-left"
        >
          <ScrollText className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Post Orders</span>
          {postOrders && <Badge variant="secondary" className="text-[9px] ml-1">{postOrders.length} chars</Badge>}
          <ChevronDown className={`h-3 w-3 ml-auto text-muted-foreground transition-transform ${postOrdersOpen ? "" : "-rotate-90"}`} />
        </button>
        {postOrdersOpen && (
          <div className="mt-2 space-y-2">
            {postOrdersEditing ? (
              <>
                <textarea
                  value={postOrdersDraft}
                  onChange={(e) => setPostOrdersDraft(e.target.value)}
                  placeholder="Enter post orders, standing instructions, and procedures for this operation..."
                  rows={8}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{postOrdersDraft.length} characters</span>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={savePostOrders} disabled={postOrdersSaving}>
                      {postOrdersSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setPostOrdersEditing(false); setPostOrdersDraft(postOrders); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {postOrders ? (
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono bg-muted/30 rounded-lg p-3 max-h-64 overflow-y-auto">{postOrders}</pre>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">No post orders set for this operation.</p>
                )}
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setPostOrdersEditing(true); setPostOrdersDraft(postOrders); }}>
                  <Pencil className="h-3 w-3" /> {postOrders ? "Edit" : "Add Post Orders"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

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
