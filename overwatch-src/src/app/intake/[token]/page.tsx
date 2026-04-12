"use client";

// Required for static export — tokens are dynamic, resolved client-side
export function generateStaticParams() { return []; }

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2, Shield, MapPin, AlertTriangle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lookupIntakeShare, markShareSubmitted } from "@/lib/supabase/db-intake-shares";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

// Client-facing fields (subset of IntakeData)
interface ClientIntakeData {
  clientName: string;
  clientEmail: string;
  clientRequest: string;
  timeSensitivity: string;
  venueType: string[];
  estimatedAttendance: string;
  environment: string;
  environmentNotes: string;
  clientIdentifiedRisks: string;
  riskLevel: string;
  threatTypes: string[];
  successCriteria: string[];
  additionalNotes: string;
}

const VENUE_TYPES = ["Arena/Stadium", "Convention Center", "Corporate Office", "Nightclub/Bar", "Outdoor Festival", "Private Residence", "Religious Facility", "Restaurant", "Retail", "School/Campus"];
const THREAT_TYPES = ["Active Threat", "Civil Unrest", "Crowd Control", "Cyber", "Fire/Hazmat", "Medical", "Natural Disaster", "Protest", "Theft/Burglary", "VIP/Executive"];
const SUCCESS_CRITERIA = ["Zero safety incidents", "Client satisfaction", "Regulatory compliance", "Rapid incident response", "Smooth guest experience", "Staff professionalism"];

const EMPTY_DATA: ClientIntakeData = {
  clientName: "", clientEmail: "", clientRequest: "", timeSensitivity: "Medium",
  venueType: [], estimatedAttendance: "", environment: "Indoor", environmentNotes: "",
  clientIdentifiedRisks: "", riskLevel: "Moderate", threatTypes: [], successCriteria: [],
  additionalNotes: "",
};

export default function PublicIntakePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [share, setShare] = useState<Awaited<ReturnType<typeof lookupIntakeShare>>>(null);
  const [data, setData] = useState<ClientIntakeData>(EMPTY_DATA);

  useEffect(() => {
    if (!token) return;
    lookupIntakeShare(token).then((result) => {
      if (!result) { setError("This intake link is invalid or has expired."); }
      else if (result.share.submitted_at) { setSubmitted(true); }
      setShare(result);
      setLoading(false);
    }).catch(() => { setError("Failed to load intake form."); setLoading(false); });
  }, [token]);

  function update<K extends keyof ClientIntakeData>(field: K, value: ClientIntakeData[K]) {
    setData((prev) => ({ ...prev, [field]: value }));
  }

  function toggleChip(field: "venueType" | "threatTypes" | "successCriteria", value: string) {
    setData((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((v) => v !== value) : [...prev[field], value],
    }));
  }

  async function handleSubmit() {
    if (!data.clientName.trim() || !data.clientEmail.trim()) return;
    if (!share) return;
    setSubmitting(true);

    try {
      // Save as a draft intake document with source: "client"
      const supabase = createClient();
      await supabase.from("operation_documents").insert({
        event_id: share.share.event_id,
        company_id: share.share.company_id,
        doc_type: "intake",
        version: 1,
        status: "draft",
        data: {
          ...data,
          _source: "client",
          _submitted_at: new Date().toISOString(),
          engagementType: [],
          missionStatement: "",
          servicesRequested: [],
          deliverables: "",
          outOfScope: "",
          medicalCapability: "",
          equipmentAvailable: "",
          commandModel: "",
          escalationFlow: "",
          eaRole: [],
          constraints: [],
        },
      });

      // Mark the share as submitted
      await markShareSubmitted(token, data.clientName, data.clientEmail);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <Shield className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-lg font-semibold mb-2">Link Not Found</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">{error || "This intake link is invalid."}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Thank You!</h1>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Your information has been submitted for <strong>{share.event.name}</strong>.
          The {share.company.name} team will review it and be in touch.
        </p>
      </div>
    );
  }

  const brandColor = share.company.brand_color || "#d59b3c";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/30 px-6 py-4" style={{ borderTopWidth: 4, borderTopColor: brandColor }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {share.company.logo_url && (
            <Image src={share.company.logo_url} alt="" width={40} height={40} className="rounded-lg" />
          )}
          <div>
            <h1 className="text-lg font-bold">{share.company.name}</h1>
            <p className="text-xs text-muted-foreground">Client Intake — {share.event.name}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {/* Contact Info (Required) */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: brandColor }} /> Your Information
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Your full name *" value={data.clientName} onChange={(e) => update("clientName", e.target.value)} />
            <Input placeholder="Email address *" type="email" value={data.clientEmail} onChange={(e) => update("clientEmail", e.target.value)} />
          </div>
        </section>

        {/* Mission Overview */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: brandColor }} /> What do you need?
          </h2>
          <textarea
            className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1"
            style={{ focusRingColor: brandColor } as React.CSSProperties}
            placeholder="Describe your security needs, event details, or concerns..."
            value={data.clientRequest}
            onChange={(e) => update("clientRequest", e.target.value)}
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Time Sensitivity</label>
            <div className="flex gap-2">
              {["Low", "Medium", "High", "Immediate"].map((t) => (
                <button key={t} onClick={() => update("timeSensitivity", t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    data.timeSensitivity === t
                      ? "text-white border-transparent"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                  style={data.timeSensitivity === t ? { backgroundColor: brandColor } : {}}
                >{t}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Location & Environment */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" style={{ color: brandColor }} /> Location & Environment
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estimated Attendance</label>
              <Input placeholder="e.g., 500" value={data.estimatedAttendance} onChange={(e) => update("estimatedAttendance", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Environment</label>
              <div className="flex gap-2">
                {["Indoor", "Outdoor", "Hybrid"].map((e) => (
                  <button key={e} onClick={() => update("environment", e)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      data.environment === e ? "text-white border-transparent" : "border-border text-muted-foreground"
                    }`}
                    style={data.environment === e ? { backgroundColor: brandColor } : {}}
                  >{e}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Venue Type</label>
            <div className="flex flex-wrap gap-1.5">
              {VENUE_TYPES.map((v) => (
                <button key={v} onClick={() => toggleChip("venueType", v)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    data.venueType.includes(v) ? "text-white border-transparent" : "border-border text-muted-foreground"
                  }`}
                  style={data.venueType.includes(v) ? { backgroundColor: brandColor } : {}}
                >{v}</button>
              ))}
            </div>
          </div>
          <textarea
            className="w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none"
            placeholder="Additional environment notes (parking, access points, special considerations)..."
            value={data.environmentNotes}
            onChange={(e) => update("environmentNotes", e.target.value)}
          />
        </section>

        {/* Risks */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: brandColor }} /> Risk & Concerns
          </h2>
          <textarea
            className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none"
            placeholder="Any known risks, threats, or concerns we should be aware of..."
            value={data.clientIdentifiedRisks}
            onChange={(e) => update("clientIdentifiedRisks", e.target.value)}
          />
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Perceived Risk Level</label>
            <div className="flex gap-2">
              {["Low", "Moderate", "High", "Critical"].map((r) => (
                <button key={r} onClick={() => update("riskLevel", r)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    data.riskLevel === r ? "text-white border-transparent" : "border-border text-muted-foreground"
                  }`}
                  style={data.riskLevel === r ? { backgroundColor: r === "Critical" ? "#ef4444" : r === "High" ? "#f59e0b" : brandColor } : {}}
                >{r}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Potential Threat Types</label>
            <div className="flex flex-wrap gap-1.5">
              {THREAT_TYPES.map((t) => (
                <button key={t} onClick={() => toggleChip("threatTypes", t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    data.threatTypes.includes(t) ? "text-white border-transparent" : "border-border text-muted-foreground"
                  }`}
                  style={data.threatTypes.includes(t) ? { backgroundColor: brandColor } : {}}
                >{t}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Success Criteria */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" style={{ color: brandColor }} /> What does success look like?
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {SUCCESS_CRITERIA.map((c) => (
              <button key={c} onClick={() => toggleChip("successCriteria", c)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  data.successCriteria.includes(c) ? "text-white border-transparent" : "border-border text-muted-foreground"
                }`}
                style={data.successCriteria.includes(c) ? { backgroundColor: brandColor } : {}}
              >{c}</button>
            ))}
          </div>
          <textarea
            className="w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none"
            placeholder="Anything else you'd like us to know..."
            value={data.additionalNotes}
            onChange={(e) => update("additionalNotes", e.target.value)}
          />
        </section>

        {/* Submit */}
        <div className="pt-4 border-t border-border/30">
          <Button
            onClick={handleSubmit}
            disabled={!data.clientName.trim() || !data.clientEmail.trim() || submitting}
            className="w-full h-11 text-sm font-semibold"
            style={{ backgroundColor: brandColor }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit Information
          </Button>
          <p className="text-[10px] text-muted-foreground text-center mt-3">
            Your information will be shared with {share.company.name} for the purpose of planning security services.
            By submitting, you consent to this data being used for operational planning.
          </p>
        </div>
      </div>
    </div>
  );
}
