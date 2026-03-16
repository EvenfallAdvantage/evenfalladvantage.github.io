"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Flag, MapPin, Plus, Loader2, Clock, ChevronDown, ChevronRight,
  Trash2, Zap, Calendar, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getEvents, createEvent, getEventShifts, createShift,
  getCompanyMembers, deleteEvent, deleteShift, updateEventStatus,
  assignShift,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Event = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

/* ── Helpers ───────────────────────────────────────────── */

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const cur = new Date(s);
  while (cur <= e) {
    days.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const PATTERNS: Record<string, { label: string; sH: number; sM: number; eH: number; eM: number; overnight: boolean }[]> = {
  "8": [
    { label: "Day",   sH: 6,  sM: 0, eH: 14, eM: 0, overnight: false },
    { label: "Swing", sH: 14, sM: 0, eH: 22, eM: 0, overnight: false },
    { label: "Night", sH: 22, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
  "12": [
    { label: "Day",   sH: 6,  sM: 0, eH: 18, eM: 0, overnight: false },
    { label: "Night", sH: 18, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
};

function toISO(dateStr: string, h: number, m: number, nextDay: boolean) {
  const d = new Date(dateStr + "T00:00:00");
  if (nextDay) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const m = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const day = new Date(sh.start_time).toISOString().split("T")[0];
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(sh);
  }
  return m;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

/* ── Component ─────────────────────────────────────────── */

export default function AdminEventsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Expanded op
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [deletingEvent, setDeletingEvent] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState<string | null>(null);

  // Quick Fill builder
  const [posts, setPosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [pattern, setPattern] = useState<"8" | "12">("8");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Custom shift
  const [showCustom, setShowCustom] = useState(false);
  const [cRole, setCRole] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cAssign, setCAssign] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  /* ── Data ── */

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
    setPosts([]); setSelectedDays(new Set()); setShowCustom(false); setShowBuilder(false);
    try {
      const [s, m] = await Promise.all([
        getEventShifts(eventId),
        activeCompanyId ? getCompanyMembers(activeCompanyId) : Promise.resolve([]),
      ]);
      setShifts(s); setMembers(m);
    } catch { setShifts([]); }
  }

  async function handleStatusChange(eventId: string, ns: string) {
    try { await updateEventStatus(eventId, ns); await load(); } catch (err) { console.error(err); }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm("Delete this operation and all its shifts?")) return;
    setDeletingEvent(eventId);
    try { await deleteEvent(eventId); if (expanded === eventId) setExpanded(null); await load(); }
    catch (err) { console.error(err); } finally { setDeletingEvent(null); }
  }

  async function handleDeleteShift(shiftId: string) {
    setDeletingShift(shiftId);
    try { await deleteShift(shiftId); if (expanded) setShifts(await getEventShifts(expanded)); }
    catch (err) { console.error(err); } finally { setDeletingShift(null); }
  }

  async function handleAssign(shiftId: string, userId: string) {
    try { await assignShift(shiftId, userId || null); if (expanded) setShifts(await getEventShifts(expanded)); }
    catch (err) { console.error(err); }
  }

  /* ── Quick Fill: Generate ── */

  async function handleGenerate() {
    if (!expanded || posts.length === 0 || selectedDays.size === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      const pat = PATTERNS[pattern];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of pat) {
          for (const post of posts) {
            batch.push({
              eventId: expanded,
              role: `${post} — ${p.label}`,
              startTime: toISO(day, p.sH, p.sM, false),
              endTime: toISO(day, p.eH, p.eM, p.overnight),
            });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) {
        await Promise.all(batch.slice(i, i + 5).map(s => createShift(s)));
      }
      setShifts(await getEventShifts(expanded));
      setPosts([]); setSelectedDays(new Set()); setShowBuilder(false);
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  }

  /* ── Custom Shift ── */

  async function handleAddCustom() {
    if (!expanded || !cStart || !cEnd) return;
    setAddingCustom(true);
    try {
      await createShift({ eventId: expanded, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
      setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
      setShifts(await getEventShifts(expanded));
    } catch (err) { console.error(err); } finally { setAddingCustom(false); }
  }

  /* ── Builder helpers ── */

  function addPost() {
    if (!newPost.trim() || posts.includes(newPost.trim())) return;
    setPosts([...posts, newPost.trim()]); setNewPost("");
  }
  function toggleDay(d: string) {
    const n = new Set(selectedDays);
    if (n.has(d)) n.delete(d); else n.add(d);
    setSelectedDays(n);
  }

  /* ── Derived ── */

  const totalShifts = shifts.length;
  const filledShifts = shifts.filter((s: Shift) => s.assigned_user_id).length;
  const openShifts = totalShifts - filledShifts;
  const shiftsByDay = groupByDay(shifts);
  const previewCount = posts.length * (pattern === "8" ? 3 : 2) * selectedDays.size;
  const fillPct = totalShifts > 0 ? Math.round((filledShifts / totalShifts) * 100) : 0;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Flag className="h-5 w-5 sm:h-6 sm:w-6" /> OPERATIONS</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Plan and manage security operations</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Operation
          </Button>
        </div>

        {/* Create Form */}
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

        {/* Event List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Flag className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No operations planned</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Create your first operation to start building schedules.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev: Event) => {
              const isExp = expanded === ev.id;
              const opDays = getDaysInRange(ev.start_date, ev.end_date);

              return (
                <div key={ev.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  {/* Op Header */}
                  <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => toggleExpand(ev.id)}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
                      <MapPin className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{ev.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ev.location ?? "TBD"} · {fmtDateShort(ev.start_date)} — {fmtDateShort(ev.end_date)}
                      </p>
                    </div>
                    <select value={ev.status}
                      onChange={(e) => { e.stopPropagation(); handleStatusChange(ev.id, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 appearance-none rounded border border-border/40 bg-background px-2 pr-5 text-[10px] font-medium capitalize cursor-pointer">
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

                  {/* ── Expanded Shift Builder ── */}
                  {isExp && (
                    <div className="border-t border-border/30 bg-muted/20">
                      {/* Stats Bar */}
                      <div className="px-4 py-2 flex items-center gap-4 border-b border-border/20 bg-muted/30">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[10px] font-mono font-semibold">{totalShifts}</span>
                          <span className="text-[10px] text-muted-foreground">shifts</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] font-mono text-green-500">{filledShifts} filled</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] font-mono text-amber-500">{openShifts} open</span>
                          {totalShifts > 0 && (
                            <>
                              <div className="ml-2 h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${fillPct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">{fillPct}%</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{opDays.length} day{opDays.length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-4 py-2 flex gap-2 border-b border-border/20">
                        <Button size="sm" variant={showBuilder ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                          onClick={() => { setShowBuilder(!showBuilder); setShowCustom(false); }}>
                          <Zap className="h-3.5 w-3.5" /> Quick Fill
                        </Button>
                        <Button size="sm" variant={showCustom ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
                          onClick={() => { setShowCustom(!showCustom); setShowBuilder(false); }}>
                          <Plus className="h-3.5 w-3.5" /> Custom Shift
                        </Button>
                      </div>

                      {/* ── Quick Fill Panel ── */}
                      {showBuilder && (
                        <div className="px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
                          {/* Posts */}
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posts / Positions</label>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {posts.map(p => (
                                <Badge key={p} variant="secondary" className="gap-1 text-xs pr-1">
                                  {p}
                                  <button onClick={() => setPosts(posts.filter(x => x !== p))} className="hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
                                </Badge>
                              ))}
                              <div className="flex gap-1">
                                <Input value={newPost} onChange={(e) => setNewPost(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && addPost()}
                                  placeholder="e.g. Front Gate" className="h-6 w-32 text-xs" />
                                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={addPost} disabled={!newPost.trim()}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Pattern */}
                          <div>
                            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shift Pattern</label>
                            <div className="flex gap-2 mt-1">
                              {(["8", "12"] as const).map(p => (
                                <button key={p} onClick={() => setPattern(p)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    pattern === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                                  }`}>
                                  {p === "8" ? "8-Hour (Day / Swing / Night)" : "12-Hour (Day / Night)"}
                                </button>
                              ))}
                            </div>
                            <div className="flex gap-3 mt-1.5">
                              {PATTERNS[pattern].map(p => (
                                <span key={p.label} className="text-[10px] text-muted-foreground font-mono">
                                  {p.label}: {pad2(p.sH)}{pad2(p.sM)}–{pad2(p.eH)}{pad2(p.eM)}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Days */}
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coverage Days</label>
                              <button onClick={() => setSelectedDays(new Set(opDays))} className="text-[10px] text-primary hover:underline">Select All</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {opDays.map(day => {
                                const d = new Date(day + "T12:00:00");
                                const lbl = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
                                const sel = selectedDays.has(day);
                                return (
                                  <button key={day} onClick={() => toggleDay(day)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${
                                      sel ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"
                                    }`}>
                                    {sel && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{lbl}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Generate */}
                          <div className="flex items-center gap-3 pt-1">
                            <Button size="sm" className="gap-1.5" onClick={handleGenerate}
                              disabled={posts.length === 0 || selectedDays.size === 0 || generating}>
                              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                              Generate {previewCount} Shift{previewCount !== 1 ? "s" : ""}
                            </Button>
                            {previewCount > 0 && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {posts.length} post{posts.length > 1 ? "s" : ""} × {pattern === "8" ? "3" : "2"} periods × {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Custom Shift Form ── */}
                      {showCustom && (
                        <div className="px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
                          <Input placeholder="Role / Position (e.g. Supervisor)" value={cRole} onChange={(e) => setCRole(e.target.value)} className="h-8 text-sm" />
                          <div className="flex gap-2">
                            <div className="flex-1"><label className="text-[10px] text-muted-foreground">Start</label><Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} className="h-8 text-sm" /></div>
                            <div className="flex-1"><label className="text-[10px] text-muted-foreground">End</label><Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} className="h-8 text-sm" /></div>
                          </div>
                          <select value={cAssign} onChange={(e) => setCAssign(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                            <option value="">Unassigned</option>
                            {members.map((m: Member) => (
                              <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={handleAddCustom} disabled={!cStart || !cEnd || addingCustom}>
                              {addingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Shift"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCustom(false)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {/* ── Shift Grid by Day ── */}
                      <div className="px-4 py-3 space-y-4">
                        {shifts.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm font-medium text-muted-foreground/60">No shifts yet</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Use Quick Fill to batch-generate shifts, or add a custom shift.</p>
                          </div>
                        ) : (
                          Array.from(shiftsByDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayShifts]) => (
                            <div key={day}>
                              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                {fmtDateLong(day)}
                                <span className="text-muted-foreground/30 font-normal">
                                  · {dayShifts.length} shift{dayShifts.length > 1 ? "s" : ""}
                                  · {dayShifts.filter((s: Shift) => s.assigned_user_id).length} filled
                                </span>
                              </h4>
                              <div className="space-y-1">
                                {dayShifts.map((sh: Shift) => {
                                  const filled = !!sh.assigned_user_id;
                                  return (
                                    <div key={sh.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                                      filled ? "border-green-500/20 bg-green-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]"
                                    }`}>
                                      <Clock className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-green-500" : "text-amber-500"}`} />
                                      <div className="flex-1 min-w-0 text-xs">
                                        <span className="font-medium">{sh.role ?? "Shift"}</span>
                                        <span className="text-muted-foreground ml-2 font-mono">
                                          {fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                                        </span>
                                      </div>
                                      <select value={sh.assigned_user_id ?? ""} onChange={(e) => handleAssign(sh.id, e.target.value)}
                                        className={`h-6 max-w-[140px] truncate rounded border bg-background px-1.5 text-[10px] font-medium cursor-pointer ${
                                          filled ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"
                                        }`}>
                                        <option value="">⬚ Open</option>
                                        {members.map((m: Member) => (
                                          <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}</option>
                                        ))}
                                      </select>
                                      <button onClick={() => handleDeleteShift(sh.id)} disabled={deletingShift === sh.id}
                                        className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                                        {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
