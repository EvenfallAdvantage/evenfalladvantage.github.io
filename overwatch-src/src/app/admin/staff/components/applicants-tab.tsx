"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Trash2, UserPlus, Plus, ArrowRight, X, XCircle,
  Upload, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getApplicants, createApplicant, updateApplicantStatus, deleteApplicant, convertApplicantToUser,
} from "@/lib/supabase/db";
import { onApplicantHired, type HireResult } from "@/lib/services/hiring-orchestrator";
import { FileText } from "lucide-react";
import { ApplicantDetailModal } from "./applicant-detail-modal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Applicant = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

interface ApplicantsTabProps {
  activeCompanyId: string;
  canManage: boolean;
  companyName: string;
  joinCode: string;
  members: Member[];
  onHireResult: (result: HireResult | null) => void;
}

const STATUSES = ["applied", "reviewing", "interviewing", "offered", "hired", "rejected", "withdrawn"];
const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-500/15 text-blue-500", reviewing: "bg-amber-500/15 text-amber-600",
  interviewing: "bg-violet-500/15 text-violet-500", offered: "bg-cyan-500/15 text-cyan-500",
  hired: "bg-green-500/15 text-green-600", rejected: "bg-red-500/15 text-red-500",
  withdrawn: "bg-zinc-500/15 text-zinc-400",
};
const DOCUMENT_TYPES = ["Guard Card", "CPR/First Aid", "EMT", "OSHA", "Firearms", "Security License", "Military", "LEO", "Other"] as const;

export function ApplicantsTab({ activeCompanyId, canManage, companyName, joinCode, members: _members, onHireResult }: ApplicantsTabProps) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [appFilter, setAppFilter] = useState("all");
  const [showAddApp, setShowAddApp] = useState(false);
  const [appForm, setAppForm] = useState({
    firstName: "", lastName: "", email: "", phone: "", address: "",
    guardCardNumber: "", guardCardExpiry: "",
    availability: "", experience: "", notes: "",
    education: [] as { institution: string; degree: string; startYear: string; endYear: string }[],
    workHistory: [] as { employer: string; title: string; startDate: string; endDate: string; description: string }[],
    pendingFiles: [] as { name: string; type: string; file: File }[],
  });
  const [savingApp, setSavingApp] = useState(false);
  const [viewingApplicant, setViewingApplicant] = useState<Applicant | null>(null);
  const appFileInputRef = useRef<HTMLInputElement>(null);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      setApplicants(await getApplicants(activeCompanyId));
    } catch {}
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleAddApplicant() {
    if (!appForm.firstName.trim() || !appForm.email.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setSavingApp(true);
    try {
      // Upload files first if any
      const uploadedDocs: { name: string; type: string; fileUrl: string }[] = [];
      if (appForm.pendingFiles.length > 0) {
        const supabase = createClient();
        const applicantId = crypto.randomUUID();
        for (const pf of appForm.pendingFiles) {
          const ext = pf.file.name.split(".").pop() || "bin";
          const filePath = `${activeCompanyId}/${applicantId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("applicant-documents")
            .upload(filePath, pf.file, { cacheControl: "3600", upsert: false });
          if (upErr) { toast.error(`Upload failed: ${pf.name}`); continue; }
          uploadedDocs.push({ name: pf.name, type: pf.type, fileUrl: `applicant-documents/${filePath}` });
        }
      }
      await createApplicant(activeCompanyId, {
        firstName: appForm.firstName,
        lastName: appForm.lastName,
        email: appForm.email,
        phone: appForm.phone || undefined,
        address: appForm.address || undefined,
        guardCardNumber: appForm.guardCardNumber || undefined,
        guardCardExpiry: appForm.guardCardExpiry || undefined,
        availability: appForm.availability || undefined,
        experience: appForm.experience || undefined,
        education: appForm.education.length > 0 ? appForm.education : undefined,
        workHistory: appForm.workHistory.length > 0 ? appForm.workHistory : undefined,
        documents: uploadedDocs.length > 0 ? uploadedDocs : undefined,
      });
      setAppForm({
        firstName: "", lastName: "", email: "", phone: "", address: "",
        guardCardNumber: "", guardCardExpiry: "",
        availability: "", experience: "", notes: "",
        education: [], workHistory: [], pendingFiles: [],
      });
      setShowAddApp(false);
      setApplicants(await getApplicants(activeCompanyId));
      toast.success("Applicant added");
    } catch (err) { console.error(err); toast.error("Failed to add applicant"); } finally { setSavingApp(false); }
  }

  async function handleAppStatus(id: string, status: string) {
    setUpdatingApp(id);
    try {
      await updateApplicantStatus(id, status);
      if (status === "hired" && activeCompanyId && activeCompanyId !== "pending") {
        try {
          await convertApplicantToUser(id, activeCompanyId);
          // Fire integration triggers (email, WhatsApp, Checkr, DocuSign)
          const applicant = applicants.find((a: Applicant) => a.id === id);
          if (applicant) {
            const appUrl = typeof window !== "undefined"
              ? `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}`
              : "";
            onApplicantHired({
              companyId: activeCompanyId,
              companyName: companyName || "Your Company",
              joinCode,
              appUrl,
              applicant: {
                firstName: applicant.first_name ?? "",
                lastName: applicant.last_name ?? "",
                email: applicant.email ?? "",
                phone: applicant.phone,
              },
            }).then(result => {
              onHireResult(result);
              setTimeout(() => onHireResult(null), 8000);
            }).catch(err => console.error("Integration triggers failed:", err));
          }
        } catch (err) { console.error("Convert failed:", err); }
      }
      if (activeCompanyId && activeCompanyId !== "pending") setApplicants(await getApplicants(activeCompanyId));
    } catch (err) { console.error(err); } finally { setUpdatingApp(null); }
  }

  async function handleDeleteApp(id: string) {
    if (!confirm("Delete this applicant?")) return;
    try {
      await deleteApplicant(id);
      if (activeCompanyId && activeCompanyId !== "pending") setApplicants(await getApplicants(activeCompanyId));
      toast.success("Applicant deleted");
    } catch (err) { console.error(err); toast.error("Failed to delete applicant"); }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected applicant${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let deleted = 0;
    for (const id of selected) {
      try { await deleteApplicant(id); deleted++; } catch { /* continue */ }
    }
    setSelected(new Set());
    if (activeCompanyId && activeCompanyId !== "pending") setApplicants(await getApplicants(activeCompanyId));
    toast.success(`Deleted ${deleted} applicant${deleted > 1 ? "s" : ""}`);
    setBulkDeleting(false);
  }

  function toggleSelectAll() {
    if (selected.size === filteredApplicants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredApplicants.map((a: Applicant) => a.id)));
    }
  }

  const filteredApplicants = appFilter === "all" ? applicants : applicants.filter((a: Applicant) => a.status === appFilter);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setAppFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors capitalize ${appFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
            {s === "all" ? `All (${applicants.length})` : `${s} (${applicants.filter((a: Applicant) => a.status === s).length})`}
          </button>
        ))}
        {canManage && (
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => setShowAddApp(!showAddApp)}>
            {showAddApp ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAddApp ? "Cancel" : "Add Applicant"}
          </Button>
        )}
      </div>

      {/* Selection toolbar */}
      {canManage && filteredApplicants.length > 0 && (
        <div className="flex items-center gap-3 px-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === filteredApplicants.length}
              onChange={toggleSelectAll}
              className="rounded border-border"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              className="h-6 text-[10px] px-2 gap-1"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete {selected.size}
            </Button>
          )}
        </div>
      )}

      {showAddApp && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4 max-h-[70vh] overflow-auto">
          <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Applicant Manually</p>

          {/* Personal Information */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal Information</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="First name *" value={appForm.firstName}
                onChange={(e) => setAppForm(p => ({ ...p, firstName: e.target.value }))} />
              <Input placeholder="Last name" value={appForm.lastName}
                onChange={(e) => setAppForm(p => ({ ...p, lastName: e.target.value }))} />
              <Input placeholder="Email *" type="email" value={appForm.email}
                onChange={(e) => setAppForm(p => ({ ...p, email: e.target.value }))} />
              <PhoneInput value={appForm.phone}
                onChange={(v) => setAppForm(p => ({ ...p, phone: v }))} />
              <Input placeholder="Address" className="sm:col-span-2" value={appForm.address}
                onChange={(e) => setAppForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credentials</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Guard card #" value={appForm.guardCardNumber}
                onChange={(e) => setAppForm(p => ({ ...p, guardCardNumber: e.target.value }))} />
              <Input placeholder="Guard card expiry" type="date" value={appForm.guardCardExpiry}
                onChange={(e) => setAppForm(p => ({ ...p, guardCardExpiry: e.target.value }))} />
            </div>
          </div>

          {/* Availability & Experience */}
          <div className="space-y-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Availability (e.g. Weekends, Nights)" value={appForm.availability}
                onChange={(e) => setAppForm(p => ({ ...p, availability: e.target.value }))} />
              <Input placeholder="Experience / background" value={appForm.experience}
                onChange={(e) => setAppForm(p => ({ ...p, experience: e.target.value }))} />
            </div>
          </div>

          {/* Education */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Education</p>
              <button type="button" onClick={() => setAppForm(p => ({ ...p, education: [...p.education, { institution: "", degree: "", startYear: "", endYear: "" }] }))}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {appForm.education.map((edu, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-4 rounded-lg border border-border/40 p-2 relative">
                <Input placeholder="Institution" value={edu.institution}
                  onChange={(e) => setAppForm(p => { const ed = [...p.education]; ed[idx] = { ...ed[idx], institution: e.target.value }; return { ...p, education: ed }; })} />
                <Input placeholder="Degree" value={edu.degree}
                  onChange={(e) => setAppForm(p => { const ed = [...p.education]; ed[idx] = { ...ed[idx], degree: e.target.value }; return { ...p, education: ed }; })} />
                <Input placeholder="Start year" value={edu.startYear}
                  onChange={(e) => setAppForm(p => { const ed = [...p.education]; ed[idx] = { ...ed[idx], startYear: e.target.value }; return { ...p, education: ed }; })} />
                <div className="flex gap-1">
                  <Input placeholder="End year" value={edu.endYear}
                    onChange={(e) => setAppForm(p => { const ed = [...p.education]; ed[idx] = { ...ed[idx], endYear: e.target.value }; return { ...p, education: ed }; })} />
                  <button type="button" onClick={() => setAppForm(p => ({ ...p, education: p.education.filter((_, i) => i !== idx) }))}
                    className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Work History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Experience / Work History</p>
              <button type="button" onClick={() => setAppForm(p => ({ ...p, workHistory: [...p.workHistory, { employer: "", title: "", startDate: "", endDate: "", description: "" }] }))}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Plus className="h-3 w-3" /> Add</button>
            </div>
            {appForm.workHistory.map((wh, idx) => (
              <div key={idx} className="rounded-lg border border-border/40 p-2 space-y-2 relative">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input placeholder="Employer" value={wh.employer}
                    onChange={(e) => setAppForm(p => { const wh2 = [...p.workHistory]; wh2[idx] = { ...wh2[idx], employer: e.target.value }; return { ...p, workHistory: wh2 }; })} />
                  <Input placeholder="Title" value={wh.title}
                    onChange={(e) => setAppForm(p => { const wh2 = [...p.workHistory]; wh2[idx] = { ...wh2[idx], title: e.target.value }; return { ...p, workHistory: wh2 }; })} />
                  <Input placeholder="Start date" type="date" value={wh.startDate}
                    onChange={(e) => setAppForm(p => { const wh2 = [...p.workHistory]; wh2[idx] = { ...wh2[idx], startDate: e.target.value }; return { ...p, workHistory: wh2 }; })} />
                  <Input placeholder="End date" type="date" value={wh.endDate}
                    onChange={(e) => setAppForm(p => { const wh2 = [...p.workHistory]; wh2[idx] = { ...wh2[idx], endDate: e.target.value }; return { ...p, workHistory: wh2 }; })} />
                </div>
                <div className="flex gap-1">
                  <Input placeholder="Description" value={wh.description}
                    onChange={(e) => setAppForm(p => { const wh2 = [...p.workHistory]; wh2[idx] = { ...wh2[idx], description: e.target.value }; return { ...p, workHistory: wh2 }; })} />
                  <button type="button" onClick={() => setAppForm(p => ({ ...p, workHistory: p.workHistory.filter((_, i) => i !== idx) }))}
                    className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</p>
              <button type="button" onClick={() => appFileInputRef.current?.click()}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Upload className="h-3 w-3" /> Upload</button>
            </div>
            <input ref={appFileInputRef} type="file" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setAppForm(p => ({ ...p, pendingFiles: [...p.pendingFiles, { name: file.name, type: "Other", file }] }));
              if (appFileInputRef.current) appFileInputRef.current.value = "";
            }} />
            {appForm.pendingFiles.map((pf, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{pf.name}</span>
                <select value={pf.type}
                  onChange={(e) => setAppForm(p => { const pfs = [...p.pendingFiles]; pfs[idx] = { ...pfs[idx], type: e.target.value }; return { ...p, pendingFiles: pfs }; })}
                  className="h-6 rounded border border-border/40 bg-background px-1.5 text-[10px]">
                  {DOCUMENT_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                </select>
                <button type="button" onClick={() => setAppForm(p => ({ ...p, pendingFiles: p.pendingFiles.filter((_, i) => i !== idx) }))}
                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>

          {/* Notes (admin-only) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Notes</p>
            <textarea placeholder="Internal notes about this applicant..."
              value={appForm.notes}
              onChange={(e) => setAppForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-xs min-h-[60px] resize-y" />
          </div>

          <Button size="sm" onClick={handleAddApplicant} disabled={!appForm.firstName.trim() || !appForm.email.trim() || savingApp}>
            {savingApp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Applicant"}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredApplicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <UserPlus className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No applicants{appFilter !== "all" ? ` with status "${appFilter}"` : ""}</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Applicants from your public form or manual entry will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredApplicants.map((a: Applicant) => (
            <div key={a.id} className={`rounded-xl border bg-card px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${selected.has(a.id) ? "border-primary/50 bg-primary/5" : a.status === "applied" ? "border-blue-500/30" : "border-border/50"}`}
              onClick={() => setViewingApplicant(a)}>
              <div className="flex items-center gap-4">
                {canManage && (
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                      return next;
                    })}
                    className="rounded border-border shrink-0"
                  />
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
                  {(a.first_name?.[0] ?? "")}{(a.last_name?.[0] ?? "")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                  <p className="text-xs text-muted-foreground">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {a.guard_card_number && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Guard Card:</span> {a.guard_card_number}</span>}
                    {a.availability && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Availability:</span> {a.availability}</span>}
                    {a.experience && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Experience:</span> {a.experience.slice(0, 60)}</span>}
                    {a.source && a.source !== "overwatch" && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Source:</span> {a.source}</span>}
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">Applied {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <Badge className={`text-[10px] capitalize ${STATUS_COLORS[a.status] ?? "bg-muted text-muted-foreground"}`}>{a.status}</Badge>
                {canManage && a.status !== "hired" && a.status !== "rejected" && a.status !== "withdrawn" && (
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {a.status === "applied" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => handleAppStatus(a.id, "reviewing")} disabled={updatingApp === a.id}>
                        {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Review"}
                      </Button>
                    )}
                    {a.status === "reviewing" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => handleAppStatus(a.id, "interviewing")} disabled={updatingApp === a.id}>
                        {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Interview"}
                      </Button>
                    )}
                    {a.status === "interviewing" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => handleAppStatus(a.id, "offered")} disabled={updatingApp === a.id}>
                        {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Offer"}
                      </Button>
                    )}
                    {(a.status === "offered" || a.status === "interviewing") && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                        onClick={() => handleAppStatus(a.id, "hired")} disabled={updatingApp === a.id}>
                        {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowRight className="h-3 w-3" /> Hire</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => handleAppStatus(a.id, "rejected")} disabled={updatingApp === a.id}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {canManage && (a.status === "hired" || a.status === "rejected" || a.status === "withdrawn") && (
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteApp(a.id); }}
                    className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Public application form link */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2 mt-4">
        <p className="font-medium text-sm">Public Application Form</p>
        <p className="text-xs text-muted-foreground">
          Share this link with potential applicants. Submissions appear here.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
            {typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}/apply?c=${activeCompanyId ?? ""}` : `/apply?c=${activeCompanyId ?? ""}`}
          </code>
          <Button size="sm" variant="outline" className="shrink-0 text-xs gap-1"
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}/apply?c=${activeCompanyId ?? ""}`;
              navigator.clipboard.writeText(url);
            }}>
            <Copy className="h-3 w-3" /> Copy
          </Button>
        </div>
      </div>

      {/* Integrations config preview */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2 mt-3">
        <p className="font-medium text-sm">External Integrations</p>
        <p className="text-xs text-muted-foreground">
          Connect Fillout, Airtable, or other tools to auto-import applicants via webhooks.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { name: "Fillout", desc: "Receive form submissions via webhook", status: "planned" },
            { name: "Airtable", desc: "Sync applicant records bidirectionally", status: "planned" },
            { name: "Email (Postmark)", desc: "Auto-send onboarding emails on hire", status: "planned" },
          ].map(int => (
            <div key={int.name} className="rounded-lg border border-border/40 p-3">
              <p className="text-xs font-medium">{int.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{int.desc}</p>
              <Badge variant="outline" className="text-[9px] mt-1.5">{int.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* ── Applicant Detail Modal ── */}
      {viewingApplicant && activeCompanyId && (
        <ApplicantDetailModal
          applicant={viewingApplicant}
          canManage={canManage}
          updatingApp={updatingApp}
          activeCompanyId={activeCompanyId}
          onClose={() => setViewingApplicant(null)}
          onStatusChange={async (id, status) => {
            await handleAppStatus(id, status);
            if (activeCompanyId && activeCompanyId !== "pending") {
              const updated = await getApplicants(activeCompanyId);
              setApplicants(updated);
              const fresh = updated.find((x: Applicant) => x.id === id);
              if (fresh) setViewingApplicant(fresh);
              else setViewingApplicant(null);
            }
          }}
        />
      )}
    </>
  );
}
