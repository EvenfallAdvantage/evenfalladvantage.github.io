"use client";

import { useState, useEffect } from "react";
import { Flag, Briefcase, CheckCircle2, AlertCircle, X, Send, Loader2, UtensilsCrossed, Coffee, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createTimeChangeRequest } from "@/lib/supabase/db";
import { getBreaksForTimesheet, calculateBreakCompliance, resolveBreakPolicy, type BreakRecord } from "@/lib/supabase/db-breaks";
import { useActiveCompany } from "@/stores/auth-store";
import { toast } from "sonner";
import { calcHours, calcPayableHours, calcBreakSummary, formatDate, formatTime, toDatetimeLocal, type Timesheet } from "./timeclock-utils";

interface ShiftDetailModalProps {
  entry: Timesheet;
  companyId: string | undefined;
  onClose: () => void;
}

export function ShiftDetailModal({ entry, companyId, onClose }: ShiftDetailModalProps) {
  const activeCompany = useActiveCompany();
  const policy = resolveBreakPolicy(activeCompany?.settings);

  const [requestMode, setRequestMode] = useState(false);
  const [reqClockIn, setReqClockIn] = useState(() => toDatetimeLocal(entry.clock_in));
  const [reqClockOut, setReqClockOut] = useState(() => entry.clock_out ? toDatetimeLocal(entry.clock_out) : "");
  const [reqReason, setReqReason] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);
  const [loadedBreaks, setLoadedBreaks] = useState<BreakRecord[] | null>(
    Array.isArray(entry.timesheet_breaks) ? (entry.timesheet_breaks as BreakRecord[]) : null,
  );

  useEffect(() => {
    if (Array.isArray(entry.timesheet_breaks)) {
      setLoadedBreaks(entry.timesheet_breaks as BreakRecord[]);
      return;
    }
    let cancelled = false;
    getBreaksForTimesheet(entry.id)
      .then((rows) => {
        if (!cancelled) setLoadedBreaks(rows);
      })
      .catch(() => {
        if (!cancelled) setLoadedBreaks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.timesheet_breaks]);

  const effectiveEntry = {
    ...entry,
    timesheet_breaks: loadedBreaks ?? entry.timesheet_breaks ?? [],
  };
  const breakSummary = calcBreakSummary(effectiveEntry, policy);
  const grossHours = calcHours(entry.clock_in, entry.clock_out);
  const payableHours = calcPayableHours(entry.clock_in, entry.clock_out, effectiveEntry, policy);
  const compliance = entry.clock_out
    ? calculateBreakCompliance(entry.clock_in, entry.clock_out, loadedBreaks ?? [], policy, entry.id)
    : null;

  async function handleSubmitChangeRequest() {
    if (!companyId || !reqReason.trim()) return;
    setSubmittingReq(true);
    try {
      await createTimeChangeRequest({
        timesheetId: entry.id,
        companyId,
        requestedClockIn: reqClockIn ? new Date(reqClockIn).toISOString() : undefined,
        requestedClockOut: reqClockOut ? new Date(reqClockOut).toISOString() : undefined,
        reason: reqReason.trim(),
      });
      onClose();
      toast.success("Time change request submitted");
    } catch (err) { console.error("Failed to submit time change request:", err); toast.error("Failed to submit request"); }
    finally { setSubmittingReq(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Shift Details</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium">{formatDate(entry.clock_in)}</span>
          </div>
          {entry.events?.name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Operation</span>
              <Badge variant="outline" className="text-[10px] gap-1 text-primary border-primary/30"><Flag className="h-2.5 w-2.5" /> {entry.events.name}</Badge>
            </div>
          )}
          {entry.clock_in_type === "admin" && !entry.events?.name && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-500/30"><Briefcase className="h-2.5 w-2.5" /> Admin / Off-Shift</Badge>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Clock In</span>
            <span className="font-mono font-medium">{formatTime(entry.clock_in)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Clock Out</span>
            <span className="font-mono font-medium">{entry.clock_out ? formatTime(entry.clock_out) : "Active"}</span>
          </div>
          {breakSummary.unpaidMinutes > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gross Duration</span>
              <span className="font-mono text-muted-foreground">{grossHours}h</span>
            </div>
          )}
          {breakSummary.totalMinutes > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Breaks Logged</span>
              <span className="font-mono">
                {breakSummary.mealMinutes > 0 ? `${breakSummary.mealMinutes}m lunch (${policy.mealBreakPaid ? "paid" : "unpaid"})` : ""}
                {breakSummary.mealMinutes > 0 && breakSummary.restMinutes > 0 ? " · " : ""}
                {breakSummary.restMinutes > 0 ? `${breakSummary.restMinutes}m rest (${policy.restBreakPaid ? "paid" : "unpaid"})` : ""}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payable Duration</span>
            <span className="font-mono font-bold text-primary">
              {payableHours}h
              {breakSummary.unpaidMinutes > 0 && (
                <span className="ml-1 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  (-{breakSummary.unpaidMinutes}m unpaid)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={entry.approved ? "default" : "secondary"} className="text-[10px] gap-1">
              {entry.approved ? <><CheckCircle2 className="h-2.5 w-2.5" /> Approved</> : <><AlertCircle className="h-2.5 w-2.5" /> Pending</>}
            </Badge>
          </div>
          {entry.notes && (
            <div className="pt-1 border-t border-border/30">
              <span className="text-muted-foreground block mb-0.5">Notes</span>
              <p className="text-foreground">{entry.notes}</p>
            </div>
          )}
        </div>

        {/* Breaks breakdown */}
        {breakSummary.breaks.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-1.5 text-xs">
            <span className="text-[11px] font-semibold text-muted-foreground block">Break Log</span>
            {breakSummary.breaks.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {b.breakType === "meal" ? (
                    <UtensilsCrossed className="h-3 w-3 text-amber-500" />
                  ) : (
                    <Coffee className="h-3 w-3 text-sky-500" />
                  )}
                  {b.breakType === "meal" ? "Meal / Lunch Break" : "Rest Break"}
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {b.paid ? "Paid" : "Unpaid"}
                  </Badge>
                </span>
                <span className="font-mono text-muted-foreground">
                  {formatTime(b.startTime)} — {b.endTime ? `${formatTime(b.endTime)} (${b.durationMinutes}m)` : "Active"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Break compliance warning */}
        {compliance && compliance.mealBreakViolation && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Meal break compliance flag: {compliance.mealBreaksTaken}/{compliance.mealBreaksRequired} required{" "}
              {policy.mealBreakMinutes}m meal break(s) recorded for a {compliance.shiftHours}h shift.
            </span>
          </div>
        )}

        {/* Request Change toggle / form */}
        {!requestMode ? (
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={() => setRequestMode(true)}>
            Request Time Adjustment
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium">Request Time Adjustment</p>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Corrected Clock In</label>
              <input type="datetime-local" value={reqClockIn} onChange={e => setReqClockIn(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Corrected Clock Out</label>
              <input type="datetime-local" value={reqClockOut} onChange={e => setReqClockOut(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground block mb-1">Reason for change *</label>
              <textarea value={reqReason} onChange={e => setReqReason(e.target.value)}
                placeholder="e.g. Forgot to clock out at end of shift, actual end was 6:00 PM"
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleSubmitChangeRequest} disabled={!reqReason.trim() || submittingReq}>
                {submittingReq ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Submit Request
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setRequestMode(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
