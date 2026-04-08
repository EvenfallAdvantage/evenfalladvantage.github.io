"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Loader2, CheckCircle2, AlertTriangle, Send, Building2, MapPin, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getIntakeByToken, submitIntakeData, type IntakeTokenRow } from "@/lib/supabase/db-client-intake";

type IntakeStatus = "loading" | "form" | "submitted" | "expired" | "invalid";

const INTAKE_SECTIONS = [
  {
    key: "siteInfo", title: "Site Information", icon: Building2,
    fields: [
      { key: "siteName", label: "Site / Venue Name", type: "text", required: true },
      { key: "siteAddress", label: "Address", type: "text", required: true },
      { key: "siteType", label: "Type of Facility", type: "select", options: ["Office Building", "Retail", "Warehouse", "Event Venue", "Residential Complex", "Hospital / Medical", "School / University", "Construction Site", "Government", "Other"], required: true },
      { key: "squareFootage", label: "Approximate Square Footage", type: "text" },
      { key: "floors", label: "Number of Floors / Areas", type: "text" },
    ],
  },
  {
    key: "schedule", title: "Coverage Requirements", icon: Clock,
    fields: [
      { key: "startDate", label: "Desired Start Date", type: "date", required: true },
      { key: "endDate", label: "End Date (if known)", type: "date" },
      { key: "hoursNeeded", label: "Hours of Coverage Needed", type: "select", options: ["24/7", "Business Hours (8am-6pm)", "Nights Only (6pm-6am)", "Weekends Only", "Event-Based", "Custom"] },
      { key: "guardsNeeded", label: "Number of Guards Needed", type: "text" },
      { key: "specialRequirements", label: "Special Requirements (armed, K-9, vehicle, etc.)", type: "textarea" },
    ],
  },
  {
    key: "access", title: "Access & Infrastructure", icon: MapPin,
    fields: [
      { key: "entryPoints", label: "Number of Entry / Exit Points", type: "text" },
      { key: "parkingAvailable", label: "Guard Parking Available?", type: "select", options: ["Yes", "No", "Limited"] },
      { key: "guardPost", label: "Guard Post / Station Available?", type: "select", options: ["Yes — Indoor", "Yes — Outdoor", "No — Roving Only"] },
      { key: "cctv", label: "CCTV System On-Site?", type: "select", options: ["Yes — Monitored", "Yes — Unmonitored", "No"] },
      { key: "alarmSystem", label: "Alarm System?", type: "select", options: ["Yes", "No", "Unknown"] },
    ],
  },
  {
    key: "concerns", title: "Security Concerns", icon: AlertTriangle,
    fields: [
      { key: "currentIssues", label: "Current Security Issues or Incidents", type: "textarea" },
      { key: "knownThreats", label: "Known Threats or Risks", type: "textarea" },
      { key: "previousSecurity", label: "Previous Security Provider (if any)", type: "text" },
      { key: "additionalNotes", label: "Additional Notes or Instructions", type: "textarea" },
    ],
  },
];

function ClientIntakeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<IntakeStatus>("loading");
  const [intake, setIntake] = useState<IntakeTokenRow | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  const load = useCallback(async () => {
    if (!token) { setStatus("invalid"); return; }
    try {
      const data = await getIntakeByToken(token);
      if (!data) { setStatus("invalid"); return; }
      if (data.status === "revoked" || data.status === "expired") { setStatus("expired"); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) { setStatus("expired"); return; }
      setIntake(data);
      setClientName(data.client_name ?? "");
      setClientEmail(data.client_email ?? "");
      if (data.data && typeof data.data === "object") {
        const existing: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.data)) { if (typeof v === "string") existing[k] = v; }
        setFormData(existing);
      }
      setStatus(data.status === "submitted" ? "submitted" : "form");
    } catch { setStatus("invalid"); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function updateField(key: string, value: string) { setFormData(prev => ({ ...prev, [key]: value })); }

  async function handleSubmit() {
    if (!clientName.trim() || !clientEmail.trim()) { alert("Please enter your name and email."); return; }
    for (const section of INTAKE_SECTIONS) {
      for (const field of section.fields) {
        if (field.required && !formData[field.key]?.trim()) {
          alert(`"${field.label}" is required.`);
          setActiveSection(INTAKE_SECTIONS.indexOf(section));
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      await submitIntakeData(token, { clientName: clientName.trim(), clientEmail: clientEmail.trim(), data: formData });
      setStatus("submitted");
    } catch (err) { console.error("Intake submit failed:", err); alert("Failed to submit. Please try again."); }
    finally { setSubmitting(false); }
  }

  const brandColor = intake?.companies?.brand_color ?? "#1d3451";
  const companyName = intake?.companies?.name ?? "Security Provider";
  const companyLogo = intake?.companies?.logo_url;

  if (status === "loading") {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-3">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-lg font-bold">Invalid Link</h1>
          <p className="text-sm text-muted-foreground">This intake link is invalid or has expired. Please contact your security provider for a new link.</p>
        </div>
      </div>
    );
  }
  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-3">
          <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h1 className="text-lg font-bold">Link Expired</h1>
          <p className="text-sm text-muted-foreground">This intake form has expired or been revoked. Please contact {companyName} for a new link.</p>
        </div>
      </div>
    );
  }
  if (status === "submitted") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm text-center space-y-4">
          <CheckCircle2 className="mx-auto h-14 w-14" style={{ color: brandColor }} />
          <h1 className="text-xl font-bold">Intake Submitted</h1>
          <p className="text-sm text-muted-foreground">Thank you! Your security intake form has been submitted to {companyName}. A representative will review your information and follow up shortly.</p>
          <p className="text-xs text-muted-foreground/60">You can revisit this link to update your submission until the operation begins.</p>
          <Button size="sm" variant="outline" onClick={() => setStatus("form")}>Edit Submission</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 px-4 py-4" style={{ backgroundColor: brandColor + "0D" }}>
        <div className="mx-auto max-w-2xl flex items-center gap-3">
          {companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogo} alt={companyName} className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold" style={{ backgroundColor: brandColor }}>{companyName[0]}</div>
          )}
          <div>
            <h1 className="text-lg font-bold">{companyName}</h1>
            <p className="text-xs text-muted-foreground">Client Security Intake Form</p>
          </div>
          <Shield className="ml-auto h-6 w-6" style={{ color: brandColor }} />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
        <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" style={{ color: brandColor }} /> Your Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="text-xs font-medium text-muted-foreground">Your Name *</label><Input className="mt-1" placeholder="Full name" value={clientName} onChange={e => setClientName(e.target.value)} /></div>
            <div><label className="text-xs font-medium text-muted-foreground">Email Address *</label><Input className="mt-1" type="email" placeholder="email@company.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></div>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 overflow-x-auto">
          {INTAKE_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isActive = activeSection === idx;
            const hasData = section.fields.some(f => formData[f.key]?.trim());
            return (
              <button key={section.key} onClick={() => setActiveSection(idx)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${isActive ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
                {isActive && <Icon className="h-3.5 w-3.5" />}
                {section.title}
                {hasData && !isActive && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} />}
              </button>
            );
          })}
        </div>

        {INTAKE_SECTIONS.map((section, idx) => {
          if (idx !== activeSection) return null;
          const Icon = section.icon;
          return (
            <div key={section.key} className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Icon className="h-4 w-4" style={{ color: brandColor }} /> {section.title}</h2>
              <div className="space-y-3">
                {section.fields.map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-muted-foreground">{field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}</label>
                    {field.type === "text" && <Input className="mt-1" value={formData[field.key] ?? ""} onChange={e => updateField(field.key, e.target.value)} placeholder={field.label} />}
                    {field.type === "date" && <Input type="date" className="mt-1" value={formData[field.key] ?? ""} onChange={e => updateField(field.key, e.target.value)} />}
                    {field.type === "select" && "options" in field && (
                      <select value={formData[field.key] ?? ""} onChange={e => updateField(field.key, e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                        <option value="">Select...</option>
                        {(field.options ?? []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    )}
                    {field.type === "textarea" && <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" value={formData[field.key] ?? ""} onChange={e => updateField(field.key, e.target.value)} placeholder={field.label} />}
                  </div>
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveSection(Math.max(0, idx - 1))} disabled={idx === 0}>Previous</Button>
                {idx < INTAKE_SECTIONS.length - 1 ? (
                  <Button size="sm" onClick={() => setActiveSection(idx + 1)} style={{ backgroundColor: brandColor }} className="text-white hover:opacity-90">Next</Button>
                ) : (
                  <Button size="sm" className="gap-1.5 text-white hover:opacity-90" style={{ backgroundColor: brandColor }} onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Submit Intake
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        <div className="text-center py-4"><p className="text-[10px] text-muted-foreground/50">Powered by Overwatch &middot; Evenfall Advantage LLC</p></div>
      </div>
    </div>
  );
}

export default function ClientIntakePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <ClientIntakeContent />
    </Suspense>
  );
}
