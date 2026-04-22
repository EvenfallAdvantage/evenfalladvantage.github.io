"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardList, Loader2, ChevronDown, Trash2,
  AlertTriangle, MapPin, CheckCircle2,
  Pencil, Save, X, Download, Check,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getAllFormSubmissions, reviewFormSubmission, editFormSubmission, deleteFormSubmission,
  getIncidents, updateIncident, deleteIncident, addIncidentUpdate,
} from "@/lib/supabase/db";
import { exportCSV, INCIDENT_COLUMNS } from "@/lib/csv-export";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";

interface FormSub {
  id: string;
  user_id?: string;
  status: string;
  created_at: string;
  data: Record<string, unknown> | null;
  review_note?: string;
  change_log?: { timestamp: string; action: string; changes?: { field: string; from: string; to: string }[] }[];
  users?: { first_name?: string; last_name?: string; avatar_url?: string };
  forms?: { name?: string };
}

interface IncidentRow {
  [key: string]: unknown;
  id: string;
  title: string;
  type: string;
  severity: string;
  priority: string;
  status: string;
  location: string;
  description: string;
  created_at: string;
  reporter_id?: string;
  reported_user?: { first_name: string; last_name: string };
  updates?: unknown[];
}

interface ReportsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function ReportsTab({ activeCompanyId, canManage }: ReportsTabProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [formSubmissions, setFormSubmissions] = useState<FormSub[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingForm, setReviewingForm] = useState<string | null>(null);
  const [expandedFormSub, setExpandedFormSub] = useState<string | null>(null);
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [editingIncident, setEditingIncident] = useState<string | null>(null);
  const [editIncData, setEditIncData] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [editingFormSub, setEditingFormSub] = useState<string | null>(null);
  const [editFormSubData, setEditFormSubData] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [forms, incs] = await Promise.all([
        getAllFormSubmissions(activeCompanyId),
        getIncidents(activeCompanyId),
      ]);
      setFormSubmissions(forms);
      setIncidents(incs);
    } catch (e) { logger.swallow("reports:load", e, "warn"); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFormReview(id: string) {
    setReviewingForm(id);
    try {
      await reviewFormSubmission(id, reviewNote || "Reviewed");
      // Notify submitter their form was reviewed
      const sub = formSubmissions.find((f: FormSub) => f.id === id);
      const subUserId = sub?.user_id;
      if (subUserId && activeCompanyId) {
        import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
          dispatch({
            userId: subUserId,
            companyId: activeCompanyId!,
            title: "Form Submission Reviewed",
            body: `Your submission has been reviewed${reviewNote ? `: "${reviewNote}"` : "."}`,
            type: "form",
            actionUrl: "/forms",
          }).catch(() => {});
        }).catch(() => {});
      }
      setReviewNote("");
      await loadData();
    } catch (err) { console.error(err); }
    finally { setReviewingForm(null); }
  }

  return (
    <>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : formSubmissions.length === 0 && incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No submissions or reports</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">Submitted field reports, incident reports, and forms will appear here for review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Incident Reports ── */}
          {incidents.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Incident Reports ({incidents.length})
                </p>
                <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2" onClick={() => exportCSV(incidents, INCIDENT_COLUMNS, `incidents-${new Date().toISOString().slice(0,10)}`)}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <div className="space-y-2">
                {incidents.map((inc) => {
                  const reporter = inc.reported_user;
                  const statusColor = inc.status === "resolved" || inc.status === "closed"
                    ? "bg-green-500/15 text-green-600"
                    : inc.status === "investigating"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-amber-500/15 text-amber-600";
                  const sevColor = inc.severity === "critical" ? "text-red-500" : inc.severity === "high" ? "text-orange-500" : inc.severity === "medium" ? "text-amber-500" : "text-blue-400";
                  const isIncOpen = expandedIncident === inc.id;
                  return (
                    <div key={inc.id} className={`rounded-xl border bg-card overflow-hidden ${inc.status === "open" || inc.status === "investigating" ? "border-amber-500/30" : "border-border/50"}`}>
                      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedIncident(isIncOpen ? null : inc.id)}>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 shrink-0`}>
                          <AlertTriangle className={`h-4 w-4 ${sevColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm truncate">{inc.title}</p>
                            <Badge className={`text-[9px] capitalize ${statusColor}`}>{inc.status}</Badge>
                            <Badge variant="outline" className={`text-[9px] capitalize ${sevColor}`}>{inc.severity}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {inc.type} · {reporter ? `${reporter.first_name} ${reporter.last_name}` : "Unknown"} · {new Date(inc.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {inc.location && <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{inc.location}</p>}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isIncOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isIncOpen && (
                        <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/10">
                          {inc.description && (
                            <div>
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Narrative</label>
                              <p className="text-sm whitespace-pre-wrap">{inc.description}</p>
                            </div>
                          )}
                          {editingIncident === inc.id ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label htmlFor="report-incident-title" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Title</label>
                                  <Input id="report-incident-title" value={editIncData.title ?? ""} onChange={e => setEditIncData(p => ({ ...p, title: e.target.value }))} className="h-8 text-sm" />
                                </div>
                                <div>
                                  <label htmlFor="report-incident-location" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Location</label>
                                  <Input id="report-incident-location" value={editIncData.location ?? ""} onChange={e => setEditIncData(p => ({ ...p, location: e.target.value }))} className="h-8 text-sm" />
                                </div>
                                <div>
                                  <label htmlFor="report-incident-type" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Type</label>
                                  <select id="report-incident-type" value={editIncData.type ?? ""} onChange={e => setEditIncData(p => ({ ...p, type: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                                    {["general","medical","fire","theft","assault","trespass","disturbance","weather","other"].map(t => <option key={t} value={t}>{t}</option>)}
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex-1">
                                    <label htmlFor="report-incident-severity" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Severity</label>
                                    <select id="report-incident-severity" value={editIncData.severity ?? ""} onChange={e => setEditIncData(p => ({ ...p, severity: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                                      {["critical","high","medium","low"].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex-1">
                                    <label htmlFor="report-incident-priority" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Priority</label>
                                    <select id="report-incident-priority" value={editIncData.priority ?? ""} onChange={e => setEditIncData(p => ({ ...p, priority: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                                      {["low","medium","high","urgent"].map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label htmlFor="report-incident-status" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Status</label>
                                  <select id="report-incident-status" value={editIncData.status ?? ""} onChange={e => setEditIncData(p => ({ ...p, status: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm">
                                    {["open","investigating","resolved","closed"].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label htmlFor="report-incident-narrative" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">Narrative</label>
                                <textarea id="report-incident-narrative" value={editIncData.description ?? ""} onChange={e => setEditIncData(p => ({ ...p, description: e.target.value }))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px] resize-y" />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 gap-1 text-xs" onClick={async () => {
                                  try {
                                    // Build change summary
                                    const changed: string[] = [];
                                    for (const k of ["title","type","severity","priority","status","location","description"]) {
                                      if (String(editIncData[k] ?? "") !== String((inc as Record<string, unknown>)[k] ?? "")) changed.push(k);
                                    }
                                    await updateIncident(inc.id, editIncData);
                                    if (changed.length > 0) {
                                      await addIncidentUpdate(inc.id, `Edited via Personnel: ${changed.join(", ")} updated`, "update");
                                    }
                                    setEditingIncident(null);
                                    await loadData();
                                    toast.success("Incident updated");
                                  } catch { toast.error("Failed to update"); }
                                }}><Check className="h-3 w-3" /> Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingIncident(null)}>
                                  <X className="h-3 w-3" /> Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div><span className="text-muted-foreground/60">Type</span><p className="font-medium capitalize">{inc.type}</p></div>
                                <div><span className="text-muted-foreground/60">Severity</span><p className={`font-medium capitalize ${sevColor}`}>{inc.severity}</p></div>
                                <div><span className="text-muted-foreground/60">Priority</span><p className="font-medium capitalize">{inc.priority}</p></div>
                                <div><span className="text-muted-foreground/60">Status</span><p className="font-medium capitalize">{inc.status}</p></div>
                              </div>
                              {canManage && (
                                <div className="flex gap-2 pt-2 border-t border-border/20">
                                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => {
                                    setEditingIncident(inc.id);
                                    setEditIncData({ title: inc.title, type: inc.type, severity: inc.severity, priority: inc.priority, status: inc.status, location: inc.location, description: inc.description });
                                  }}><Pencil className="h-3 w-3" /> Edit</Button>
                                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={async () => {
                                    if (!await confirm({ description: "Delete this incident report?", variant: "destructive", confirmLabel: "Delete" })) return;
                                    try {
                                        await deleteIncident(inc.id);
                                      setIncidents((prev) => prev.filter((i) => i.id !== inc.id));
                                      toast.success("Incident deleted");
                                    } catch { toast.error("Failed to delete"); }
                                  }}><Trash2 className="h-3 w-3" /> Delete</Button>
                                  <Link href="/incidents" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto">View full report →</Link>
                                </div>
                              )}
                              {!canManage && (
                                <Link href="/incidents" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">View full report →</Link>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Field Reports ── */}
          {formSubmissions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-primary" /> Field Reports ({formSubmissions.length})
                </p>
                <Button variant="ghost" size="sm" className="gap-1 text-[10px] h-6 px-2" onClick={() => {
                  const rows = formSubmissions.map((f: FormSub) => {
                    const d = f.data as Record<string, unknown> ?? {};
                    return { submitter: `${f.users?.first_name ?? ""} ${f.users?.last_name ?? ""}`, form: f.forms?.name ?? "", status: f.status, date: new Date(f.created_at).toLocaleString(), ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, String(v ?? "")])) };
                  });
                  const cols = Object.keys(rows[0] ?? {});
                  const csv = [cols.join(","), ...rows.map(r => cols.map(c => `"${String((r as Record<string,string>)[c] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = `field-reports-${new Date().toISOString().slice(0,10)}.csv`; a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              </div>
              <div className="space-y-2">
                {formSubmissions.map((f: FormSub) => {
                  const u = f.users;
                  const isReviewed = f.status === "reviewed";
                  const allFields = f.data ? Object.entries(f.data as Record<string, unknown>) : [];
                  const isOpen = expandedFormSub === f.id;

                  return (
                    <div key={f.id} className={`rounded-xl border bg-card overflow-hidden ${
                      !isReviewed ? "border-amber-500/30" : "border-border/50"
                    }`}>
                      <button
                        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedFormSub(isOpen ? null : f.id)}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                          {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                            {isReviewed ? (
                              <Badge className="text-[10px] bg-green-500/15 text-green-600">Reviewed</Badge>
                            ) : (
                              <Badge className="text-[10px] bg-amber-500/15 text-amber-600">Pending</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {f.forms?.name ?? "Form"} · {new Date(f.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/10">
                          {editingFormSub === f.id ? (
                            <>
                              {allFields.map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
                                    {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                  </label>
                                  <textarea
                                    value={String(editFormSubData[key] ?? val ?? "")}
                                    onChange={(e) => setEditFormSubData(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" className="h-7 gap-1 text-xs" onClick={async () => {
                                  try {
                                    const updated = await editFormSubmission(f.id, editFormSubData);
                                    setFormSubmissions(prev => prev.map(sub => sub.id === f.id ? { ...sub, data: editFormSubData, change_log: updated?.change_log } : sub));
                                    setEditingFormSub(null);
                                    toast.success("Submission updated");
                                  } catch { toast.error("Failed to update"); }
                                }}><Save className="h-3 w-3" /> Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingFormSub(null)}>
                                  <X className="h-3 w-3" /> Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              {allFields.map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
                                    {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                  </label>
                                  <p className="text-sm whitespace-pre-wrap">{String(val ?? "—")}</p>
                                </div>
                              ))}
                            </>
                          )}
                          {!isReviewed && canManage && (
                            <div className="flex items-center gap-2 pt-2 border-t border-border/20">
                              <Input placeholder="Review note..." value={reviewingForm === f.id ? reviewNote : ""}
                                onChange={(e) => { setReviewingForm(f.id); setReviewNote(e.target.value); }}
                                className="h-7 flex-1 text-xs" />
                              <Button size="sm" variant="outline"
                                className="h-7 gap-1 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => { setReviewingForm(f.id); handleFormReview(f.id); }}>
                                <CheckCircle2 className="h-3 w-3" /> Mark Reviewed
                              </Button>
                            </div>
                          )}
                          {f.review_note && (
                            <p className="text-[10px] text-muted-foreground italic">Review note: {f.review_note}</p>
                          )}
                          {canManage && editingFormSub !== f.id && (
                            <div className="flex gap-2 pt-2 border-t border-border/20">
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => {
                                setExpandedFormSub(f.id);
                                setEditingFormSub(f.id);
                                setEditFormSubData(allFields.reduce((acc, [k, v]) => ({ ...acc, [k]: String(v ?? "") }), {} as Record<string, string>));
                              }}>
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={async () => {
                                if (!await confirm({ description: "Delete this submission?", variant: "destructive", confirmLabel: "Delete" })) return;
                                try {
                                  await deleteFormSubmission(f.id);
                                  setFormSubmissions(prev => prev.filter(sub => sub.id !== f.id));
                                  toast.success("Submission deleted");
                                } catch { toast.error("Failed to delete"); }
                              }}>
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            </div>
                          )}
                          {f.change_log && Array.isArray(f.change_log) && f.change_log.length > 0 && (
                            <div className="border-t border-border/20 pt-2 mt-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Change History</p>
                              {(f.change_log as { timestamp: string; action: string; changes?: { field: string; from: string; to: string }[] }[]).map((log, i) => (
                                <div key={i} className="text-[10px] text-muted-foreground mb-1">
                                  <span className="text-muted-foreground/60">{new Date(log.timestamp).toLocaleString()}</span>
                                  {" — "}{log.action}
                                  {log.changes?.map((c, j) => (
                                    <span key={j} className="ml-1">
                                      <span className="font-medium">{c.field}</span>: &quot;{c.from.slice(0, 30)}&quot; → &quot;{c.to.slice(0, 30)}&quot;
                                    </span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog />
    </>
  );
}
