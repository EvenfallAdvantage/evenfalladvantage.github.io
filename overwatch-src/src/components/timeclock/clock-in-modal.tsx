"use client";

import { LogIn, Loader2, X, CalendarDays, MapPin, Flag, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTime, type Shift } from "./timeclock-utils";

interface ClockInModalProps {
  detectedShifts: Shift[];
  loadingShifts: boolean;
  acting: boolean;
  adminNotes: string;
  onAdminNotesChange: (notes: string) => void;
  onShiftClockIn: (shift: Shift) => void;
  onAdminClockIn: () => void;
  onQuickClockIn: () => void;
  onClose: () => void;
}

export function ClockInModal({
  detectedShifts,
  loadingShifts,
  acting,
  adminNotes,
  onAdminNotesChange,
  onShiftClockIn,
  onAdminClockIn,
  onQuickClockIn,
  onClose,
}: ClockInModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>

        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold font-mono">Clock In</h3>
            <p className="text-xs text-muted-foreground">Select what you&apos;re clocking in for</p>
          </div>

          {loadingShifts ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {/* Detected shifts */}
              {detectedShifts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active / Upcoming Shifts</p>
                  {detectedShifts.map((sh: Shift) => (
                    <button key={sh.id} onClick={() => onShiftClockIn(sh)} disabled={acting}
                      className="w-full rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-left hover:bg-green-500/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                          <Flag className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{sh.events?.name ?? "Shift"}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(sh.start_time)} — {formatTime(sh.end_time)}
                          </p>
                          {sh.events?.location && (
                            <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                              <MapPin className="h-2.5 w-2.5" /> {sh.events.location}
                            </p>
                          )}
                        </div>
                        {sh.role && <Badge variant="outline" className="text-[9px] shrink-0">{sh.role}</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {detectedShifts.length === 0 && (
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No active shifts found</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">You don&apos;t have a shift starting within 30 minutes</p>
                </div>
              )}

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span></div>
              </div>

              {/* Admin / Off-Shift clock-in */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  <p className="text-sm font-semibold">Admin / Off-Shift Work</p>
                </div>
                <p className="text-[10px] text-muted-foreground">Clock in for administrative tasks or work outside of a scheduled operation.</p>
                <textarea
                  value={adminNotes}
                  onChange={(e) => onAdminNotesChange(e.target.value)}
                  placeholder="What are you working on? (required)"
                  className="w-full rounded-lg border border-amber-500/20 bg-background px-3 py-2 text-xs min-h-[60px] resize-none outline-none focus:border-amber-500/50 placeholder:text-muted-foreground/50"
                />
                <Button size="sm" className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700"
                  onClick={onAdminClockIn} disabled={!adminNotes.trim() || acting}>
                  {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  Clock In (Admin)
                </Button>
              </div>

              {/* Quick clock-in fallback */}
              <button onClick={onQuickClockIn} disabled={acting}
                className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                or clock in without linking to an operation →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
