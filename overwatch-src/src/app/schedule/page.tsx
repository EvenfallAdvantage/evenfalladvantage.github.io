"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarDays, MapPin, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { getUpcomingEvents, getUserShifts } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ev = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SchedulePage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [events, setEvents] = useState<Ev[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [ev, sh] = await Promise.all([
        getUpcomingEvents(activeCompanyId),
        getUserShifts(activeCompanyId),
      ]);
      setEvents(ev);
      setShifts(sh);
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: string) => {
    if (s === "published" || s === "confirmed") return "bg-green-500/15 text-green-600";
    if (s === "draft") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" /> DEPLOYMENTS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Your assigned shifts and upcoming operations</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* My Shifts */}
            {shifts.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">My Assigned Shifts</h2>
                <div className="space-y-2">
                  {shifts.map((sh: Shift) => (
                    <Card key={sh.id} className="border-border/40">
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                          <Clock className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{sh.events?.name ?? "Shift"}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(sh.start_time)} · {fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                          </p>
                          {sh.role && <p className="text-xs text-muted-foreground mt-0.5">Role: {sh.role}</p>}
                        </div>
                        <Badge className={`text-[10px] capitalize ${statusColor(sh.status)}`}>{sh.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Events */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Upcoming Operations</h2>
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                  <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No upcoming operations</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Operations created by command will appear here when scheduled.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.map((ev: Ev) => (
                    <Card key={ev.id} className="border-border/40">
                      <CardContent className="flex items-center gap-4 py-3 px-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                          <MapPin className="h-5 w-5 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(ev.start_date)} · {fmtTime(ev.start_date)} — {fmtTime(ev.end_date)}
                          </p>
                          {ev.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" /> {ev.location}
                            </p>
                          )}
                        </div>
                        <Badge className={`text-[10px] capitalize ${statusColor(ev.status)}`}>{ev.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
