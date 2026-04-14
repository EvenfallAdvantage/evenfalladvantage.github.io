"use client";

import { useState } from "react";
import { timeAgo } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  MessageSquare,
  Send,
  CircleDot,
  CheckCircle2,
  Loader2,
  Trash2,
  X,
  Map,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/loading-skeleton";
import { toast } from "sonner";
import {
  updateIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  deleteIncident,
  loadStoryboard,
  getEventSiteMapUrl,
} from "@/lib/supabase/db";
import type { StoryboardPin } from "@/components/storyboard-editor";
import { SiteMapViewModal } from "./site-map-view-modal";
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Record<string, IncidentUpdate[]>>({});
  const [newComment, setNewComment] = useState("");
  const [editingIncidentId, setEditingIncidentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  // Storyboard — incident detail (view on map)
  const [viewMapIncidentId, setViewMapIncidentId] = useState<string | null>(null);
  const [viewMapUrl, setViewMapUrl] = useState<string | null>(null);
  const [viewMapPins, setViewMapPins] = useState<StoryboardPin[]>([]);
  const [viewMapLoading, setViewMapLoading] = useState(false);

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

  async function handleStatusChange(incidentId: string, status: string) {
    await updateIncident(incidentId, { status });
    if (status === "resolved") {
      await addIncidentUpdate(incidentId, `Status changed to ${status}`, "status_change");
    }
    await onReload();
  }

  async function handleAssign(incidentId: string, userId: string) {
    await updateIncident(incidentId, { assigned_to: userId || null });
    await onReload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this incident?")) return;
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
                    <span className="font-semibold text-sm truncate">{inc.title}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${stat.color}`}>
                      {stat.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {inc.type.replace(/_/g, " ")}
                    </span>
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
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Title</label>
                      <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Location / Post</label>
                      <Input value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} className="text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Type</label>
                      <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Severity</label>
                        <select value={editForm.severity} onChange={e => setEditForm(f => ({ ...f, severity: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                          {["critical","high","medium","low"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Priority</label>
                        <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                          {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Narrative / Description</label>
                    <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
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
                            <option key={m.users?.id} value={m.users?.id}>
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
