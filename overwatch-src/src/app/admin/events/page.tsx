"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Flag, MapPin, Plus, Loader2, ChevronDown, ChevronRight,
  Trash2, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  getEvents, deleteEvent, updateEventStatus, getEventShifts,
  getEventDocuments, getCompanyDetails,
} from "@/lib/supabase/db";
import { DocsPopup, DocViewerModal } from "@/components/ops/staff-doc-viewer";
import type { OperationDocument } from "@/types/operations";
import { usePageHeader } from "@/stores/page-header-store";
import { type Event, fmtDateShort } from "./components/shared";
import { CreateWizard } from "./components/create-wizard";
import { ConflictWarningModal, type ConflictWarningData } from "./components/conflict-warning-modal";
import { OperationDetail } from "./components/operation-detail";
import { getAssessment, type SiteAssessment } from "@/lib/supabase/db-assessments";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";

/* ── Component ─────────────────────────────────────────── */

export default function AdminEventsPage() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const internalUserId = useAuthStore((s) => s.user?.id ?? null);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const companyName = activeCompany?.companyName ?? "Company";
  const companyLogo = activeCompany?.companyLogo ?? undefined;
  const brandColor = activeCompany?.brandColor ?? "#6366f1";

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [initialAssessment, setInitialAssessment] = useState<SiteAssessment | null>(null);

  useEffect(() => {
    setHeader(
      "OPS PLANNING",
      "Plan and manage security operations",
      <Flag className="h-5 w-5" />,
      <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
        <Plus className="h-4 w-4" /> New Operation
      </Button>
    );
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyTimezone, setCompanyTimezone] = useState<string | undefined>();

  // Expanded op
  const expandParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("expand") : null;
  const [expanded, setExpanded] = useState<string | null>(expandParam);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);

  // Conflict warning
  const [conflictWarning, setConflictWarning] = useState<ConflictWarningData | null>(null);

  // Docs popup/viewer
  const [adminDocsPopup, setAdminDocsPopup] = useState<string | null>(null);
  const [adminViewingDoc, setAdminViewingDoc] = useState<OperationDocument | null>(null);
  const [adminEventDocs, setAdminEventDocs] = useState<Record<string, OperationDocument[]>>({});

  /* ── Data ── */

  const load = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [evts, co] = await Promise.all([
        getEvents(activeCompanyId),
        getCompanyDetails(activeCompanyId),
      ]);
      setEvents(evts);
      if (co?.timezone) setCompanyTimezone(co.timezone);
    } catch (e) { logger.swallow("admin-events:load", e, "warn"); } finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  // Handle fromAssessment URL param
  useEffect(() => {
    const assessmentId = searchParams.get("fromAssessment");
    if (assessmentId) {
      getAssessment(assessmentId).then(a => {
        if (a) {
          setInitialAssessment(a);
          setShowCreate(true);
        }
      });
    }
  }, [searchParams]);

  // Auto-expand operation from URL param
  const autoExpandedRef = useRef(false);
  useEffect(() => {
    if (expandParam && events.length > 0 && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      const ev = events.find((e: Event) => e.id === expandParam);
      if (ev) setExpanded(expandParam);
    }
  }, [expandParam, events]);

  /* ── Handlers ── */

  function toggleExpand(eventId: string) {
    setExpanded(expanded === eventId ? null : eventId);
  }

  async function handleStatusChange(eventId: string, ns: string) {
    try {
      await updateEventStatus(eventId, ns);
      if (ns === "published" || ns === "in_progress") {
        const ev = events.find((e: Event) => e.id === eventId);
        if (ev?.ops_guide && activeCompanyId) {
          const evShifts = await getEventShifts(eventId);
          const assignedIds = [...new Set<string>(evShifts.filter((s: Event) => s.assigned_user_id).map((s: Event) => s.assigned_user_id as string))];
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
    if (!await confirm({ description: "Delete this operation and all its shifts?", variant: "destructive", confirmLabel: "Delete" })) return;
    setDeletingEvent(eventId);
    try { await deleteEvent(eventId); if (expanded === eventId) setExpanded(null); await load(); toast.success("Operation deleted"); }
    catch (err) { console.error(err); toast.error("Failed to delete operation"); } finally { setDeletingEvent(null); }
  }

  return (
    <>
      <div className="space-y-6">
        {/* ── CREATE WIZARD ── */}
        {showCreate && activeCompanyId && (
          <CreateWizard
            activeCompanyId={activeCompanyId}
            companyName={companyName}
            companyTimezone={companyTimezone}
            initialAssessment={initialAssessment}
            onCreated={async () => {
              setShowCreate(false);
              if (initialAssessment) {
                setInitialAssessment(null);
                window.history.replaceState({}, "", "/overwatch/admin/events");
              }
              await load();
            }}
            onCancel={() => {
              setShowCreate(false);
              if (initialAssessment) {
                setInitialAssessment(null);
                window.history.replaceState({}, "", "/overwatch/admin/events");
              }
            }}
          />
        )}

        {/* ── Conflict Warning Modal ── */}
        {conflictWarning && (
          <ConflictWarningModal
            data={conflictWarning}
            onClose={() => setConflictWarning(null)}
          />
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

              return (
                <div key={ev.id} className="rounded-xl border border-border/50 bg-card overflow-visible">
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
                        <div className="relative hidden sm:block">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const eid = ev.id;
                            if (adminDocsPopup === eid) { setAdminDocsPopup(null); return; }
                            setAdminDocsPopup(eid);
                            if (!adminEventDocs[eid]) {
                              getEventDocuments(eid).then(docs => setAdminEventDocs(prev => ({ ...prev, [eid]: docs }))).catch(() => {});
                            }
                          }}
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${adminDocsPopup === ev.id ? "border-primary bg-primary/10 text-primary" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"}`}
                            title="View Documents">
                            <FileText className="h-3 w-3" /> Docs
                          </button>
                          {adminDocsPopup === ev.id && (
                            <DocsPopup
                              docs={adminEventDocs[ev.id] ?? []}
                              onViewDoc={(doc) => { setAdminDocsPopup(null); setAdminViewingDoc(doc); }}
                              onClose={() => setAdminDocsPopup(null)}
                            />
                          )}
                        </div>
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

                  {/* ── Expanded Operation Detail ── */}
                  {isExp && activeCompanyId && (
                    <OperationDetail
                      event={ev}
                      activeCompanyId={activeCompanyId}
                      internalUserId={internalUserId}
                      companyName={companyName}
                      companyLogo={companyLogo}
                      brandColor={brandColor}
                      onReload={load}
                      onConflictWarning={setConflictWarning}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Doc Viewer Modal (admin) ── */}
      {adminViewingDoc && (
        <DocViewerModal doc={adminViewingDoc} onClose={() => setAdminViewingDoc(null)} />
      )}
      <ConfirmDialog />
    </>
  );
}
