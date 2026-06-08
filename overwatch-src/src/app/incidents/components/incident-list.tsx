"use client";

import { useState, useEffect } from "react";
import { timeAgo } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  Users,
  MessageSquare,
  Send,
  CircleDot,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
  Map,
  Pencil,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/loading-skeleton";
import { IncidentMediaUpload } from "./incident-media-upload";
import { toast } from "sonner";
import {
  updateIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  deleteIncident,
  loadStoryboard,
  getEventSiteMapUrl,
  assignIncidentToTeam,
  setIncidentStatus,
  getTeams,
  getIncidentStatuses,
} from "@/lib/supabase/db";
import type { Team } from "@/lib/supabase/db-teams";
import type { IncidentStatus } from "@/lib/supabase/db-incident-config";
import { useAuthStore } from "@/stores/auth-store";
import { generateIncidentPDF } from "./incident-pdf";
import type { StoryboardPin } from "@/components/storyboard-editor";
import { SiteMapViewModal } from "./site-map-view-modal";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import {
  TYPES,
  STATUS,
  sevInfo,
  statInfo,
  type Incident,
  type IncidentUpdate,
  type Member,
} from "./constants";

interface IncidentListProps {
  incidents: Incident[];
  members: Member[];
  loading: boolean;
  search: string;
  isAdmin: boolean;
  activeCompanyId: string;
  onReload: () => void;
}

export function IncidentList({ incidents, members, loading, search, isAdmin, activeCompanyId, onReload }: IncidentListProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, IncidentUpdate[]>>({});
  const [newComment, setNewComment] = useState("");
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // Teams + dynamic statuses
  const [teams, setTeams] = useState<Team[]>([]);
  const [statusDefs, setStatusDefs] = useState<IncidentStatus[]>([]);

  // Storyboard — incident detail (view on map)
  const [viewMapIncidentId, setViewMapIncidentId] = useState<string | null>(null);
  const [viewMapUrl, setViewMapUrl] = useState<string | null>(null);
  const [viewMapPins, setViewMapPins] = useState<StoryboardPin[]>([]);
  const [viewMapLoading, setViewMapLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    const loadConfig = async () => {
      try {
        const [t, s] = await Promise.all([
          getTeams(activeCompanyId),
          getIncidentStatuses(activeCompanyId),
        ]);
        setTeams(t);
        setStatusDefs(s);
      } catch {
        // Non-fatal: list still works with fallback constants.
      }
    };
    void loadConfig();
  }, [activeCompanyId]);

  const filtered = incidents.filter((i: Incident) =>
    !search || i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

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

  async function refreshUpdates(incidentId: string) {
    const u = await getIncidentUpdates(incidentId);
    setUpdates(prev => ({ ...prev, [incidentId]: u }));
  }

  async function handleStatusChange(incidentId: string, status: string) {
    await setIncidentStatus(incidentId, status);
    await addIncidentUpdate(incidentId, `Status changed to ${status}`, "status_change");
    await refreshUpdates(incidentId);
    await onReload();
  }

  async function handleAssign(incidentId: string, userId: string) {
    await updateIncident(incidentId, { assigned_to: userId || null });
    const member = members.find((m: Member) => m.users?.id === userId);
    const name = member?.users ? `${member.users.first_name ?? ""} ${member.users.last_name ?? ""}`.trim() : "";
    await addIncidentUpdate(
      incidentId,
      userId ? `Assigned to ${name || "user"}` : "Assignment cleared",
      "update"
    );
    await refreshUpdates(incidentId);
    await onReload();
  }

  async function handleAssignTeam(incidentId: string, teamId: string) {
    if (!teamId) {
      await updateIncident(incidentId, { team_id: null });
    } else {
      await assignIncidentToTeam(incidentId, teamId);
    }
    const teamName = teams.find((t) => t.id === teamId)?.name;
    await addIncidentUpdate(
      incidentId,
      teamId ? `Assigned to team ${teamName ?? "(unknown)"}` : "Team assignment cleared",
      "update"
    );
    await refreshUpdates(incidentId);
    await onReload();
  }

  async function handleExportPdf(inc: Incident) {
    if (!activeCompany) {
      toast.error("Company context required to export");
      return;
    }
    setExportingId(inc.id);
    try {
      // Ensure timeline is loaded (will be from cache if expanded)
      const incUpdates = updates[inc.id] ?? (await getIncidentUpdates(inc.id));
      if (!updates[inc.id]) {
        setUpdates((prev) => ({ ...prev, [inc.id]: incUpdates }));
      }
      const team = teams.find((t) => t.id === inc.team_id) ?? null;
      await generateIncidentPDF({
        incident: inc,
        updates: incUpdates,
        teamName: team?.name ?? null,
        companyName: activeCompany.companyName,
        brandHex: activeCompany.brandColor || "#1d3451",
        companyLogo: activeCompany.companyLogo,
      });
      toast.success("PDF exported");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Export failed: ${msg}`);
    } finally {
      setExportingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ description: "Delete this incident?", variant: "destructive", confirmLabel: "Delete" })) return;
    try {
      await deleteIncident(id);
      await onReload();
      toast.success("Incident deleted");
    } catch { toast.error("Failed to delete incident"); }
  }

  async function handleViewMap(inc: Incident) {
    setViewMapLoading(true);
    setViewMapIncidentId(inc.id);
    try {
      const [url, sb] = await Promise.all([
        getEventSiteMapUrl(inc.event_id),
        loadStoryboard(inc.event_id),
      ]);
      if (url && sb?.pins) {
        setViewMapUrl(url);
        const allPins = sb.pins as StoryboardPin[];
        const pin = allPins.find((p: StoryboardPin) => p.id === inc.storyboard_pin_id);
        setViewMapPins(pin ? [pin] : allPins);
      }
    } catch { toast.error("Failed to load map"); }
    finally { setViewMapLoading(false); }
  }

  if (loading) {
    return <ListSkeleton rows={4} />;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No incidents reported</p>
      </div>
    );
  }

  return (
    <>
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
                    {inc.incident_number && (
                      <span className="text-[10px] font-mono text-muted-foreground">#{inc.incident_number}</span>
                    )}
                    <span className="font-semibold text-sm truncate">{inc.title}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stat.color}`}>
                      {stat.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {inc.type.replace(/_/g, " ")}
                    </span>
                    {inc.team_id && (() => {
                      const team = teams.find((t) => t.id === inc.team_id);
                      return team ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: `${team.color}20`, color: team.color }}
                        >
                          <Users className="h-3 w-3" /> {team.name}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
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

              {isExpanded && editingIncidentId === inc.id ? (
                <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="incident-edit-title" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Title</label>
                      <Input id="incident-edit-title" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="text-sm" />
                    </div>
                    <div>
                      <label htmlFor="incident-edit-location" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Location / Post</label>
                      <Input id="incident-edit-location" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="text-sm" />
                    </div>
                    <div>
                      <label htmlFor="incident-edit-type" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Type</label>
                      <select id="incident-edit-type" value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label htmlFor="incident-edit-severity" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Severity</label>
                        <select id="incident-edit-severity" value={editForm.severity} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                          {["critical","high","medium","low"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label htmlFor="incident-edit-priority" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Priority</label>
                        <select id="incident-edit-priority" value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                          {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="incident-edit-narrative" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Narrative / Description</label>
                    <textarea id="incident-edit-narrative" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[120px] resize-y" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingIncidentId(null)}>Cancel</Button>
                    <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" onClick={async () => {
                      try {
                        await updateIncident(inc.id, {
                          title: editForm.title,
                          type: editForm.type,
                          severity: editForm.severity,
                          priority: editForm.priority,
                          location: editForm.location,
                          description: editForm.description,
                        });
                        await addIncidentUpdate(inc.id, 'Incident details updated', 'update');
                        setEditingIncidentId(null);
                        await onReload();
                        toast.success('Incident updated');
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : 'unknown error';
                        toast.error(`Update failed: ${msg}`);
                      }
                    }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Save Changes
                    </Button>
                  </div>
                </div>
              ) : isExpanded && (
                <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
                  {inc.description && (() => {
                    const raw: string = inc.description;
                    const sectionRegex = /---\s*(.+?)\s*---/g;
                    const headers: { heading: string; start: number; end: number }[] = [];
                    let m: RegExpExecArray | null;
                    while ((m = sectionRegex.exec(raw)) !== null) {
                      headers.push({ heading: m[1], start: m.index, end: m.index + m[0].length });
                    }
                    const tokens: { heading?: string; body: string }[] = [];
                    if (headers.length === 0) {
                      tokens.push({ body: raw });
                    } else {
                      const preamble = raw.slice(0, headers[0].start).trim();
                      if (preamble) tokens.push({ body: preamble });
                      for (let i = 0; i < headers.length; i++) {
                        const bodyEnd = i + 1 < headers.length ? headers[i + 1].start : raw.length;
                        tokens.push({ heading: headers[i].heading, body: raw.slice(headers[i].end, bodyEnd).trim() });
                      }
                    }

                    return (
                      <div className="space-y-3">
                        {tokens.map((t, i) => t.heading ? (
                          <div key={i} className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.heading}</p>
                            <p className="text-sm text-foreground/90 whitespace-pre-line">{t.body}</p>
                          </div>
                        ) : t.body ? (
                          <div key={i} className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Narrative</p>
                            <p className="text-sm text-foreground/90 whitespace-pre-line">{t.body}</p>
                          </div>
                        ) : null)}
                      </div>
                    );
                  })()}

                  {/* Custom fields */}
                  {inc.custom_fields && typeof inc.custom_fields === "object" && Object.keys(inc.custom_fields).length > 0 && (
                    <div className="rounded-lg border border-border/40 bg-background/50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Custom Fields</p>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                        {Object.entries(inc.custom_fields as Record<string, unknown>).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <dt className="font-medium text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</dt>
                            <dd className="text-foreground/90 break-words">
                              {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v ?? "")}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* View on Map button (if incident has storyboard pin) */}
                  {inc.storyboard_pin_id && inc.event_id && (
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        disabled={viewMapLoading && viewMapIncidentId === inc.id}
                        onClick={() => handleViewMap(inc)}
                      >
                        {viewMapLoading && viewMapIncidentId === inc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Map className="h-3 w-3" />}
                        View on Map
                      </Button>
                    </div>
                  )}

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex flex-wrap gap-3 items-center">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                        onClick={() => {
                          if (editingIncidentId === inc.id) {
                            setEditingIncidentId(null);
                          } else {
                            setEditingIncidentId(inc.id);
                            setEditForm({
                              title: inc.title || '',
                              type: inc.type || 'general',
                              severity: inc.severity || 'low',
                              priority: inc.priority || 'medium',
                              location: inc.location || '',
                              description: inc.description || '',
                            });
                          }
                        }}>
                        {editingIncidentId === inc.id ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                        {editingIncidentId === inc.id ? 'Cancel' : 'Edit'}
                      </Button>
                      <div>
                        <label htmlFor={`incident-status-${inc.id}`} className="text-xs text-muted-foreground">Status</label>
                        <select
                          id={`incident-status-${inc.id}`}
                          className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                          value={inc.status}
                          onChange={e => handleStatusChange(inc.id, e.target.value)}
                        >
                          {statusDefs.length > 0
                            ? statusDefs.map(s => <option key={s.id} value={s.key}>{s.label}</option>)
                            : STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`incident-assign-${inc.id}`} className="text-xs text-muted-foreground">Assign to</label>
                        <select
                          id={`incident-assign-${inc.id}`}
                          className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                          value={inc.assigned_to ?? ""}
                          onChange={e => handleAssign(inc.id, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {members.map((m: Member) => (
                            <option key={m.users?.id} value={m.users?.id}>
                              {m.users?.first_name} {m.users?.last_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {teams.length > 0 && (
                        <div>
                          <label htmlFor={`incident-team-${inc.id}`} className="text-xs text-muted-foreground">Team</label>
                          <select
                            id={`incident-team-${inc.id}`}
                            className="ml-2 rounded border border-input bg-background px-2 py-1 text-xs"
                            value={inc.team_id ?? ""}
                            onChange={e => handleAssignTeam(inc.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {teams.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {inc.assigned_to && inc.assigned_user && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> Assigned: {inc.assigned_user.first_name} {inc.assigned_user.last_name}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto gap-1.5 text-xs"
                        disabled={exportingId === inc.id}
                        onClick={() => handleExportPdf(inc)}
                      >
                        {exportingId === inc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                        Export PDF
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(inc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Evidence / Media */}
                  <IncidentMediaUpload incidentId={inc.id} companyId={activeCompanyId} readOnly={!isAdmin} />

                  {/* Timeline */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Activity Timeline
                    </h4>
                    <div className="space-y-2">
                      {(updates[inc.id] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No updates yet</p>
                      ) : (
                        (updates[inc.id] ?? []).map((u: IncidentUpdate) => {
                          const isSystem = u.type === "status_change" || u.type === "update";
                          const tone =
                            u.type === "status_change" ? "text-amber-600" :
                            u.type === "update" ? "text-blue-600" : "";
                          return (
                            <div key={u.id} className={`flex items-start gap-2 text-sm ${tone}`}>
                              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold mt-0.5 ${isSystem ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                                {isSystem
                                  ? "·"
                                  : `${u.users?.first_name?.[0] ?? ""}${u.users?.last_name?.[0] ?? ""}`}
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-xs">
                                  {isSystem ? "System" : `${u.users?.first_name ?? ""} ${u.users?.last_name ?? ""}`.trim()}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(u.created_at)}</span>
                                {isSystem ? (
                                  <p className="text-xs italic flex items-center gap-1 mt-0.5">
                                    {u.type === "status_change" && u.content.includes("resolved")
                                      ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      : <CircleDot className="h-3 w-3" />}
                                    {u.content}
                                  </p>
                                ) : (
                                  <p className="text-xs mt-0.5 text-foreground/80">{u.content}</p>
                                )}
                              </div>
                            </div>
                          );
                        })
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

      <ConfirmDialog />
      {/* View on Map Modal (read-only / admin-editable) */}
      {viewMapUrl && viewMapIncidentId && (
        <SiteMapViewModal
          mapUrl={viewMapUrl}
          pins={viewMapPins}
          isAdmin={isAdmin}
          activeCompanyId={activeCompanyId}
          incidents={incidents}
          viewMapIncidentId={viewMapIncidentId}
          onPinsChange={setViewMapPins}
          onClose={() => { setViewMapUrl(null); setViewMapIncidentId(null); setViewMapPins([]); }}
        />
      )}
    </>
  );
}
