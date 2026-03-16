"use client";

import { useEffect, useState, useCallback } from "react";
import { MapPin, Plus, Loader2, Clock, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getEvents, createEvent, getEventShifts, createShift, getCompanyMembers, deleteEvent, deleteShift, updateEventStatus } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Event = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddShift, setShowAddShift] = useState(false);
  const [shiftRole, setShiftRole] = useState("");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [shiftAssign, setShiftAssign] = useState("");
  const [addingShift, setAddingShift] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setEvents(await getEvents(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!name.trim() || !startDate || !endDate || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createEvent({ companyId: activeCompanyId, name: name.trim(), location: location || undefined, startDate, endDate });
      setName(""); setLocation(""); setStartDate(""); setEndDate(""); setShowCreate(false); await load();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function toggleExpand(eventId: string) {
    if (expanded === eventId) { setExpanded(null); return; }
    setExpanded(eventId);
    setShowAddShift(false);
    try {
      const [s, m] = await Promise.all([
        getEventShifts(eventId),
        activeCompanyId ? getCompanyMembers(activeCompanyId) : Promise.resolve([]),
      ]);
      setShifts(s);
      setMembers(m);
    } catch { setShifts([]); }
  }

  async function handleStatusChange(eventId: string, newStatus: string) {
    try { await updateEventStatus(eventId, newStatus); await load(); }
    catch (err) { console.error(err); }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this operation and all its shifts?")) return;
    setDeletingEvent(eventId);
    try { await deleteEvent(eventId); if (expanded === eventId) setExpanded(null); await load(); }
    catch (err) { console.error(err); }
    finally { setDeletingEvent(null); }
  }

  async function handleDeleteShift(shiftId: string) {
    if (!confirm("Delete this shift?")) return;
    setDeletingShift(shiftId);
    try { await deleteShift(shiftId); if (expanded) setShifts(await getEventShifts(expanded)); }
    catch (err) { console.error(err); }
    finally { setDeletingShift(null); }
  }

  async function handleAddShift() {
    if (!expanded || !shiftStart || !shiftEnd) return;
    setAddingShift(true);
    try {
      await createShift({ eventId: expanded, role: shiftRole || undefined, startTime: shiftStart, endTime: shiftEnd, assignedUserId: shiftAssign || undefined });
      setShiftRole(""); setShiftStart(""); setShiftEnd(""); setShiftAssign(""); setShowAddShift(false);
      setShifts(await getEventShifts(expanded));
    } catch (err) { console.error(err); }
    finally { setAddingShift(false); }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><MapPin className="h-5 w-5 sm:h-6 sm:w-6" /> OPERATIONS</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Plan and manage security operations</p>
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
              <div key={ev.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggleExpand(ev.id)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                    <MapPin className="h-5 w-5 text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ev.name}</p>
                    <p className="text-xs text-muted-foreground">{ev.location ?? "No location"} · {new Date(ev.start_date).toLocaleDateString()}</p>
                  </div>
                  <select
                    value={ev.status}
                    onChange={(e) => { e.stopPropagation(); handleStatusChange(ev.id, e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 appearance-none rounded border border-border/40 bg-background px-2 pr-5 text-[10px] font-medium capitalize cursor-pointer"
                  >
                    {["draft", "published", "in_progress", "completed", "cancelled"].map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }} disabled={deletingEvent === ev.id}
                    className="rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete operation">
                    {deletingEvent === ev.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                  {expanded === ev.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>

                {expanded === ev.id && (
                  <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Shifts</h3>
                      <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={() => setShowAddShift(true)}>
                        <Plus className="h-3 w-3" /> Add Shift
                      </Button>
                    </div>

                    {showAddShift && (
                      <div className="space-y-2 rounded-lg border border-primary/30 bg-card p-3">
                        <Input placeholder="Role (e.g. Guard, Supervisor)" value={shiftRole} onChange={(e) => setShiftRole(e.target.value)} className="h-8 text-sm" />
                        <div className="flex gap-2">
                          <div className="flex-1"><label className="text-[10px] text-muted-foreground">Start</label><Input type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} className="h-8 text-sm" /></div>
                          <div className="flex-1"><label className="text-[10px] text-muted-foreground">End</label><Input type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} className="h-8 text-sm" /></div>
                        </div>
                        <select value={shiftAssign} onChange={(e) => setShiftAssign(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                          <option value="">Unassigned (open shift)</option>
                          {members.map((m: Member) => (
                            <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}</option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <Button size="sm" className="h-7 text-xs" onClick={handleAddShift} disabled={!shiftStart || !shiftEnd || addingShift}>
                            {addingShift ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAddShift(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {shifts.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No shifts created yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {shifts.map((sh: Shift) => (
                          <div key={sh.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2">
                            <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <div className="flex-1 min-w-0 text-xs">
                              <span className="font-medium">{sh.role ?? "Shift"}</span>
                              <span className="text-muted-foreground ml-2">
                                {new Date(sh.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {new Date(sh.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            {sh.users ? (
                              <span className="text-xs text-primary font-medium">{sh.users.first_name} {sh.users.last_name}</span>
                            ) : (
                              <Badge variant="outline" className="text-[9px]">Open</Badge>
                            )}
                            <button onClick={() => handleDeleteShift(sh.id)} disabled={deletingShift === sh.id}
                              className="rounded p-0.5 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete shift">
                              {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
