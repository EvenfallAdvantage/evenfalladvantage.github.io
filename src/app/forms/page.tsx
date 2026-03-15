"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Plus, Loader2, Send, ChevronLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getForms, createForm, submitForm, getFormSubmissions } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Form = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Submission = any;

export default function FormsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reportText, setReportText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setForms(await getForms(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createForm({ companyId: activeCompanyId, name: newName.trim() });
      setNewName(""); setShowCreate(false); await load();
    } catch (err) { console.error("Create form failed:", err); }
    finally { setCreating(false); }
  }

  async function selectForm(form: Form) {
    setSelected(form);
    setSubmitted(false);
    try { setSubmissions(await getFormSubmissions(form.id)); } catch { setSubmissions([]); }
  }

  async function handleSubmit() {
    if (!reportText.trim() || !selected) return;
    setSubmitting(true);
    try {
      await submitForm({ formId: selected.id, data: { report: reportText.trim(), submittedAt: new Date().toISOString() } });
      setReportText("");
      setSubmitted(true);
      setSubmissions(await getFormSubmissions(selected.id));
      setTimeout(() => setSubmitted(false), 3000);
    } catch (err) { console.error("Submit failed:", err); }
    finally { setSubmitting(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {selected ? (
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-xs text-primary hover:underline mb-1">
                <ChevronLeft className="h-3 w-3" /> All Forms
              </button>
            ) : null}
            <h1 className="text-2xl font-bold tracking-tight font-mono">
              {selected ? selected.name : "FIELD REPORTS"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selected ? "Fill out and submit this report" : "Submit and track incident reports and forms"}
            </p>
          </div>
          {!selected && isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Form
            </Button>
          )}
        </div>

        {showCreate && !selected && (
          <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Form name..." value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        )}

        {selected ? (
          <div className="space-y-4">
            {/* Submission form */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Report Details</label>
              <textarea
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="Describe the incident, observation, or report details..."
                className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20 min-h-[120px]"
                rows={5}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleSubmit} disabled={!reportText.trim() || submitting}>
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Send className="h-3.5 w-3.5" />}
                  {submitted ? "Submitted!" : "Submit Report"}
                </Button>
              </div>
            </div>

            {/* Previous submissions */}
            {submissions.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Previous Submissions</h3>
                <div className="space-y-2">
                  {submissions.map((s: Submission) => (
                    <div key={s.id} className="rounded-lg border border-border/40 bg-card px-4 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {s.users?.first_name} {s.users?.last_name} · {new Date(s.created_at).toLocaleDateString()}
                        </span>
                        <Badge variant="secondary" className="text-[10px] capitalize">{s.status}</Badge>
                      </div>
                      <p className="text-sm">{s.data?.report ?? JSON.stringify(s.data)}</p>
                    </div>
                  ))}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
