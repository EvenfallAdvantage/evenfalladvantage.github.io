"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle2, AlertTriangle, Send, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

import { type EducationEntry, type WorkHistoryEntry, type DocumentEntry, type PendingFile } from "@/components/apply/apply-types";
import { ApplyPersonalInfoSection } from "@/components/apply/apply-personal-info-section";
import { ApplyCredentialsSection } from "@/components/apply/apply-credentials-section";
import { ApplyEducationSection } from "@/components/apply/apply-education-section";
import { ApplyExperienceSection } from "@/components/apply/apply-experience-section";
import { ApplyDocumentsSection } from "@/components/apply/apply-documents-section";
import { ApplyAdditionalInfoSection } from "@/components/apply/apply-additional-info-section";

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  file: File, companyId: string, applicantId: string,
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const filePath = `${companyId}/${applicantId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("applicant-documents")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);
  return `applicant-documents/${filePath}`;
}

function ApplyForm() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("c");

  const [company, setCompany] = useState<{ id: string; name: string; logo_url?: string; brand_color?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", guardCardNumber: "", guardCardExpiry: "",
    availability: "", coverLetter: "",
    education: [] as EducationEntry[],
    workHistory: [] as WorkHistoryEntry[],
    documents: [] as DocumentEntry[],
  });

  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [filePreviews, setFilePreviews] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("companies").select("id, name, logo_url, brand_color").eq("id", companyId).maybeSingle();
        if (data) setCompany(data); else setNotFound(true);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [companyId]);

  useEffect(() => { return () => { Object.values(filePreviews).forEach((url) => URL.revokeObjectURL(url)); }; }, [filePreviews]);

  function updateField(field: string, value: string) { setForm((p) => ({ ...p, [field]: value })); }

  function addEducation() { setForm((p) => ({ ...p, education: [...p.education, { institution: "", degree: "", startYear: "", endYear: "" }] })); }
  function updateEducation(idx: number, field: keyof EducationEntry, value: string) { setForm((p) => { const u = [...p.education]; u[idx] = { ...u[idx], [field]: value }; return { ...p, education: u }; }); }
  function removeEducation(idx: number) { setForm((p) => ({ ...p, education: p.education.filter((_, i) => i !== idx) })); }

  function addWorkHistory() { setForm((p) => ({ ...p, workHistory: [...p.workHistory, { employer: "", title: "", startDate: "", endDate: "", description: "" }] })); }
  function updateWorkHistory(idx: number, field: keyof WorkHistoryEntry, value: string) { setForm((p) => { const u = [...p.workHistory]; u[idx] = { ...u[idx], [field]: value }; return { ...p, workHistory: u }; }); }
  function removeWorkHistory(idx: number) { setForm((p) => ({ ...p, workHistory: p.workHistory.filter((_, i) => i !== idx) })); }

  function addDocument(file: File, name: string, type: string) {
    const newIndex = pendingFiles.length;
    setPendingFiles((prev) => [...prev, { name, type, file }]);
    if (file.type.startsWith("image/")) setFilePreviews((prev) => ({ ...prev, [newIndex]: URL.createObjectURL(file) }));
  }
  function removePendingFile(idx: number) {
    if (filePreviews[idx]) URL.revokeObjectURL(filePreviews[idx]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => { const next: Record<number, string> = {}; Object.entries(prev).forEach(([k, v]) => { const key = Number(k); if (key < idx) next[key] = v; else if (key > idx) next[key - 1] = v; }); return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !form.firstName.trim() || !form.email.trim()) return;
    setSubmitting(true); setError(null);
    const applicantId = crypto.randomUUID();
    try {
      const supabase = createClient();
      const uploadedDocuments: DocumentEntry[] = [];
      for (const pf of pendingFiles) { const fileUrl = await uploadFile(supabase, pf.file, company.id, applicantId); uploadedDocuments.push({ name: pf.name, type: pf.type, fileUrl }); }
      const { error: insertErr } = await supabase.from("applicants").insert({
        id: applicantId, company_id: company.id,
        first_name: form.firstName.trim(), last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(), phone: form.phone.trim() || null,
        address: form.address.trim() || null, guard_card_number: form.guardCardNumber.trim() || null,
        guard_card_expiry: form.guardCardExpiry || null, availability: form.availability.trim() || null,
        cover_letter: form.coverLetter.trim() || null, education: form.education,
        work_history: form.workHistory, documents: [...form.documents, ...uploadedDocuments],
        source: "public_form", status: "applied",
      });
      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) { console.error(err); setError(err instanceof Error ? err.message : "Failed to submit application. Please try again."); }
    finally { setSubmitting(false); }
  }

  // ─── Early-return screens ─────────────────────────
  if (!companyId) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <Shield className="h-12 w-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-white font-mono">OVERWATCH</h1>
        <p className="text-zinc-400 text-sm">This is the employment application portal. If you were given a link to apply, please use the full URL provided by the company.</p>
        <p className="text-zinc-500 text-xs">Missing company parameter. URL should include <code className="text-zinc-400">?c=company-id</code></p>
      </div>
    </div>
  );
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (notFound || !company) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h1 className="text-xl font-bold text-white">Company Not Found</h1>
        <p className="text-zinc-400 text-sm">The company linked in this application URL could not be found. Please check the link and try again.</p>
      </div>
    </div>
  );
  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10"><CheckCircle2 className="h-8 w-8 text-green-500" /></div>
        <h1 className="text-xl font-bold text-white">Application Submitted!</h1>
        <p className="text-zinc-400 text-sm">Thank you for applying to <span className="font-semibold text-white">{company.name}</span>. We&apos;ve received your application and will be in touch.</p>
        <Badge className="bg-green-500/15 text-green-500">Confirmation sent to {form.email}</Badge>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 py-8 px-4 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20"><Building2 className="h-5 w-5 text-primary" /></div>
            )}
            <h1 className="text-2xl font-bold text-white font-mono">{company.name}</h1>
          </div>
          <p className="text-zinc-400 text-sm">Employment Application</p>
          <div className="h-px bg-zinc-800 max-w-xs mx-auto" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ApplyPersonalInfoSection firstName={form.firstName} lastName={form.lastName} email={form.email} phone={form.phone} address={form.address} onChange={updateField} />
          <ApplyCredentialsSection guardCardNumber={form.guardCardNumber} guardCardExpiry={form.guardCardExpiry} onChange={updateField} />
          <ApplyEducationSection education={form.education} onAdd={addEducation} onUpdate={updateEducation} onRemove={removeEducation} />
          <ApplyExperienceSection workHistory={form.workHistory} onAdd={addWorkHistory} onUpdate={updateWorkHistory} onRemove={removeWorkHistory} />
          <ApplyDocumentsSection pendingFiles={pendingFiles} filePreviews={filePreviews} onAddDocument={addDocument} onRemoveFile={removePendingFile} />
          <ApplyAdditionalInfoSection availability={form.availability} coverLetter={form.coverLetter} onChange={updateField} />

          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">{error}</div>}

          <Button type="submit" size="lg" disabled={!form.firstName.trim() || !form.email.trim() || submitting} className="w-full gap-2 font-semibold">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Uploading & Submitting..." : "Submit Application"}
          </Button>
          <p className="text-center text-[10px] text-zinc-500">By submitting, you consent to {company.name} processing your personal data for employment purposes.</p>
        </form>

        <div className="text-center pt-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 flex items-center justify-center gap-1">Powered by <Shield className="h-3 w-3" /> <span className="font-mono font-semibold">OVERWATCH</span></p>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ApplyForm />
    </Suspense>
  );
}
