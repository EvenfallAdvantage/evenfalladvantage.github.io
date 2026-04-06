"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { ClipboardList, Plus, Loader2, Send, ChevronLeft, ChevronDown, CheckCircle2, Trash2, PencilLine, Save, X, AlertTriangle, Flag, Pencil, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getForms, createForm, submitForm, getFormSubmissions, deleteForm, updateForm, getActiveTimesheet, getUserFormSubmissions } from "@/lib/supabase/db";
import { toast } from "sonner";
import { usePageHeader } from "@/stores/page-header-store";

type FormField = { id: string; label: string; type: "text" | "textarea" | "select" | "checkbox"; required: boolean; options?: string[] };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Form = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Submission = any;

export default function FormsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(
      "REPORTS",
      "Incident reports, field reports, and documentation",
      <AlertTriangle className="h-5 w-5" />,
      isAdmin ? (
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> New Form
        </Button>
      ) : undefined
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, showCreate, isAdmin]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reportText, setReportText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);
  const [deletingForm, setDeletingForm] = useState<string | null>(null);
  // Field builder
  const [editingFields, setEditingFields] = useState(false);
  const [fields, setFields] = useState<FormField[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  // Dynamic form values
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeTimesheet, setActiveTimesheet] = useState<any>(null);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [editingSubmission, setEditingSubmission] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [f, ts] = await Promise.all([getForms(activeCompanyId), getActiveTimesheet()]);
      setForms(f);
      setActiveTimesheet(ts);
      // Load user's own submissions across all forms
      try { setMySubmissions(await getUserFormSubmissions()); } catch {}
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createForm({ companyId: activeCompanyId, name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName(""); setNewDesc(""); setShowCreate(false); await load();
    } catch (err) { console.error("Create form failed:", err); }
    finally { setCreating(false); }
  }

  async function handleDeleteForm(formId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this form and all its submissions?")) return;
    setDeletingForm(formId);
    try { await deleteForm(formId); await load(); }
    catch (err) { console.error(err); }
    finally { setDeletingForm(null); }
  }

  async function selectForm(form: Form) {
    setSelected(form);
    setSubmitted(false);
    setEditingFields(false);
    setFormValues({});
    setReportText("");
    try { setSubmissions(await getFormSubmissions(form.id)); } catch { setSubmissions([]); }
  }

  function startEditingFields() {
    if (!selected) return;
    setFields((selected.fields ?? []).map((f: FormField, i: number) => ({ ...f, id: f.id || `f${i}` })));
    setEditingFields(true);
  }

  function addField(type: FormField["type"]) {
    setFields((prev) => [...prev, { id: crypto.randomUUID(), label: "", type, required: false, ...(type === "select" ? { options: ["Option 1", "Option 2"] } : {}) }]);
  }

  async function saveFields() {
    if (!selected) return;
    setSavingFields(true);
    try {
      const updated = await updateForm(selected.id, { fields });
      setSelected(updated);
      setEditingFields(false);
      await load();
    } catch (err) { console.error(err); }
    finally { setSavingFields(false); }
  }

  async function handleSubmit() {
    if (!selected) return;
    const hasFields = (selected.fields ?? []).length > 0;
    if (hasFields) {
      // Check required fields
      for (const f of selected.fields as FormField[]) {
        if (f.required && !formValues[f.id]) { alert(`"${f.label}" is required`); return; }
      }
    } else if (!reportText.trim()) return;

    setSubmitting(true);
    try {
      const data = hasFields
        ? { ...formValues, submittedAt: new Date().toISOString() }
        : { report: reportText.trim(), submittedAt: new Date().toISOString() };
      await submitForm({
        formId: selected.id,
        data,
        shiftId: activeTimesheet?.shift_id ?? undefined,
        eventId: activeTimesheet?.event_id ?? undefined,
        timesheetId: activeTimesheet?.id ?? undefined,
      });
      setReportText("");
      setFormValues({});
      setSubmitted(true);
      setSubmissions(await getFormSubmissions(selected.id));
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) { console.error("Submit failed:", err); }
    finally { setSubmitting(false); }
  }

  return (
    <>
      <div className="space-y-4">
        {selected && (
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-primary hover:underline mb-1">
                <ChevronLeft className="h-3 w-3" /> All Forms
              </button>
              <h2 className="text-lg font-bold tracking-tight font-mono flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {selected.name}
              </h2>
              <p className="text-sm text-muted-foreground">Fill out and submit this report</p>
            </div>
          </div>
        )}
        {/* New Form button moved to topbar header actions */}

        {/* Report type tabs */}
        {!selected && (
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
            <Link
              href="/incidents"
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
            >
              Incidents
            </Link>
            <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
              Field Reports
            </div>
          </div>
        )}

        {showCreate && !selected && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Form name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {selected ? (
          <div className="space-y-4">
            {/* Admin: Edit fields */}
            {isAdmin && !editingFields && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditingFields}>
                <PencilLine className="h-3.5 w-3.5" /> Edit Fields ({(selected.fields ?? []).length})
              </Button>
            )}

            {editingFields && (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Form Fields</p>
                  <div className="flex gap-1">
                    {(["text", "textarea", "select", "checkbox"] as const).map((t) => (
                      <Button key={t} size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => addField(t)}>
                        + {t}
                      </Button>
                    ))}
                  </div>
                </div>
                {fields.map((f, fi) => (
                  <div key={f.id} className="flex items-start gap-2 rounded-lg border border-border/50 bg-card p-2">
                    <span className="text-[10px] font-mono text-muted-foreground mt-2">{fi + 1}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex gap-2">
                        <Input value={f.label} onChange={(e) => setFields((prev) => prev.map((x) => x.id === f.id ? { ...x, label: e.target.value } : x))} placeholder="Field label" className="h-7 text-xs flex-1" />
                        <Badge variant="secondary" className="text-[9px] shrink-0">{f.type}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <input type="checkbox" checked={f.required} onChange={(e) => setFields((prev) => prev.map((x) => x.id === f.id ? { ...x, required: e.target.checked } : x))} />
                          Required
                        </label>
                      </div>
                      {f.type === "select" && (
                        <Input value={(f.options ?? []).join(", ")} onChange={(e) => setFields((prev) => prev.map((x) => x.id === f.id ? { ...x, options: e.target.value.split(",").map((s) => s.trim()) } : x))} placeholder="Options (comma-separated)" className="h-6 text-[10px]" />
                      )}
                    </div>
                    <button onClick={() => setFields((prev) => prev.filter((x) => x.id !== f.id))} className="text-muted-foreground/50 hover:text-red-500 mt-1"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {fields.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No fields. Users will see a free-text report box.</p>}
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1.5" onClick={saveFields} disabled={savingFields}>
                    {savingFields ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Fields
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingFields(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Operation context badge */}
            {activeTimesheet?.events?.name && (
              <div className="flex items-center gap-2 text-xs bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                <Flag className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-muted-foreground">Filing for:</span>
                <span className="font-semibold text-green-600">{activeTimesheet.events.name}</span>
              </div>
            )}

            {/* Submission form */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Details</label>
              {(selected.fields ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(selected.fields as FormField[]).map((f) => (
                    <div key={f.id} className="space-y-1">
                      <label className="text-xs font-medium">{f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                      {f.type === "text" && (
                        <Input value={(formValues[f.id] as string) ?? ""} onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))} placeholder={f.label} className="h-8 text-sm" />
                      )}
                      {f.type === "textarea" && (
                        <textarea value={(formValues[f.id] as string) ?? ""} onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))} placeholder={f.label}
                          className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none min-h-[80px] focus:border-primary/50 focus:ring-1 focus:ring-primary/20" rows={3} />
                      )}
                      {f.type === "select" && (
                        <select value={(formValues[f.id] as string) ?? ""} onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          className="w-full rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none h-8">
                          <option value="">Select...</option>
                          {(f.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      )}
                      {f.type === "checkbox" && (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={!!formValues[f.id]} onChange={(e) => setFormValues((prev) => ({ ...prev, [f.id]: e.target.checked }))} />
                          {f.label}
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="Describe the incident, observation, or report details..."
                  className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20 min-h-[120px]"
                  rows={5}
                />
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Send className="h-3.5 w-3.5" />}
                  {submitted ? "Submitted!" : "Submit Report"}
                </Button>
              </div>
            </div>

            {/* Previous submissions */}
            {submissions.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Submissions ({submissions.length})
                </h3>
                <div className="space-y-2">
                  {submissions.map((s: Submission) => {
                    const isExpanded = expandedSubmission === s.id;
                    const fields = s.data as Record<string, unknown> | null;
                    return (
                      <div key={s.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                          onClick={() => setExpandedSubmission(isExpanded ? null : s.id)}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {(s.users?.first_name?.[0] ?? "")}{(s.users?.last_name?.[0] ?? "")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{s.users?.first_name} {s.users?.last_name}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(s.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        {isExpanded && fields && (
                          <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/10">
                            {Object.entries(fields).map(([key, value]) => (
                              <div key={key}>
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
                                  {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                </label>
                                <p className="text-sm whitespace-pre-wrap">{String(value ?? "—")}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No field reports configured</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Create your first form to start collecting incident reports." : "Your organization hasn't set up any forms yet."}
            </p>
          </div>
        ) : (
          <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forms.map((form: Form) => (
              <div key={form.id} onClick={() => selectForm(form)}
                className="rounded-xl border border-border/50 bg-card p-4 cursor-pointer transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                    <ClipboardList className="h-5 w-5 text-rose-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{form.name}</p>
                    {form.description && <p className="text-xs text-muted-foreground truncate">{form.description}</p>}
                  </div>
                  {isAdmin && (
                    <button onClick={(e) => handleDeleteForm(form.id, e)} disabled={deletingForm === form.id}
                      className="rounded-md p-1 text-muted-foreground/40 hover:bg-red-500/10 hover:text-red-500 z-10" title="Delete form">
                      {deletingForm === form.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* My Submissions */}
          {mySubmissions.length > 0 && !selected && (
            <div className="mt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                My Submissions ({mySubmissions.length})
              </h3>
              <div className="space-y-2">
                {mySubmissions.map((s: Submission) => {
                  const isExpanded = expandedSubmission === s.id;
                  const fields = s.data as Record<string, unknown> | null;
                  const isEditing = editingSubmission === s.id;
                  return (
                    <div key={s.id} className="rounded-lg border border-border/40 bg-card overflow-hidden">
                      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedSubmission(isExpanded ? null : s.id)}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          <ClipboardList className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{s.forms?.name ?? "Report"}</span>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(s.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>
                      {isExpanded && fields && (
                        <div className="border-t border-border/30 px-4 py-3 space-y-3 bg-muted/10">
                          {isEditing ? (
                            <>
                              {Object.entries(fields).map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
                                    {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                  </label>
                                  <textarea
                                    value={String(editFormData[key] ?? val ?? "")}
                                    onChange={(e) => setEditFormData(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                                  />
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1">
                                <Button size="sm" className="h-7 gap-1 text-xs" onClick={async () => {
                                  try {
                                    const supabase = (await import("@/lib/supabase/client")).createClient();
                                    await supabase.from("form_submissions").update({ data: editFormData }).eq("id", s.id);
                                    const updated = mySubmissions.map(sub => sub.id === s.id ? { ...sub, data: editFormData } : sub);
                                    setMySubmissions(updated);
                                    setEditingSubmission(null);
                                    toast.success("Report updated");
                                  } catch { toast.error("Failed to update"); }
                                }}><Check className="h-3 w-3" /> Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditingSubmission(null)}>
                                  <X className="h-3 w-3" /> Cancel
                                </Button>
                              </div>
                            </>
                          ) : (
                            <>
                              {Object.entries(fields).map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 block mb-0.5">
                                    {key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                  </label>
                                  <p className="text-sm whitespace-pre-wrap">{String(val ?? "\u2014")}</p>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => {
                                setEditingSubmission(s.id);
                                setEditFormData(fields as Record<string, string>);
                              }}>
                                <Pencil className="h-3 w-3" /> Edit Report
                              </Button>
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
          </>
        )}
      </div>
    </>
  );
}
