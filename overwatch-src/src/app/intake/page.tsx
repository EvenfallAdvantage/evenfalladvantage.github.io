"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Shield, MapPin, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupIntakeShare, markShareSubmitted } from "@/lib/supabase/db-intake-shares";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

interface ClientIntakeData {
  clientName: string; clientEmail: string; clientRequest: string; timeSensitivity: string;
  venueType: string[]; estimatedAttendance: string; environment: string; environmentNotes: string;
  clientIdentifiedRisks: string; riskLevel: string; threatTypes: string[]; successCriteria: string[];
  additionalNotes: string;
}

const VENUE_TYPES = ["Arena/Stadium", "Convention Center", "Corporate Office", "Nightclub/Bar", "Outdoor Festival", "Private Residence", "Religious Facility", "Restaurant", "Retail", "School/Campus"];
const THREAT_TYPES = ["Active Threat", "Civil Unrest", "Crowd Control", "Cyber", "Fire/Hazmat", "Medical", "Natural Disaster", "Protest", "Theft/Burglary", "VIP/Executive"];
const SUCCESS_CRITERIA = ["Zero safety incidents", "Client satisfaction", "Regulatory compliance", "Rapid incident response", "Smooth guest experience", "Staff professionalism"];

const EMPTY: ClientIntakeData = {
  clientName: "", clientEmail: "", clientRequest: "", timeSensitivity: "Medium",
  venueType: [], estimatedAttendance: "", environment: "Indoor", environmentNotes: "",
  clientIdentifiedRisks: "", riskLevel: "Moderate", threatTypes: [], successCriteria: [], additionalNotes: "",
};

function IntakeFormInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [share, setShare] = useState<Awaited<ReturnType<typeof lookupIntakeShare>>>(null);
  const [data, setData] = useState<ClientIntakeData>(EMPTY);

  useEffect(() => {
    if (!token) { setError("No intake token provided."); setLoading(false); return; }
    lookupIntakeShare(token).then((r) => {
      if (!r) setError("This intake link is invalid or has expired.");
      else if (r.share.submitted_at) setSubmitted(true);
      setShare(r); setLoading(false);
    }).catch(() => { setError("Failed to load."); setLoading(false); });
  }, [token]);

  function upd<K extends keyof ClientIntakeData>(f: K, v: ClientIntakeData[K]) { setData((p) => ({ ...p, [f]: v })); }
  function chip(f: "venueType" | "threatTypes" | "successCriteria", v: string) {
    setData((p) => ({ ...p, [f]: p[f].includes(v) ? p[f].filter((x) => x !== v) : [...p[f], v] }));
  }

  async function handleSubmit() {
    if (!data.clientName.trim() || !data.clientEmail.trim() || !share) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      await supabase.from("operation_documents").insert({
        event_id: share.share.event_id, company_id: share.share.company_id,
        doc_type: "intake", version: 1, status: "draft",
        data: { ...data, _source: "client", _submitted_at: new Date().toISOString(), engagementType: [], missionStatement: "", servicesRequested: [], deliverables: "", outOfScope: "", medicalCapability: "", equipmentAvailable: "", commandModel: "", escalationFlow: "", eaRole: [], constraints: [] },
      });
      await markShareSubmitted(token, data.clientName, data.clientEmail);
      setSubmitted(true);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !share) return <div className="min-h-screen flex flex-col items-center justify-center p-6"><Shield className="h-12 w-12 text-muted-foreground/30 mb-4" /><h1 className="text-lg font-semibold mb-2">Link Not Found</h1><p className="text-sm text-muted-foreground text-center max-w-md">{error}</p></div>;
  if (submitted) return <div className="min-h-screen flex flex-col items-center justify-center p-6"><CheckCircle2 className="h-16 w-16 text-green-500 mb-4" /><h1 className="text-xl font-bold mb-2">Thank You!</h1><p className="text-sm text-muted-foreground text-center max-w-md">Your information has been submitted for <strong>{share.event.name}</strong>.</p></div>;

  const bc = share.company.brand_color || "#d59b3c";
  const Chip = ({ field, options }: { field: "venueType" | "threatTypes" | "successCriteria"; options: string[] }) => (
    <div className="flex flex-wrap gap-1.5">{options.map((v) => (<button key={v} onClick={() => chip(field, v)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${data[field].includes(v) ? "text-white border-transparent" : "border-border text-muted-foreground"}`} style={data[field].includes(v) ? { backgroundColor: bc } : {}}>{v}</button>))}</div>
  );
  const Pill = ({ field, options }: { field: keyof ClientIntakeData; options: string[] }) => (
    <div className="flex gap-2">{options.map((t) => (<button key={t} onClick={() => upd(field, t as never)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${data[field] === t ? "text-white border-transparent" : "border-border text-muted-foreground"}`} style={data[field] === t ? { backgroundColor: bc } : {}}>{t}</button>))}</div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/30 px-6 py-4" style={{ borderTopWidth: 4, borderTopColor: bc }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {share.company.logo_url && <Image src={share.company.logo_url} alt="" width={40} height={40} className="rounded-lg" />}
          <div><h1 className="text-lg font-bold">{share.company.name}</h1><p className="text-xs text-muted-foreground">Client Intake — {share.event.name}</p></div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <section className="space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><Shield className="h-4 w-4" style={{ color: bc }} /> Your Information</h2>
          <div className="grid grid-cols-2 gap-3"><Input placeholder="Your full name *" value={data.clientName} onChange={(e) => upd("clientName", e.target.value)} /><Input placeholder="Email address *" type="email" value={data.clientEmail} onChange={(e) => upd("clientEmail", e.target.value)} /></div></section>
        <section className="space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><Target className="h-4 w-4" style={{ color: bc }} /> What do you need?</h2>
          <textarea className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none" placeholder="Describe your security needs..." value={data.clientRequest} onChange={(e) => upd("clientRequest", e.target.value)} />
          <div><label className="text-xs text-muted-foreground mb-1 block">Time Sensitivity</label><Pill field="timeSensitivity" options={["Low", "Medium", "High", "Immediate"]} /></div></section>
        <section className="space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: bc }} /> Location & Environment</h2>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-muted-foreground mb-1 block">Attendance</label><Input placeholder="e.g., 500" value={data.estimatedAttendance} onChange={(e) => upd("estimatedAttendance", e.target.value)} /></div><div><label className="text-xs text-muted-foreground mb-1 block">Environment</label><Pill field="environment" options={["Indoor", "Outdoor", "Hybrid"]} /></div></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Venue Type</label><Chip field="venueType" options={VENUE_TYPES} /></div>
          <textarea className="w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none" placeholder="Additional notes..." value={data.environmentNotes} onChange={(e) => upd("environmentNotes", e.target.value)} /></section>
        <section className="space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" style={{ color: bc }} /> Risk & Concerns</h2>
          <textarea className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none" placeholder="Any known risks or concerns..." value={data.clientIdentifiedRisks} onChange={(e) => upd("clientIdentifiedRisks", e.target.value)} />
          <div><label className="text-xs text-muted-foreground mb-1 block">Risk Level</label><Pill field="riskLevel" options={["Low", "Moderate", "High", "Critical"]} /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Threat Types</label><Chip field="threatTypes" options={THREAT_TYPES} /></div></section>
        <section className="space-y-3"><h2 className="text-sm font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" style={{ color: bc }} /> Success Criteria</h2>
          <Chip field="successCriteria" options={SUCCESS_CRITERIA} />
          <textarea className="w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none" placeholder="Anything else..." value={data.additionalNotes} onChange={(e) => upd("additionalNotes", e.target.value)} /></section>
        <div className="pt-4 border-t border-border/30"><Button onClick={handleSubmit} disabled={!data.clientName.trim() || !data.clientEmail.trim() || submitting} className="w-full h-11 text-sm font-semibold" style={{ backgroundColor: bc }}>{submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit Information</Button>
          <p className="text-[10px] text-muted-foreground text-center mt-3">Your information will be shared with {share.company.name} for security planning.</p></div>
      </div>
    </div>
  );
}

export default function IntakePage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}><IntakeFormInner /></Suspense>;
}
