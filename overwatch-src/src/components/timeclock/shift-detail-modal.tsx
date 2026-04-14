"use client";

import { useState } from "react";
import { X, Timer, Flag, Briefcase, AlertCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatTime, formatFullDate, calcHours, type Timesheet } from "./timeclock-utils";
import { parseUTC } from "@/lib/parse-utc";
import { createTimeChangeRequest } from "@/lib/supabase/db";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { dispatch } from "@/lib/services/notification-dispatcher";
import { useAuthStore } from "@/stores/auth-store";

interface ShiftDetailModalProps {
  entry: Timesheet;
  companyId: string;
  onClose: () => void;
}

export function ShiftDetailModal({ entry, companyId, onClose }: ShiftDetailModalProps) {
  const authUser = useAuthStore((s) => s.user);

  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [changeClockIn, setChangeClockIn] = useState("");
  const [changeClockOut, setChangeClockOut] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);

  function timeToISO(timeStr: string, refISO: string): string {
    const ref = parseUTC(refISO);
    const [h, m] = timeStr.split(":").map(Number);
    return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), h, m, 0, 0).toISOString();
  }

  async function handleSubmitChangeRequest() {
    if (!entry || !companyId || !changeReason.trim()) return;
    setSubmittingChange(true);
    try {
      await createTimeChangeRequest({
        timesheetId: entry.id,
        companyId,
        requestedClockIn: changeClockIn ? timeToISO(changeClockIn, entry.clock_in) : undefined,
        requestedClockOut: changeClockOut && entry.clock_out ? timeToISO(changeClockOut, entry.clock_out) : undefined,
        reason: changeReason,
      });
      const userName = authUser?.firstName ? `${authUser.firstName} ${authUser.lastName ?? ""}`.trim() : "An employee";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import("@/lib/supabase/db").then((mod: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mod.getCompanyMembers(companyId).then((members: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const managers = members.filter((m: any) =>
            hasMinRole(m.role as CompanyRole, "manager") && m.users
          );
          for (const mgr of managers) {
            const u = Array.isArray(mgr.users) ? mgr.users[0] : mgr.users;
            if (!u?.id) continue;
            dispatch({
              userId: u.id,
              companyId,
              title: "Time Correction Request",
              body: `${userName} requested a time correction: "${changeReason}"`,
              type: "time_change_request",
              actionUrl: "/admin/staff",
              emailFallback: true,
              email: u.email,
            }).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});
      setChangeSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Time change request failed:", err);
    } finally {
      setSubmittingChange(false);
    }
  }

  function handleClose() {
    setShowChangeRequest(false);
    setChangeSuccess(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={handleClose}
          className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>

        <div className="p-6 space-y-5">
          {/* Header */}
          <div>
            <h3 className="text-lg font-bold font-mono">Shift Detail</h3>
            <p className="text-xs text-muted-foreground">{formatFullDate(entry.clock_in)}</p>
          </div>

          {/* Time details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clock In</p>
              <p className="text-lg font-mono font-bold">{formatTime(entry.clock_in)}</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clock Out</p>
              <p className="text-lg font-mono font-bold">{formatTime(entry.clock_out)}</p>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className="text-sm">Duration</span>
            </div>
            <span className="font-mono font-bold text-lg">{calcHours(entry.clock_in, entry.clock_out)}h</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={entry.approved ? "default" : "secondary"}>
              {entry.approved ? "Approved" : "Pending Review"}
            </Badge>
          </div>

          {entry.events?.name && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Operation</span>
              <div className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{entry.events.name}</span>
              </div>
            </div>
          )}

          {entry.clock_in_type === "admin" && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type</span>
              <div className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium text-amber-600">Admin / Off-Shift</span>
              </div>
            </div>
          )}

          {entry.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground block mb-1">Notes</span>
              <p className="text-xs bg-muted/30 rounded-md px-3 py-2">{entry.notes}</p>
            </div>
          )}

          {entry.clock_method && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Clock Method</span>
              <span className="capitalize">{entry.clock_method}</span>
            </div>
          )}

          {/* Time Change Request Section */}
          {!showChangeRequest ? (
            <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => setShowChangeRequest(true)}>
              <AlertCircle className="h-3.5 w-3.5" /> Request Time Correction
            </Button>
          ) : changeSuccess ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
              <p className="text-sm font-medium text-green-500">Request Submitted!</p>
              <p className="text-[10px] text-muted-foreground mt-1">Your manager will review this correction request.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400" /> Request Time Correction
              </h4>
              <p className="text-[10px] text-muted-foreground">Submit a correction request to your manager. Leave a field blank to keep the original time.</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Corrected Clock In</Label>
                  <Input type="time" value={changeClockIn} onChange={e => setChangeClockIn(e.target.value)}
                    className="h-8 text-xs mt-0.5" placeholder={formatTime(entry.clock_in)} />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Corrected Clock Out</Label>
                  <Input type="time" value={changeClockOut} onChange={e => setChangeClockOut(e.target.value)}
                    className="h-8 text-xs mt-0.5" placeholder={formatTime(entry.clock_out)} />
                </div>
              </div>

              <div>
                <Label className="text-[10px] text-muted-foreground">Reason for correction *</Label>
                <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)}
                  placeholder="e.g. Forgot to clock in at shift start, actual start was 6:00 AM"
                  className="mt-0.5 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-xs min-h-[60px] resize-none outline-none focus:border-primary/50" />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowChangeRequest(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 gap-1.5 text-xs" disabled={!changeReason.trim() || submittingChange}
                  onClick={handleSubmitChangeRequest}>
                  {submittingChange ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  Submit Request
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
