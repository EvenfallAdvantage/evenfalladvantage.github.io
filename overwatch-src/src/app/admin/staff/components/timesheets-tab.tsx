"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock, Loader2, ChevronDown, ChevronUp, Flag, Download, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCompanyTimesheets, approveTimesheet, unapproveTimesheet, deleteTimesheet } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import { exportCSV, TIMESHEET_COLUMNS } from "@/lib/csv-export";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;

interface TimesheetsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function TimesheetsTab({ activeCompanyId, canManage }: TimesheetsTabProps) {
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [collapsedOps, setCollapsedOps] = useState<Set<string>>(new Set());
  const [syncingGusto, setSyncingGusto] = useState(false);
  const [gustoResult, setGustoResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncingQB, setSyncingQB] = useState(false);
  const [qbResult, setQBResult] = useState<{ synced: number; errors: string[] } | null>(null);
  const [syncingADP, setSyncingADP] = useState(false);
  const [adpResult, setADPResult] = useState<{ synced: number; errors: string[] } | null>(null);

  const loadData = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const ts = await getCompanyTimesheets(activeCompanyId);
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
    } catch (e) { logger.swallow("timesheets-admin:load", e, "warn"); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id: string) {
    setApproving(id);
    try {
      await approveTimesheet(id);
      // Notify employee their timesheet was approved
      const sheet = timesheets.find((t: Sheet) => t.id === id);
      if (sheet?.user_id && activeCompanyId) {
        import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
          dispatch({
            userId: sheet.user_id,
            companyId: activeCompanyId!,
            title: "Timesheet Approved",
            body: "Your timesheet has been approved by management.",
            type: "timesheet_approved",
            actionUrl: "/timeclock",
          }).catch(() => {});
        }).catch(() => {});
      }
      await loadData();
    } catch (err) { console.error(err); }
    finally { setApproving(null); }
  }

  async function handleUnapprove(id: string) {
    try {
      await unapproveTimesheet(id);
      await loadData();
    } catch (err) { console.error(err); }
  }

  async function handleDelete(id: string) {
    const sheet = timesheets.find((t: Sheet) => t.id === id);
    const name = sheet?.users ? `${sheet.users.first_name} ${sheet.users.last_name}` : "this entry";
    const isApproved = sheet?.approved;
    const msg = isApproved
      ? `Delete APPROVED timesheet for ${name}? This is permanent and cannot be undone.`
      : `Delete timesheet for ${name}? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      await deleteTimesheet(id);
      await loadData();
    } catch (err) { console.error(err); }
  }

  const toggleOp = (key: string) => setCollapsedOps(prev => { const next = new Set(prev); if (next.has(key)) { next.delete(key); } else { next.add(key); } return next; });

  return (
    <>
      {timesheets.length > 0 && (
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => exportCSV(timesheets, TIMESHEET_COLUMNS, `timesheets-${new Date().toISOString().slice(0,10)}`)}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : timesheets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No timesheets yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Timesheets will appear here as your team clocks in and out.</p>
        </div>
      ) : (() => {
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
              const totalHrs = items.reduce((sum: number, t: Sheet) => sum + (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000, 0).toFixed(1);
              const totalPay = items.reduce((sum: number, t: Sheet) => {
                const h = (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000;
                const r = t.events?.pay_rate != null ? Number(t.events.pay_rate) : null;
                return sum + (r != null ? h * r : 0);
              }, 0);
              const unapproved = items.filter((t: Sheet) => !t.approved).length;
              return (
                <div key={opName} className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
                  <button onClick={() => toggleOp(opName)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                    {opName === "Other" ? (
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Flag className="h-4 w-4 text-green-500" />
                    )}
                    <span className="font-semibold text-sm flex-1">{opName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{items.length} entries · {totalHrs}h{totalPay > 0 ? ` · $${totalPay.toFixed(2)}` : ""}</span>
                    {unapproved > 0 && <Badge className="text-[10px] bg-amber-500/15 text-amber-500">{unapproved} pending</Badge>}
                    {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1 px-3 pb-3">
                      {items.map((t: Sheet) => {
                        const hours = (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000;
                        const hrs = hours.toFixed(1);
                        const eventRate = t.events?.pay_rate != null ? Number(t.events.pay_rate) : null;
                        const u = t.users;
                        return (
                          <div key={t.id} className="flex items-center gap-4 rounded-lg border border-border/30 bg-background/50 px-4 py-2.5 flex-wrap">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600">
                              {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {parseUTC(t.clock_in).toLocaleDateString()} · {parseUTC(t.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {parseUTC(t.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <span className="font-mono text-sm font-semibold">{hrs}h</span>
                            <span className="text-xs text-muted-foreground font-mono w-16 text-right">
                              {eventRate != null ? `$${eventRate.toFixed(2)}/hr` : "—"}
                            </span>
                            <span className="text-xs font-medium font-mono w-16 text-right">
                              {eventRate != null ? `$${(hours * eventRate).toFixed(2)}` : "—"}
                            </span>
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
        <div className="mt-4 flex items-center gap-3">
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
                  hours: parseFloat(((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(2)),
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
                  hours: parseFloat(((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(2)),
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
                  hours: parseFloat(((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(2)),
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
        </div>
      )}
    </>
  );
}
