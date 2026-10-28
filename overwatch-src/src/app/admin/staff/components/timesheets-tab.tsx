"use client";

import { useState, useMemo, useEffect } from "react";
import { isLikelyAccidental, countsAsPending } from "@/lib/timesheets/accidental";
import Link from "next/link";
import {
  Clock, Loader2, ChevronDown, ChevronUp, Flag, Download, Trash2, FileSignature, UtensilsCrossed, Coffee, AlertTriangle, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCompanyTimesheets, approveTimesheet, unapproveTimesheet, deleteTimesheet } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import { formatLocaleDateRange, isSameDay, calcBreakSummary, calcPayableHoursNum } from "@/components/timeclock/timeclock-utils";
import { calculateBreakCompliance, resolveBreakPolicy, startBreak, endBreak } from "@/lib/supabase/db-breaks";
import { useActiveCompany } from "@/stores/auth-store";
import { toast } from "sonner";
import { exportCSV, TIMESHEET_COLUMNS, buildTimesheetCsvRows } from "@/lib/csv-export";
import { formatMemberName } from "@/lib/format-names";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { TimesheetVerifyBadge } from "@/components/timeclock/location-check";
import { clockInFlag } from "@/lib/supabase/db-timesheets";

function ClockInFlagBadge({ notes }: { notes?: string | null }) {
  const f = clockInFlag(notes);
  if (!f) return null;
  return <Badge className="text-[10px] bg-amber-500/15 text-amber-600" title={notes ?? undefined}>{f === "late" ? "Late clock-in" : "Early clock-in"}</Badge>;
}
import { DarSignoffView } from "@/components/timeclock/dar-signoff-view";
import { getSignedTimesheetIds } from "@/lib/supabase/db-dar";

type Sheet = Record<string, unknown> & {
  id: string;
  user_id?: string;
  approved?: boolean;
  clock_in: string;
  clock_out: string;
  users?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  events?: {
    name?: string;
  };
  shifts?: {
    events?: { name?: string };
  };
};

interface TimesheetsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function TimesheetsTab({ activeCompanyId, canManage }: TimesheetsTabProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const activeCompany = useActiveCompany();
  const policy = resolveBreakPolicy(activeCompany?.settings);
  const [breakActingId, setBreakActingId] = useState<string | null>(null);
  const { data: allTimesheets = [], isLoading: loading, refetch } = useCompanyQuery<Sheet[]>(
    "company-timesheets",
    (cid) => getCompanyTimesheets(cid),
  );
  const timesheets = useMemo(
    () => allTimesheets.filter((t: Sheet) => t.clock_out),
    [allTimesheets],
  );
  // Open (still clocked-in) sheets, shown separately so a supervisor can see a
  // live outside-the-fence clock-in before the officer clocks out.
  const openSheets = useMemo(
    () => allTimesheets.filter((t: Sheet) => !t.clock_out),
    [allTimesheets],
  );
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());
  const [openReport, setOpenReport] = useState<string | null>(null);
  const timesheetIdsKey = timesheets.map((t: Sheet) => t.id).join(",");
  useEffect(() => {
    let alive = true;
    const ids = timesheetIdsKey ? timesheetIdsKey.split(",") : [];
    getSignedTimesheetIds(ids).then((set) => { if (alive) setSignedIds(set); }).catch(() => {});
    return () => { alive = false; };
  }, [timesheetIdsKey]);
  const [approving, setApproving] = useState<string | null>(null);
  const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());
  const [syncingGusto, setSyncingGusto] = useState(false);
  const [gustoResult, setGustoResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncingQB, setSyncingQB] = useState(false);
  const [qbResult, setQBResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncingADP, setSyncingADP] = useState(false);
  const [adpResult, setADPResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncingPaychex, setSyncingPaychex] = useState(false);
  const [paychexResult, setPaychexResult] = useState<{ synced: number; errors: string[] } | null>(null);

  async function handleApprove(id: string) {
    setApproving(id);
    try {
      await approveTimesheet(id);
      // Notify employee their timesheet was approved
      const sheet = timesheets.find((t: Sheet) => t.id === id);
      const sheetUserId = sheet?.user_id;
      if (sheetUserId && activeCompanyId) {
        import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
          dispatch({
            userId: sheetUserId,
            companyId: activeCompanyId!,
            title: "Timesheet Approved",
            body: "Your timesheet has been approved by management.",
            type: "timesheet_approved",
            actionUrl: "/timeclock",
          }).catch(() => {});
        }).catch(() => {});
      }
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to approve timesheet");
    } finally { setApproving(null); }
  }

  async function handleUnapprove(id: string) {
    try {
      await unapproveTimesheet(id);
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to unapprove timesheet");
    }
  }

  async function handleDelete(id: string) {
    const sheet = timesheets.find((t: Sheet) => t.id === id);
    const name = sheet?.users ? formatMemberName(sheet.users) : "this entry";
    const isApproved = sheet?.approved;
    const msg = isApproved
      ? `Delete APPROVED timesheet for ${name}? This is permanent and cannot be undone.`
      : `Delete timesheet for ${name}? This cannot be undone.`;
    if (!await confirm({ description: msg, variant: "destructive", confirmLabel: "Delete" })) return;
    try {
      await deleteTimesheet(id);
      toast.success("Timesheet deleted");
      await refetch();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete timesheet");
    }
  }

  async function handleManagerBreakStart(timesheetId: string, type: "meal" | "rest") {
    setBreakActingId(timesheetId);
    try {
      await startBreak(timesheetId, type);
      toast.success(type === "meal" ? "Lunch break started" : "Rest break started");
      await refetch();
    } catch {
      toast.error("Failed to start break");
    } finally {
      setBreakActingId(null);
    }
  }

  async function handleManagerBreakEnd(timesheetId: string, breakId: string) {
    setBreakActingId(timesheetId);
    try {
      await endBreak(breakId);
      toast.success("Break ended");
      await refetch();
    } catch {
      toast.error("Failed to end break");
    } finally {
      setBreakActingId(null);
    }
  }

  const toggleOp = (key: string) => setCollapsedOps(prev => { const next = new Set(prev); if (next.has(key)) { next.delete(key); } else { next.add(key); } return next; });

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
        <Link href="/admin/settings/pay" className="inline-flex min-h-11 items-center text-xs text-primary hover:underline sm:min-h-0">Pay &amp; overtime rules</Link>
        {timesheets.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCSV(buildTimesheetCsvRows(timesheets, policy, signedIds), TIMESHEET_COLUMNS, `timesheets-${new Date().toISOString().slice(0,10)}`)}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        )}
      </div>
      {!loading && openSheets.length > 0 && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3" data-testid="timesheets-open">
          <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> On the clock now · {openSheets.length}
          </p>
          <div className="space-y-1">
            {openSheets.map((t: Sheet) => {
              const u = t.users;
              const op = t.events?.name ?? t.shifts?.events?.name ?? null;
              const summary = calcBreakSummary(t, policy);
              const activeBreak = summary.activeBreak;
              const netOpenHrs = Math.max(0, (Date.now() - parseUTC(t.clock_in).getTime() - summary.unpaidMinutes * 60000) / 3600000).toFixed(1);
              const isBusy = breakActingId === t.id;
              return (
                <div key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-lg border border-border/30 bg-background/50 px-3 sm:px-4 py-2.5">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600">
                      {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-sm">{formatMemberName(u ?? {})}</span>
                        <TimesheetVerifyBadge t={t} />
                        <ClockInFlagBadge notes={typeof t.notes === "string" ? t.notes : null} />
                        {activeBreak && (
                          <Badge className={`text-[10px] ${activeBreak.breakType === "meal" ? "bg-amber-500/15 text-amber-600" : "bg-sky-500/15 text-sky-600"}`}>
                            {activeBreak.breakType === "meal" ? "On Lunch" : "On Break"}
                          </Badge>
                        )}
                        {isLikelyAccidental(t) && <Badge className="text-[10px] bg-muted text-muted-foreground" title="Under a minute; probably a test or mis-tap. Not counted as pending.">Under 1 min · likely accidental</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground break-words">
                        {op ? `${op} · ` : ""}In since {!isSameDay(t.clock_in, new Date().toISOString()) ? `${parseUTC(t.clock_in).toLocaleDateString()} ` : ""}{parseUTC(t.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {summary.mealMinutes > 0 && ` · Lunch ${summary.mealMinutes}m`}
                        {summary.restMinutes > 0 && ` · Rest ${summary.restMinutes}m`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pl-12 sm:pl-0 shrink-0">
                    {canManage && policy.breaksEnabled && (
                      <div className="flex flex-wrap items-center gap-1">
                        {activeBreak ? (
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleManagerBreakEnd(t.id, activeBreak.id)} className="h-6 px-2 text-[10px] gap-1 border-amber-500/30 text-amber-600">
                            <Square className="h-2.5 w-2.5 fill-current" />
                            {activeBreak.breakType === "meal" ? "End Lunch" : "End Break"}
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleManagerBreakStart(t.id, "meal")} className="h-6 px-2 text-[10px] gap-1 border-amber-500/30 hover:bg-amber-500/10">
                              <UtensilsCrossed className="h-2.5 w-2.5 text-amber-500" /> Lunch ({policy.mealBreakMinutes}m)
                            </Button>
                            <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleManagerBreakStart(t.id, "rest")} className="h-6 px-2 text-[10px] gap-1 border-sky-500/30 hover:bg-sky-500/10">
                              <Coffee className="h-2.5 w-2.5 text-sky-500" /> Take {policy.restBreakMinutes}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                    <span className="font-mono text-sm font-semibold ml-auto sm:ml-0">{netOpenHrs}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : timesheets.length === 0 ? (openSheets.length > 0 ? null : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No timesheets yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Timesheets will appear here as your team clocks in and out.</p>
        </div>
      )) : (() => {
        const grouped: Record<string, Sheet[]> = {};
        timesheets.forEach((t: Sheet) => {
          const key = t.events?.name ?? t.shifts?.events?.name ?? "Other";
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(t);
        });
        const sortedKeys = Object.keys(grouped).sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
        return (
          <div className="space-y-3">
            {sortedKeys.map(opName => {
              const items = grouped[opName];
              const isCollapsed = collapsedOps.has(opName);
              const totalHrs = items.reduce((sum: number, t: Sheet) => sum + calcPayableHoursNum(t.clock_in, t.clock_out, t, policy), 0).toFixed(1);
              const unapproved = items.filter((t: Sheet) => countsAsPending(t)).length;
              return (
                <div key={opName} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  <button onClick={() => toggleOp(opName)} className="flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                    {opName === "Other" ? (
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Flag className="h-4 w-4 shrink-0 text-green-500" />
                    )}
                    <span className="font-semibold text-sm flex-1 min-w-0 truncate">{opName}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0 whitespace-nowrap">{items.length} entries · {totalHrs}h</span>
                    {unapproved > 0 && <Badge className="text-[10px] bg-amber-500/15 text-amber-500 shrink-0">{unapproved} pending</Badge>}
                    {isCollapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1.5 px-3 pb-3">
                      {items.map((t: Sheet) => {
                        const breakSummary = calcBreakSummary(t, policy);
                        const hours = calcPayableHoursNum(t.clock_in, t.clock_out, t, policy);
                        const hrs = hours.toFixed(1);
                        const compliance = calculateBreakCompliance(
                          t.clock_in,
                          t.clock_out,
                          Array.isArray(t.timesheet_breaks) ? (t.timesheet_breaks as never[]) : [],
                          policy,
                          t.id,
                        );
                        const u = t.users;
                        return (
                          <div key={t.id} className="rounded-lg border border-border/30 bg-background/50 px-3 sm:px-4 py-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600">
                                  {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium text-sm">{formatMemberName(u ?? {})}</span>
                                    <TimesheetVerifyBadge t={t} />
                                    <ClockInFlagBadge notes={typeof t.notes === "string" ? t.notes : null} />
                                    {isLikelyAccidental(t) && (
                                      <Badge className="text-[10px] bg-muted text-muted-foreground" title="Under a minute; probably a test or mis-tap. Not counted as pending.">
                                        Under 1 min · likely accidental
                                      </Badge>
                                    )}
                                    {breakSummary.mealCount > 0 && (
                                      <Badge variant="outline" className="text-[10px] gap-0.5 border-amber-500/30 text-amber-600 dark:text-amber-400">
                                        <UtensilsCrossed className="h-2.5 w-2.5" /> {breakSummary.mealMinutes}m lunch
                                      </Badge>
                                    )}
                                    {breakSummary.restCount > 0 && (
                                      <Badge variant="outline" className="text-[10px] gap-0.5 border-sky-500/30 text-sky-600 dark:text-sky-400">
                                        <Coffee className="h-2.5 w-2.5" /> {breakSummary.restCount}× rest ({breakSummary.restMinutes}m)
                                      </Badge>
                                    )}
                                    {compliance.mealBreakViolation && (
                                      <Badge variant="outline" className="text-[10px] gap-0.5 border-red-500/30 text-red-600 dark:text-red-400" title={`Shift was ${compliance.shiftHours}h; ${compliance.mealBreaksTaken}/${compliance.mealBreaksRequired} required meal break(s) logged`}>
                                        <AlertTriangle className="h-2.5 w-2.5" /> No meal break (&gt;{policy.firstMealAfterHours}h)
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-xs text-muted-foreground break-words">
                                    {formatLocaleDateRange(t.clock_in, t.clock_out)} · {parseUTC(t.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {parseUTC(t.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    {breakSummary.unpaidMinutes > 0 && ` (-${breakSummary.unpaidMinutes}m unpaid)`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2 pl-12 sm:pl-0 shrink-0">
                                {signedIds.has(t.id) && (
                                  <button type="button" onClick={() => setOpenReport(openReport === t.id ? null : t.id)}
                                    aria-expanded={openReport === t.id}
                                    className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/25"
                                    title="View the officer's signed shift notes" aria-label="Shift notes">
                                    <FileSignature className="h-3 w-3" /> <span className="hidden sm:inline">Shift Notes</span><span className="sm:hidden">Notes</span>
                                  </button>
                                )}
                                <span className="font-mono text-sm font-semibold mr-auto sm:mr-0">{hrs}h</span>
                                <div className="flex items-center gap-1">
                                  {t.approved ? (
                                    canManage ? (
                                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                                        onClick={() => handleUnapprove(t.id)}>
                                        Unapprove
                                      </Button>
                                    ) : (
                                      <Badge className="text-[10px] bg-green-500/15 text-green-600">Approved</Badge>
                                    )
                                  ) : (
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                                      onClick={() => handleApprove(t.id)} disabled={approving === t.id}>
                                      {approving === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                                    </Button>
                                  )}
                                  {canManage && (
                                    <button onClick={() => handleDelete(t.id)} className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Delete timesheet">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {openReport === t.id && (
                              <div className="mt-2"><DarSignoffView timesheetId={t.id} showEmpty /></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      {/* Gusto Sync Button */}
      {canManage && timesheets.filter((t: Sheet) => t.approved).length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono"
            onClick={async () => {
              if (!activeCompanyId) return;
              setSyncingGusto(true); setGustoResult(null);
              try {
                const { syncTimesheetsToGusto } = await import("@/lib/services/gusto-service");
                const approved = timesheets.filter((t: Sheet) => t.approved);
                const mapped = approved.map((t: Sheet) => ({
                  employeeEmail: t.users?.email ?? "",
                  date: parseUTC(t.clock_in).toISOString().split("T")[0],
                  hours: parseFloat(calcPayableHoursNum(t.clock_in, t.clock_out, t, policy).toFixed(2)),
                }));
                const result = await syncTimesheetsToGusto(activeCompanyId, mapped);
                setGustoResult(result);
                setTimeout(() => setGustoResult(null), 8000);
              } catch (err) {
                setGustoResult({ synced: 0, errors: [String(err)] });
              } finally { setSyncingGusto(false); }
            }} disabled={syncingGusto}>
            {syncingGusto ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Sync to Gusto
          </Button>
          {gustoResult && (
            <span className={`text-xs ${gustoResult.synced > 0 ? "text-green-600" : "text-amber-600"}`}>
              {gustoResult.synced > 0 ? `✓ ${gustoResult.synced} synced` : gustoResult.errors[0] ?? "No data synced"}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono"
            onClick={async () => {
              if (!activeCompanyId) return;
              setSyncingQB(true); setQBResult(null);
              try {
                const { syncTimesheetsToQuickBooks } = await import("@/lib/services/quickbooks-service");
                const approved = timesheets.filter((t: Sheet) => t.approved);
                const mapped = approved.map((t: Sheet) => ({
                  employeeEmail: t.users?.email ?? "",
                  date: parseUTC(t.clock_in).toISOString().split("T")[0],
                  hours: parseFloat(calcPayableHoursNum(t.clock_in, t.clock_out, t, policy).toFixed(2)),
                  eventName: t.events?.name,
                }));
                const result = await syncTimesheetsToQuickBooks(activeCompanyId, mapped);
                setQBResult(result);
                setTimeout(() => setQBResult(null), 8000);
              } catch (err) {
                setQBResult({ synced: 0, errors: [String(err)] });
              } finally { setSyncingQB(false); }
            }} disabled={syncingQB}>
            {syncingQB ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Sync to QuickBooks
          </Button>
          {qbResult && (
            <span className={`text-xs ${qbResult.synced > 0 ? "text-green-600" : "text-amber-600"}`}>
              {qbResult.synced > 0 ? `✓ ${qbResult.synced} synced` : qbResult.errors[0] ?? "No data synced"}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono"
            onClick={async () => {
              if (!activeCompanyId) return;
              setSyncingADP(true); setADPResult(null);
              try {
                const { syncTimesheetsToADP } = await import("@/lib/services/adp-service");
                const approved = timesheets.filter((t: Sheet) => t.approved);
                const mapped = approved.map((t: Sheet) => ({
                  employeeEmail: t.users?.email ?? "",
                  date: parseUTC(t.clock_in).toISOString().split("T")[0],
                  hours: parseFloat(calcPayableHoursNum(t.clock_in, t.clock_out, t, policy).toFixed(2)),
                  eventName: t.events?.name,
                }));
                const result = await syncTimesheetsToADP(activeCompanyId, mapped);
                setADPResult(result);
                setTimeout(() => setADPResult(null), 8000);
              } catch (err) {
                setADPResult({ synced: 0, errors: [String(err)] });
              } finally { setSyncingADP(false); }
            }} disabled={syncingADP}>
            {syncingADP ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Sync to ADP
          </Button>
          {adpResult && (
            <span className={`text-xs ${adpResult.synced > 0 ? "text-green-600" : "text-amber-600"}`}>
              {adpResult.synced > 0 ? `✓ ${adpResult.synced} synced` : adpResult.errors[0] ?? "No data synced"}
            </span>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono"
            onClick={async () => {
              if (!activeCompanyId) return;
              setSyncingPaychex(true); setPaychexResult(null);
              try {
                const { syncTimesheetsToPaychex } = await import("@/lib/services/paychex-service");
                const approved = timesheets.filter((t: Sheet) => t.approved);
                const mapped = approved.map((t: Sheet) => ({
                  employeeEmail: t.users?.email ?? "",
                  date: parseUTC(t.clock_in).toISOString().split("T")[0],
                  hours: parseFloat(calcPayableHoursNum(t.clock_in, t.clock_out, t, policy).toFixed(2)),
                  eventName: t.events?.name,
                }));
                const result = await syncTimesheetsToPaychex(activeCompanyId, mapped);
                setPaychexResult(result);
                setTimeout(() => setPaychexResult(null), 8000);
              } catch (err) {
                setPaychexResult({ synced: 0, errors: [String(err)] });
              } finally { setSyncingPaychex(false); }
            }} disabled={syncingPaychex}>
            {syncingPaychex ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Sync to Paychex
          </Button>
          {paychexResult && (
            <span className={`text-xs ${paychexResult.synced > 0 ? "text-green-600" : "text-amber-600"}`}>
              {paychexResult.synced > 0 ? `✓ ${paychexResult.synced} synced` : paychexResult.errors[0] ?? "No data synced"}
            </span>
          )}
        </div>
      )}
      <ConfirmDialog />
    </>
  );
}
