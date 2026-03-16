"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Shield, Loader2, CheckCircle2, AlertTriangle, Send, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    availability: "", experience: "", coverLetter: "",
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company || !form.firstName.trim() || !form.email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: insertErr } = await supabase.from("applicants").insert({
        id: crypto.randomUUID(),
        company_id: company.id,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        guard_card_number: form.guardCardNumber.trim() || null,
        guard_card_expiry: form.guardCardExpiry || null,
        availability: form.availability.trim() || null,
        experience: form.experience.trim() || null,
        cover_letter: form.coverLetter.trim() || null,
        source: "public_form",
        status: "applied",
      });
      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to submit application. Please try again.");
    } finally { setSubmitting(false); }
  }

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

  // Application Form
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
          {/* Personal Info */}
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
                <Input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
                  type="tel" className="bg-zinc-900 border-zinc-700 text-white" placeholder="(555) 123-4567" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Address</label>
              <Input value={form.address} onChange={(e) => setForm(p => ({ ...p, address: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" placeholder="123 Main St, City, State ZIP" />
            </div>
          </div>

          {/* Credentials */}
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

          {/* Availability & Experience */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
              Availability & Experience
            </h2>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Availability</label>
              <Input value={form.availability} onChange={(e) => setForm(p => ({ ...p, availability: e.target.value }))}
                className="bg-zinc-900 border-zinc-700 text-white" placeholder="Weekdays, Weekends, Nights, etc." />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Experience & Background</label>
              <textarea value={form.experience} onChange={(e) => setForm(p => ({ ...p, experience: e.target.value }))}
                rows={3} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe your relevant experience, certifications, and background..." />
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
            Submit Application
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
