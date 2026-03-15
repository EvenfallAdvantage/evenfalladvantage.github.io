"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  MessageSquare,
  Send,
  Shield,
  Flame,
  CircleDot,
  CheckCircle2,
  Loader2,
  Trash2,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import {
  getIncidents,
  createIncident,
  updateIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  deleteIncident,
  getCompanyMembers,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Incident = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IncidentUpdate = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

const SEVERITY = [
  { value: "critical", label: "Critical", color: "bg-red-600 text-white", icon: Flame },
  { value: "high", label: "High", color: "bg-orange-500 text-white", icon: AlertTriangle },
  { value: "medium", label: "Medium", color: "bg-amber-500 text-white", icon: Shield },
  { value: "low", label: "Low", color: "bg-blue-500 text-white", icon: CircleDot },
];

const STATUS = [
  { value: "open", label: "Open", color: "bg-red-500/15 text-red-600" },
  { value: "investigating", label: "Investigating", color: "bg-amber-500/15 text-amber-600" },
  { value: "resolved", label: "Resolved", color: "bg-green-500/15 text-green-600" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
];

const TYPES = [
  "general", "trespass", "theft", "vandalism", "assault",
  "suspicious_activity", "medical", "fire", "alarm",
  "access_control", "policy_violation", "other",
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function IncidentsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore(s => s.getActiveCompany());
  const isAdmin = activeCompany && ["owner", "admin", "manager"].includes(activeCompany.role);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, IncidentUpdate[]>>({});
  const [newComment, setNewComment] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("general");
  const [newSeverity, setNewSeverity] = useState("low");
  const [newPriority, setNewPriority] = useState("medium");
  const [newLocation, setNewLocation] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const [inc, mem] = await Promise.all([
        getIncidents(activeCompanyId, filter),
        getCompanyMembers(activeCompanyId),
      ]);
      setIncidents(inc);
      setMembers(mem);
    } catch { /* */ } finally { setLoading(false); }
  }, [activeCompanyId, filter]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newTitle.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createIncident(activeCompanyId, {
        title: newTitle, description: newDesc, type: newType,
        severity: newSeverity, priority: newPriority, location: newLocation,
      });
      setNewTitle(""); setNewDesc(""); setNewType("general");
      setNewSeverity("low"); setNewPriority("medium"); setNewLocation("");
      setShowCreate(false);
      await load();
    } catch { /* */ } finally { setCreating(false); }
  }

  async function handleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!updates[id]) {
      const u = await getIncidentUpdates(id);
      setUpdates(prev => ({ ...prev, [id]: u }));
    }
  }

  async function handleAddComment(incidentId: string) {
    if (!newComment.trim()) return;
    const u = await addIncidentUpdate(incidentId, newComment);
    setUpdates(prev => ({ ...prev, [incidentId]: [...(prev[incidentId] ?? []), u] }));
    setNewComment("");
  }

  async function handleStatusChange(incidentId: string, status: string) {
    await updateIncident(incidentId, { status });
    if (status === "resolved") {
      await addIncidentUpdate(incidentId, `Status changed to ${status}`, "status_change");
    }
    await load();
  }

  async function handleAssign(incidentId: string, userId: string) {
    await updateIncident(incidentId, { assigned_to: userId || null });
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this incident?")) return;
    await deleteIncident(id);
    await load();
  }

  const filtered = incidents.filter((i: Incident) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

  const sevInfo = (sev: string) => SEVERITY.find(s => s.value === sev) ?? SEVERITY[3];
  const statInfo = (st: string) => STATUS.find(s => s.value === st) ?? STATUS[0];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Reports
            </h1>
            <p className="text-sm text-muted-foreground">Incident reports, field reports, and documentation</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
            <Plus className="h-4 w-4" /> Report Incident
          </Button>
        </div>

        {/* Report type tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incidents
          </div>
          <Link
            href="/forms"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Field Reports
          </Link>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="border-amber-500/30">
            <CardHeader><CardTitle className="text-base">New Incident Report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Incident title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                placeholder="Description — what happened?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Severity</label>
                  <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newSeverity} onChange={e => setNewSeverity(e.target.value)}>
                    {SEVERITY.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Priority</label>
                  <select className="w-full mt-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Location</label>
                  <Input className="mt-1" placeholder="Where?" value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} disabled={creating || !newTitle.trim()} className="gap-2">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                  Submit Report
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-1">
            {[{ value: "all", label: "All", color: "" }, ...STATUS].map(s => (
              <Button
                key={s.value}
                variant={filter === s.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(s.value)}
                className="text-xs"
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Open", count: incidents.filter((i: Incident) => i.status === "open").length, color: "text-red-500" },
            { label: "Investigating", count: incidents.filter((i: Incident) => i.status === "investigating").length, color: "text-amber-500" },
            { label: "Resolved", count: incidents.filter((i: Incident) => i.status === "resolved").length, color: "text-green-500" },
            { label: "Critical", count: incidents.filter((i: Incident) => i.severity === "critical").length, color: "text-red-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3 text-center">
                <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Incident List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No incidents reported</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inc: Incident) => {
              const sev = sevInfo(inc.severity);
              const stat = statInfo(inc.status);
              const isExpanded = expanded === inc.id;
              const SevIcon = sev.icon;
              return (
                <Card key={inc.id} className={`overflow-hidden ${inc.severity === "critical" ? "border-red-500/40" : ""}`}>
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => handleExpand(inc.id)}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sev.color}`}>
                      <SevIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{inc.title}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stat.color}`}>
                          {stat.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                          {inc.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {inc.reported_user?.first_name} {inc.reported_user?.last_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(inc.created_at)}
                        </span>
                        {inc.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {inc.location}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                      {inc.description && (
                        <p className="text-sm text-foreground/80">{inc.description}</p>
                      )}

                      {/* Actions */}
                      {isAdmin && (
                        <div className="flex flex-wrap gap-3 items-center">
                          <div>
                            <label className="text-xs text-muted-foreground">Status</label>
                            <select
                              className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={inc.status}
                              onChange={e => handleStatusChange(inc.id, e.target.value)}
                            >
                              {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Assign to</label>
                            <select
                              className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                              value={inc.assigned_to ?? ""}
                              onChange={e => handleAssign(inc.id, e.target.value)}
                            >
                              <option value="">Unassigned</option>
                              {members.map((m: Member) => (
                                <option key={m.user_id} value={m.user_id}>
                                  {m.users?.first_name} {m.users?.last_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {inc.assigned_to && inc.assigned_user && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Assigned: {inc.assigned_user.first_name} {inc.assigned_user.last_name}
                            </span>
                          )}
                          <Button variant="ghost" size="sm" className="text-red-500 ml-auto" onClick={() => handleDelete(inc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Timeline */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Activity Timeline
                        </h4>
                        <div className="space-y-2">
                          {(updates[inc.id] ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No updates yet</p>
                          ) : (
                            (updates[inc.id] ?? []).map((u: IncidentUpdate) => (
                              <div key={u.id} className={`flex items-start gap-2 text-sm ${u.type === "status_change" ? "text-amber-600" : ""}`}>
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary mt-0.5">
                                  {u.users?.first_name?.[0]}{u.users?.last_name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium text-xs">{u.users?.first_name} {u.users?.last_name}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(u.created_at)}</span>
                                  {u.type === "status_change" ? (
                                    <p className="text-xs italic flex items-center gap-1 mt-0.5">
                                      {u.content.includes("resolved") ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <CircleDot className="h-3 w-3" />}
                                      {u.content}
                                    </p>
                                  ) : (
                                    <p className="text-xs mt-0.5 text-foreground/80">{u.content}</p>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Input
                            placeholder="Add update..."
                            className="text-sm"
                            value={expanded === inc.id ? newComment : ""}
                            onChange={e => setNewComment(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddComment(inc.id)}
                          />
                          <Button size="sm" onClick={() => handleAddComment(inc.id)} disabled={!newComment.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
