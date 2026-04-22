"use client";

import { useState } from "react";
import { ClipboardList, Loader2, Download, Clock, MapPin, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClientShell } from "@/components/layout/client-shell";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getEvents } from "@/lib/supabase/db";
import { generateEventDARs, type DailyActivityReport } from "@/lib/supabase/db-dar";
import { PageLoader } from "@/components/page-loader";

export default function ClientReportsPage() {
  const { data: events = [], isLoading } = useCompanyQuery(
    "client-events", (cid) => getEvents(cid)
  );

  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [dars, setDars] = useState<DailyActivityReport[]>([]);

  async function handleGenerate() {
    if (!selectedEvent || !selectedDate) { toast.error("Select an operation and date"); return; }
    setLoading(true);
    try {
      const reports = await generateEventDARs(selectedEvent, selectedDate);
      setDars(reports);
      if (reports.length === 0) toast.info("No completed shifts found for this date");
    } catch { toast.error("Failed to generate reports"); }
    finally { setLoading(false); }
  }

  function handleCopyAll() {
    const text = dars.map(d => [
      `=== Daily Activity Report ===`,
      `Staff: ${d.staffName}`,
      `Operation: ${d.eventName}`,
      `Date: ${d.date}`,
      `Hours: ${new Date(d.clockIn).toLocaleTimeString()} — ${new Date(d.clockOut).toLocaleTimeString()} (${d.totalHours}h)`,
      `Patrols: ${d.patrolCount} | Incidents: ${d.incidentCount} | Break: ${d.breakMinutes}m`,
      ``,
      ...d.entries.map(e => `${new Date(e.time).toLocaleTimeString()} [${e.type.replace("_", " ")}] ${e.description}`),
      ``,
    ].join("\n")).join("\n---\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Reports copied to clipboard");
  }

  const completedEvents = events.filter((e: { status: string }) =>
    e.status === "completed" || e.status === "in_progress"
  );

  return (
    <ClientShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Daily Activity Reports</h1>
          <p className="text-sm text-muted-foreground">View shift reports from your security team</p>
        </div>

        {isLoading ? <PageLoader /> : (
          <>
            {/* Report selector */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="dar-event" className="text-xs">Operation</Label>
                    <select id="dar-event" value={selectedEvent} onChange={(e) => setSelectedEvent(e.target.value)}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
                      <option value="">Select operation...</option>
                      {completedEvents.map((ev: { id: string; name: string }) => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="dar-date" className="text-xs">Date</Label>
                    <Input id="dar-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGenerate} disabled={loading || !selectedEvent} className="gap-2 w-full">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                      Generate
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {dars.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">{dars.length} Report{dars.length > 1 ? "s" : ""}</h2>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyAll}>
                    <Download className="h-3 w-3" /> Copy All
                  </Button>
                </div>

                {dars.map((dar, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{dar.staffName}</p>
                          <p className="text-[11px] text-muted-foreground">{dar.eventName} — {dar.date}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-[9px]">
                            <Clock className="h-2.5 w-2.5 mr-0.5" /> {dar.totalHours}h
                          </Badge>
                          {dar.patrolCount > 0 && (
                            <Badge variant="outline" className="text-[9px]">
                              <MapPin className="h-2.5 w-2.5 mr-0.5" /> {dar.patrolCount} patrols
                            </Badge>
                          )}
                          {dar.incidentCount > 0 && (
                            <Badge className="text-[9px] bg-amber-500/15 text-amber-500">
                              <Shield className="h-2.5 w-2.5 mr-0.5" /> {dar.incidentCount} incidents
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Activity timeline */}
                      <div className="space-y-1.5 border-l-2 border-border/40 pl-3 ml-1">
                        {dar.entries.map((entry, j) => (
                          <div key={j} className="text-[11px]">
                            <span className="font-mono text-muted-foreground/60 mr-2">
                              {new Date(entry.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className={
                              entry.type === "incident" ? "text-amber-600 font-medium" :
                              entry.type === "clock_in" || entry.type === "clock_out" ? "font-medium" :
                              "text-foreground/80"
                            }>
                              {entry.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ClientShell>
  );
}
