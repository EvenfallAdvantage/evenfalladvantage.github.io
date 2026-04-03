"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle2, AlertTriangle, Send, Building2, Plus, X, FileText, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AddressAutocomplete from "@/components/address-autocomplete";

const DOCUMENT_TYPES = [
  "Guard Card",
  "CPR/First Aid",
  "EMT",
  "OSHA",
  "Firearms",
  "Security License",
  "Military",
  "LEO",
  "Other",
] as const;

type EducationEntry = { institution: string; degree: string; startYear: string; endYear: string };
type WorkHistoryEntry = { employer: string; title: string; startDate: string; endDate: string; description: string };
type DocumentEntry = { name: string; type: string; fileUrl: string };
type PendingFile = { name: string; type: string; file: File };

async function uploadFile(
  supabase: ReturnType<typeof createClient>,
  file: File,
  companyId: string,
  applicantId: string,
): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const filePath = `${companyId}/${applicantId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("applicant-documents")
    .upload(filePath, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("applicant-documents")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load company info
  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("companies")
          .select("id, name, logo_url, brand_color")
          .eq("id", companyId)
          .maybeSingle();
        if (data) setCompany(data);
        else setNotFound(true);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [companyId]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(filePreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [filePreviews]);

  // ─── Education helpers ─────────────────────────────
  function addEducation() {
    setForm((p) => ({
      ...p,
      education: [...p.education, { institution: "", degree: "", startYear: "", endYear: "" }],
    }));
  }

  function updateEducation(idx: number, field: keyof EducationEntry, value: string) {
    setForm((p) => {
      const updated = [...p.education];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...p, education: updated };
    });
  }

  function removeEducation(idx: number) {
    setForm((p) => ({
      ...p,
      education: p.education.filter((_, i) => i !== idx),
    }));
  }

  // ─── Work History helpers ──────────────────────────
  function addWorkHistory() {
    setForm((p) => ({
      ...p,
      workHistory: [...p.workHistory, { employer: "", title: "", startDate: "", endDate: "", description: "" }],
    }));
  }

  function updateWorkHistory(idx: number, field: keyof WorkHistoryEntry, value: string) {
    setForm((p) => {
      const updated = [...p.workHistory];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...p, workHistory: updated };
    });
  }

  function removeWorkHistory(idx: number) {
    setForm((p) => ({
      ...p,
      workHistory: p.workHistory.filter((_, i) => i !== idx),
    }));
  }

  // ─── Document / file helpers ───────────────────────
  function addDocument(file: File, name: string, type: string) {
    const newIndex = pendingFiles.length;
    setPendingFiles((prev) => [...prev, { name, type, file }]);

    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      setFilePreviews((prev) => ({ ...prev, [newIndex]: objectUrl }));
    }
  }

  function removePendingFile(idx: number) {
    if (filePreviews[idx]) {
      URL.revokeObjectURL(filePreviews[idx]);
    }
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const key = Number(k);
        if (key < idx) next[key] = v;
        else if (key > idx) next[key - 1] = v;
      });
      return next;
    });
  }

  const [docFormName, setDocFormName] = useState("");
  const [docFormType, setDocFormType] = useState<string>(DOCUMENT_TYPES[0]);
  const [docFormFile, setDocFormFile] = useState<File | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setDocFormFile(file);
  }

  function confirmAddDocument() {
    if (!docFormFile || !docFormName.trim()) return;
    addDocument(docFormFile, docFormName.trim(), docFormType);
    setDocFormName("");
    setDocFormType(DOCUMENT_TYPES[0]);
    setDocFormFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Submit ────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !form.firstName.trim() || !form.email.trim()) return;
    setSubmitting(true);
    setError(null);

    const applicantId = crypto.randomUUID();

    try {
      const supabase = createClient();

      // Upload all pending files first
      const uploadedDocuments: DocumentEntry[] = [];
      for (const pf of pendingFiles) {
        const fileUrl = await uploadFile(supabase, pf.file, company.id, applicantId);
        uploadedDocuments.push({ name: pf.name, type: pf.type, fileUrl });
      }

      const allDocuments = [...form.documents, ...uploadedDocuments];

      const { error: insertErr } = await supabase.from("applicants").insert({
        id: applicantId,
        company_id: company.id,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        guard_card_number: form.guardCardNumber.trim() || null,
        guard_card_expiry: form.guardCardExpiry || null,
        availability: form.availability.trim() || null,
        cover_letter: form.coverLetter.trim() || null,
        education: form.education,
        work_history: form.workHistory,
        documents: allDocuments,
        source: "public_form",
        status: "applied",
      });

      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to submit application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Early-return screens ─────────────────────────

  // No company param
  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Shield className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-white font-mono">OVERWATCH</h1>
          <p className="text-zinc-400 text-sm">
            This is the employment application portal. If you were given a link to apply,
            please use the full URL provided by the company.
          </p>
          <p className="text-zinc-500 text-xs">
            Missing company parameter. URL should include <code className="text-zinc-400">?c=company-id</code>
          </p>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not found
  if (notFound || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-white">Company Not Found</h1>
          <p className="text-zinc-400 text-sm">
            The company linked in this application URL could not be found. Please check the link and try again.
          </p>
        </div>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-white">Application Submitted!</h1>
          <p className="text-zinc-400 text-sm">
            Thank you for applying to <span className="font-semibold text-white">{company.name}</span>.
            We&apos;ve received your application and will be in touch.
          </p>
          <Badge className="bg-green-500/15 text-green-500">Confirmation sent to {form.email}</Badge>
        </div>
      </div>
    );
  }

  // ─── Application Form ─────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 py-8 px-4 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3">
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-white font-mono">{company.name}</h1>
          </div>
          <p className="text-zinc-400 text-sm">Employment Application</p>
          <div className="h-px bg-zinc-800 max-w-xs mx-auto" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Section 1: Personal Info ─────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</span>
              Personal Information
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">First Name <span className="text-red-400">*</span></label>
                <Input value={form.firstName} onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))}
                  required className="bg-zinc-900 border-zinc-700 text-white" placeholder="John" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Last Name <span className="text-red-400">*</span></label>
                <Input value={form.lastName} onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))}
                  required className="bg-zinc-900 border-zinc-700 text-white" placeholder="Doe" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Email <span className="text-red-400">*</span></label>
                <Input value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  type="email" required className="bg-zinc-900 border-zinc-700 text-white" placeholder="john@example.com" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Phone</label>
                <PhoneInput value={form.phone} onChange={(v) => setForm(p => ({ ...p, phone: v }))}
                  className="bg-zinc-900 border-zinc-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Address</label>
              <AddressAutocomplete
                value={form.address}
                onChange={(v) => setForm(p => ({ ...p, address: v }))}
                onSelect={(s) => setForm(p => ({ ...p, address: s.displayName }))}
                placeholder="123 Main St, City, State ZIP"
                inputClassName="bg-zinc-900 border-zinc-700 text-white"
              />
            </div>
          </div>

          {/* ── Section 2: Credentials ───────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</span>
              Credentials
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Guard Card Number</label>
                <Input value={form.guardCardNumber} onChange={(e) => setForm(p => ({ ...p, guardCardNumber: e.target.value }))}
                  className="bg-zinc-900 border-zinc-700 text-white" placeholder="GC-12345" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Guard Card Expiry</label>
                <Input value={form.guardCardExpiry} onChange={(e) => setForm(p => ({ ...p, guardCardExpiry: e.target.value }))}
                  type="date" className="bg-zinc-900 border-zinc-700 text-white" />
              </div>
            </div>
          </div>

          {/* ── Section 3: Education ──────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
              Education
            </h2>
            <p className="text-xs text-zinc-500">Optional. Add your educational background.</p>

            {form.education.map((edu, idx) => (
              <div key={idx} className="relative rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => removeEducation(idx)}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  aria-label="Remove education entry"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Institution</label>
                    <Input
                      value={edu.institution}
                      onChange={(e) => updateEducation(idx, "institution", e.target.value)}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder="University or School Name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Degree / Program</label>
                    <Input
                      value={edu.degree}
                      onChange={(e) => updateEducation(idx, "degree", e.target.value)}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder="Bachelor of Science, GED, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Start Year</label>
                    <Input
                      value={edu.startYear}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        updateEducation(idx, "startYear", v);
                      }}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder="2020"
                      maxLength={4}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">End Year</label>
                    <Input
                      value={edu.endYear}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw.toLowerCase().startsWith("p")) {
                          updateEducation(idx, "endYear", "Present");
                        } else {
                          const v = raw.replace(/\D/g, "").slice(0, 4);
                          updateEducation(idx, "endYear", v);
                        }
                      }}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder='2024 or "Present"'
                    />
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addEducation}
              className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add Education
            </Button>
          </div>

          {/* ── Section 4: Experience ─────────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">4</span>
              Experience
            </h2>
            <p className="text-xs text-zinc-500">Optional. Add your work history.</p>

            {form.workHistory.map((job, idx) => (
              <div key={idx} className="relative rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => removeWorkHistory(idx)}
                  className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  aria-label="Remove experience entry"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Employer</label>
                    <Input
                      value={job.employer}
                      onChange={(e) => updateWorkHistory(idx, "employer", e.target.value)}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder="Company Name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Job Title</label>
                    <Input
                      value={job.title}
                      onChange={(e) => updateWorkHistory(idx, "title", e.target.value)}
                      className="bg-zinc-800 border-zinc-600 text-white"
                      placeholder="Security Officer, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Start Date</label>
                    <Input
                      value={job.startDate}
                      onChange={(e) => updateWorkHistory(idx, "startDate", e.target.value)}
                      type="month"
                      className="bg-zinc-800 border-zinc-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">End Date</label>
                    <div className="space-y-1.5">
                      <Input
                        value={job.endDate === "Present" ? "" : job.endDate}
                        onChange={(e) => updateWorkHistory(idx, "endDate", e.target.value)}
                        type="month"
                        disabled={job.endDate === "Present"}
                        className="bg-zinc-800 border-zinc-600 text-white disabled:opacity-50"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={job.endDate === "Present"}
                          onChange={(e) => updateWorkHistory(idx, "endDate", e.target.checked ? "Present" : "")}
                          className="rounded border-zinc-600 bg-zinc-800 text-primary focus:ring-primary"
                        />
                        Currently work here
                      </label>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Description</label>
                  <textarea
                    value={job.description}
                    onChange={(e) => updateWorkHistory(idx, "description", e.target.value)}
                    rows={2}
                    className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Describe your responsibilities and achievements..."
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addWorkHistory}
              className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add Experience
            </Button>
          </div>

          {/* ── Section 5: Certifications & Documents ── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">5</span>
              Certifications &amp; Documents
            </h2>
            <p className="text-xs text-zinc-500">Optional. Upload certificates, licenses, and other supporting documents.</p>

            {/* Existing pending files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3">
                    {filePreviews[idx] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={filePreviews[idx]} alt={pf.name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 flex-shrink-0">
                        <FileText className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{pf.name}</p>
                      <p className="text-xs text-zinc-500">{pf.type} &middot; {pf.file.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(idx)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex-shrink-0"
                      aria-label="Remove document"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new document form */}
            <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Certificate Name</label>
                  <Input
                    value={docFormName}
                    onChange={(e) => setDocFormName(e.target.value)}
                    className="bg-zinc-800 border-zinc-600 text-white"
                    placeholder="e.g. BSIS Guard Card"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                  <select
                    value={docFormType}
                    onChange={(e) => setDocFormType(e.target.value)}
                    className="w-full h-9 rounded-md border border-zinc-600 bg-zinc-800 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">File (image or PDF)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-700 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-zinc-600 file:cursor-pointer cursor-pointer"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={confirmAddDocument}
                disabled={!docFormFile || !docFormName.trim()}
                className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" /> Add Certificate
              </Button>
            </div>
          </div>

          {/* ── Section 6: Additional Info ────────────── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">6</span>
              Additional Info
            </h2>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Availability</label>
              <Input value={form.availability} onChange={(e) => setForm(p => ({ ...p, availability: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" placeholder="Weekdays, Weekends, Nights, etc." />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Why do you want to work with us?</label>
              <textarea value={form.coverLetter} onChange={(e) => setForm(p => ({ ...p, coverLetter: e.target.value }))}
                rows={3} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Tell us about yourself and why you'd be a great fit..." />
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" disabled={!form.firstName.trim() || !form.email.trim() || submitting}
            className="w-full gap-2 font-semibold">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Uploading & Submitting..." : "Submit Application"}
          </Button>

          <p className="text-center text-[10px] text-zinc-500">
            By submitting, you consent to {company.name} processing your personal data for employment purposes.
          </p>
        </form>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-600 flex items-center justify-center gap-1">
            Powered by <Shield className="h-3 w-3" /> <span className="font-mono font-semibold">OVERWATCH</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
