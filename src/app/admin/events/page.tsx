"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getEvents, createEvent } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Event = any;

export default function AdminEventsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setEvents(await getEvents(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim() || !startDate || !endDate || !activeCompanyId) return;
    setCreating(true);
    try {
      await createEvent({ companyId: activeCompanyId, name: name.trim(), location: location || undefined, startDate, endDate });
      setName(""); setLocation(""); setStartDate(""); setEndDate(""); setShowCreate(false); await load();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
            <p className="text-sm text-muted-foreground">Plan and manage security operations</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Operation
          </Button>
        </div>

        {showCreate && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Operation name *" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <div className="flex gap-2">
              <div className="flex-1"><label className="text-xs text-muted-foreground">Start</label><Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="flex-1"><label className="text-xs text-muted-foreground">End</label><Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!name.trim() || !startDate || !endDate || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No operations planned</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create your first operation to start building schedules.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev: Event) => (
              <div key={ev.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                  <MapPin className="h-5 w-5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{ev.name}</p>
                  <p className="text-xs text-muted-foreground">{ev.location ?? "No location"} · {new Date(ev.start_date).toLocaleDateString()}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] capitalize">{ev.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
