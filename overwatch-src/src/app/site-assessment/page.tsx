"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Shield, Building2, DoorOpen, Video, AlertTriangle, Users,
  BarChart3, Save, FileDown, RotateCcw, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, AlertCircle, Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";

/* ── Types ──────────────────────────────────────────────── */

type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  tooltip?: string;
};

type SectionDef = {
  id: string;
  title: string;
  icon: React.ReactNode;
  tooltip: string;
  fields: FieldDef[];
};

type Recommendation = {
  issue: string;
  recommendation: string;
  priority: 1 | 2 | 3;
  timeline: string;
  responsibility: string;
};

type RiskResult = {
  score: number;
  level: string;
  color: string;
  recommendations: Recommendation[];
};

/* ── Risk Matrix ────────────────────────────────────────── */

const LIKELIHOOD: Record<string, { weight: number }> = {
  Rare: { weight: 0.15 }, Unlikely: { weight: 0.30 }, Possible: { weight: 0.50 },
  Likely: { weight: 0.70 }, Certain: { weight: 0.90 },
};
const IMPACT: Record<string, { weight: number }> = {
  Negligible: { weight: 0.10 }, Minor: { weight: 0.25 }, Moderate: { weight: 0.50 },
  Major: { weight: 0.75 }, Catastrophic: { weight: 1.00 },
};
const VULNERABILITY: Record<string, { multiplier: number }> = {
  Minimal: { multiplier: 0.8 }, Low: { multiplier: 1.0 }, Moderate: { multiplier: 1.3 },
  High: { multiplier: 1.6 }, Critical: { multiplier: 2.0 },
};
const RESILIENCE: Record<string, { factor: number }> = {
  Excellent: { factor: 0.7 }, Good: { factor: 0.85 }, Fair: { factor: 1.0 },
  Poor: { factor: 1.2 }, None: { factor: 1.5 },
};

function calculateRisk(data: Record<string, string>): RiskResult {
  const lk = LIKELIHOOD[data.threatLikelihood] ?? LIKELIHOOD.Possible;
  const im = IMPACT[data.potentialImpact] ?? IMPACT.Moderate;
  const vl = VULNERABILITY[data.overallVulnerability] ?? VULNERABILITY.Moderate;
  const rs = RESILIENCE[data.resilienceLevel] ?? RESILIENCE.Fair;

  const base = (lk.weight * 100) * (im.weight * 100) * vl.multiplier;
  const adjusted = (base / 10000) * rs.factor;
  const score = Math.min(100, adjusted * 20);

  let level = "Low", color = "#22c55e";
  if (score >= 75) { level = "Critical"; color = "#ef4444"; }
  else if (score >= 50) { level = "High"; color = "#f97316"; }
  else if (score >= 25) { level = "Moderate"; color = "#eab308"; }

  const recommendations = generateRecommendations(data);
  return { score: Math.round(score * 10) / 10, level, color, recommendations };
}

/* ── Recommendations Engine ─────────────────────────────── */

function generateRecommendations(data: Record<string, string>): Recommendation[] {
  const recs: Recommendation[] = [];
  const ft = data.facilityType || "Office Building";
  const resp = ft === "Single-family Home" ? "Homeowner" : ft === "Religious Facility" ? "Leadership" : "Management";

  if (data.doorType && data.doorType !== "Solid-core/Metal") {
    recs.push({ issue: "Weak door construction", recommendation: `Replace ${data.doorType.toLowerCase()} doors with solid-core or metal doors`, priority: 1, timeline: "1-3 months", responsibility: resp });
  }
  if (data.interiorLocks && data.interiorLocks !== "Yes - all rooms") {
    recs.push({ issue: "Insufficient interior locking", recommendation: "Install locks on all interior rooms and occupied spaces", priority: 1, timeline: "1-2 months", responsibility: resp });
  }
  if (data.perimeterBarriers && (data.perimeterBarriers === "Minimal barriers" || data.perimeterBarriers === "None")) {
    recs.push({ issue: "Insufficient perimeter security", recommendation: "Install layered deterrent barriers at entry points", priority: 1, timeline: "1-2 months", responsibility: resp });
  }
  if (data.visitorManagement && (data.visitorManagement === "Sign-in only" || data.visitorManagement === "None")) {
    recs.push({ issue: "Weak visitor management", recommendation: "Implement digital visitor management with ID verification", priority: 1, timeline: "2-4 months", responsibility: resp });
  }
  if (data.alarmSystem && !["Intercom-based with full coverage", "PA system with full coverage"].includes(data.alarmSystem)) {
    recs.push({ issue: "Emergency alarm system inadequate", recommendation: "Install intercom-based alarm system with full facility coverage", priority: 1, timeline: "Immediate", responsibility: resp });
  }
  if (data.cameraCoverage && !["Comprehensive - all critical areas", "Good - most areas covered"].includes(data.cameraCoverage)) {
    recs.push({ issue: "Surveillance coverage gaps", recommendation: "Expand camera coverage to all entry points and critical areas", priority: 2, timeline: "3-6 months", responsibility: resp });
  }
  if (data.liveMonitoring && (data.liveMonitoring === "Occasional monitoring" || data.liveMonitoring === "Recording only - no monitoring")) {
    recs.push({ issue: "No live monitoring capability", recommendation: "Establish live monitoring during operating hours at minimum", priority: 2, timeline: "3-6 months", responsibility: resp });
  }
  if (data.crisisTeam && data.crisisTeam !== "Formalized team with defined roles") {
    recs.push({ issue: "No formalized crisis response team", recommendation: "Establish crisis response team with defined roles and procedures", priority: 2, timeline: "3 months", responsibility: resp });
  }
  if (data.emergencyPlans && !["Comprehensive written plans with regular updates"].includes(data.emergencyPlans)) {
    recs.push({ issue: "Emergency plans need improvement", recommendation: "Develop comprehensive written emergency response plans with regular updates", priority: 2, timeline: "2-3 months", responsibility: resp });
  }
  if (data.staffTraining && (data.staffTraining === "Minimal training" || data.staffTraining === "None")) {
    recs.push({ issue: "Insufficient security training", recommendation: "Implement comprehensive annual security training for all staff", priority: 3, timeline: "Ongoing", responsibility: resp });
  }
  if (data.drillFrequency && (data.drillFrequency === "Rarely" || data.drillFrequency === "Never")) {
    recs.push({ issue: "Emergency drills insufficient", recommendation: "Conduct quarterly emergency drills for all occupants", priority: 3, timeline: "Ongoing", responsibility: resp });
  }
  if (data.securityCulture && (data.securityCulture === "Fair - security is acknowledged" || data.securityCulture === "Weak - security is afterthought")) {
    recs.push({ issue: "Security culture needs strengthening", recommendation: "Establish security awareness program and regular communications", priority: 3, timeline: "Ongoing", responsibility: resp });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

/* ── Form Sections ──────────────────────────────────────── */

const SECTIONS: SectionDef[] = [
  {
    id: "clientInfo", title: "Client Information", icon: <Building2 className="h-4 w-4" />,
    tooltip: "Basic information about the facility being assessed.",
    fields: [
      { name: "clientName", label: "Client/Facility Name", type: "text", required: true, placeholder: "e.g., Antioch Christian Academy" },
      { name: "facilityType", label: "Facility Type", type: "select", required: true, options: ["School", "Office Building", "Venue/Event Space", "Religious Facility", "Healthcare", "Retail", "Single-family Home", "Multi-family Complex", "Other"] },
      { name: "address", label: "Address", type: "text", placeholder: "Street Address" },
      { name: "city", label: "City", type: "text", required: true },
      { name: "state", label: "State", type: "text", required: true },
      { name: "assessmentDate", label: "Assessment Date", type: "date", required: true },
      { name: "assessorName", label: "Assessor Name", type: "text", required: true },
      { name: "assessorTitle", label: "Assessor Title", type: "text", placeholder: "e.g., Security Consultant" },
    ],
  },
  {
    id: "physicalSecurity", title: "Physical Security", icon: <Shield className="h-4 w-4" />,
    tooltip: "Evaluate physical barriers and hardening measures.",
    fields: [
      { name: "doorType", label: "Primary Door Construction", type: "select", options: ["Solid-core/Metal", "Hollow-core", "Glass", "Mixed", "Unknown"], tooltip: "Hollow-core and glass doors provide minimal protection." },
      { name: "doorVisibility", label: "Door Window Visibility", type: "select", options: ["No windows", "High windows only", "Windows at handle height", "Full glass"] },
      { name: "interiorLocks", label: "Interior Locking Capability", type: "select", options: ["Yes - all rooms", "Partial coverage", "No interior locks", "Unknown"] },
      { name: "perimeterBarriers", label: "Perimeter Barriers", type: "select", options: ["Comprehensive fencing/barriers", "Partial barriers", "Minimal barriers", "None"] },
      { name: "physicalNotes", label: "Additional Observations", type: "textarea", placeholder: "Document specific vulnerabilities, strengths, or unique conditions..." },
    ],
  },
  {
    id: "accessControl", title: "Access Control & Entry", icon: <DoorOpen className="h-4 w-4" />,
    tooltip: "Access control determines who can enter and when.",
    fields: [
      { name: "entryPoints", label: "Number of Entry Points", type: "number" },
      { name: "controlledEntries", label: "Controlled Entry Points", type: "number" },
      { name: "visitorManagement", label: "Visitor Management System", type: "select", options: ["Digital system with ID verification", "Manual sign-in with monitoring", "Sign-in only", "None"] },
      { name: "accessControlTech", label: "Access Control Technology", type: "select", options: ["Electronic access control (cards/fobs)", "Keypad/code entry", "Traditional keys only", "None"] },
      { name: "afterHoursAccess", label: "After-Hours Access Control", type: "select", options: ["Fully controlled and monitored", "Partially controlled", "Minimal control", "Open access"] },
      { name: "accessNotes", label: "Additional Observations", type: "textarea", placeholder: "Document access control procedures, gaps, or concerns..." },
    ],
  },
  {
    id: "surveillance", title: "Surveillance & Monitoring", icon: <Video className="h-4 w-4" />,
    tooltip: "Surveillance provides deterrence, detection, and evidence.",
    fields: [
      { name: "cameraCount", label: "Number of Cameras", type: "number" },
      { name: "cameraCoverage", label: "Camera Coverage", type: "select", options: ["Comprehensive - all critical areas", "Good - most areas covered", "Partial - significant gaps", "Minimal - limited coverage", "None"] },
      { name: "cameraQuality", label: "Camera Quality", type: "select", options: ["High-definition (1080p+)", "Standard definition", "Low quality", "Mixed quality", "Unknown"] },
      { name: "recordingRetention", label: "Recording Retention", type: "select", options: ["30+ days", "14-30 days", "7-14 days", "Less than 7 days", "No recording", "Unknown"] },
      { name: "liveMonitoring", label: "Live Monitoring", type: "select", options: ["24/7 dedicated monitoring", "Business hours monitoring", "Occasional monitoring", "Recording only - no monitoring"] },
      { name: "surveillanceNotes", label: "Additional Observations", type: "textarea", placeholder: "Note blind spots, camera placement issues..." },
    ],
  },
  {
    id: "emergency", title: "Emergency Management", icon: <AlertTriangle className="h-4 w-4" />,
    tooltip: "Emergency management systems and communication capabilities.",
    fields: [
      { name: "alarmSystem", label: "Emergency Alarm System", type: "select", options: ["Intercom-based with full coverage", "PA system with full coverage", "Limited alarm system", "Fire alarm only", "None"] },
      { name: "alarmAudibility", label: "Alarm Audibility", type: "select", options: ["100% coverage verified", "Most areas covered", "Inconsistent coverage", "Poor coverage", "Unknown"] },
      { name: "emergencyPlans", label: "Emergency Response Plans", type: "select", options: ["Comprehensive written plans with regular updates", "Written plans - not regularly updated", "Informal plans only", "No formal plans"] },
      { name: "drillFrequency", label: "Drill Frequency", type: "select", options: ["Monthly or more", "Quarterly", "Annually", "Rarely", "Never"] },
      { name: "emergencyNotes", label: "Additional Observations", type: "textarea", placeholder: "Document emergency procedures, drill observations..." },
    ],
  },
  {
    id: "training", title: "Training & Culture", icon: <Users className="h-4 w-4" />,
    tooltip: "Training creates a security-aware organizational culture.",
    fields: [
      { name: "crisisTeam", label: "Crisis Response Team", type: "select", options: ["Formalized team with defined roles", "Informal team", "Ad-hoc response only", "None"] },
      { name: "staffTraining", label: "Staff Security Training", type: "select", options: ["Comprehensive annual training", "Initial training only", "Minimal training", "None"] },
      { name: "newStaffOrientation", label: "New Staff Security Orientation", type: "select", options: ["Comprehensive security orientation", "Basic orientation", "Informal orientation", "None"] },
      { name: "securityCulture", label: "Overall Security Culture", type: "select", options: ["Strong - security is priority", "Good - security is valued", "Fair - security is acknowledged", "Weak - security is afterthought"] },
      { name: "trainingNotes", label: "Additional Observations", type: "textarea", placeholder: "Document training programs, staff awareness..." },
    ],
  },
  {
    id: "riskScoring", title: "Risk Assessment", icon: <BarChart3 className="h-4 w-4" />,
    tooltip: "Risk scoring combines likelihood, impact, vulnerability, and resilience.",
    fields: [
      { name: "threatLikelihood", label: "Threat Likelihood", type: "select", options: ["Rare", "Unlikely", "Possible", "Likely", "Certain"], tooltip: "Consider historical incidents and local crime data." },
      { name: "potentialImpact", label: "Potential Impact", type: "select", options: ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"], tooltip: "Life safety, property, operations, reputation." },
      { name: "overallVulnerability", label: "Overall Vulnerability", type: "select", options: ["Minimal", "Low", "Moderate", "High", "Critical"] },
      { name: "resilienceLevel", label: "Organizational Resilience", type: "select", options: ["Excellent", "Good", "Fair", "Poor", "None"] },
    ],
  },
];

const STORAGE_KEY = "overwatch_site_assessment";

/* ── Component ──────────────────────────────────────────── */

export default function SiteAssessmentPage() {
  const [data, setData] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    SECTIONS.forEach((s) => s.fields.forEach((f) => {
      defaults[f.name] = f.type === "date" ? new Date().toISOString().split("T")[0] : "";
    }));
    return defaults;
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["clientInfo"]));
  const [result, setResult] = useState<RiskResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData((prev) => ({ ...prev, ...parsed }));
        if (parsed.facilityType) {
          setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
        }
      }
    } catch {}
  }, []);

  // Save on change
  const save = useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);
  useEffect(() => { save(); }, [save]);

  function updateField(name: string, value: string) {
    setData((prev) => {
      const next = { ...prev, [name]: value };
      // Expand all sections once facility type is selected
      if (name === "facilityType" && value) {
        setExpandedSections(new Set(SECTIONS.map((s) => s.id)));
      }
      return next;
    });
    setResult(null); // Clear results when form changes
  }

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleCalculate() {
    const r = calculateRisk(data);
    setResult(r);
    // Scroll to results
    setTimeout(() => document.getElementById("risk-results")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function clearForm() {
    if (!confirm("Clear this assessment? All data will be lost.")) return;
    const defaults: Record<string, string> = {};
    SECTIONS.forEach((s) => s.fields.forEach((f) => {
      defaults[f.name] = f.type === "date" ? new Date().toISOString().split("T")[0] : "";
    }));
    setData(defaults);
    setResult(null);
    setExpandedSections(new Set(["clientInfo"]));
    localStorage.removeItem(STORAGE_KEY);
  }

  async function downloadPDF() {
    if (!reportRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = 210, margin = 10;
      const maxW = pdfW - margin * 2;
      let imgW = canvas.width * 0.264583 / 2;
      let imgH = canvas.height * 0.264583 / 2;
      if (imgW > maxW) { const r = maxW / imgW; imgW = maxW; imgH *= r; }

      // Multi-page support
      const pdfH = 297;
      const maxH = pdfH - margin * 2;
      const xOff = (pdfW - imgW) / 2;

      if (imgH <= maxH) {
        pdf.addImage(imgData, "PNG", xOff, margin, imgW, imgH);
      } else {
        let y = 0;
        let page = 0;
        while (y < imgH) {
          if (page > 0) pdf.addPage();
          const srcY = (y / imgH) * canvas.height;
          const srcH = Math.min((maxH / imgH) * canvas.height, canvas.height - srcY);
          const drawH = Math.min(maxH, imgH - y);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = srcH;
          sliceCanvas.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          const sliceData = sliceCanvas.toDataURL("image/png");
          pdf.addImage(sliceData, "PNG", xOff, margin, imgW, drawH);
          y += maxH;
          page++;
        }
      }

      const clientName = data.clientName || "Assessment";
      pdf.save(`Security_Assessment_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Error generating PDF.");
    } finally {
      setGenerating(false);
    }
  }

  const completedFields = Object.values(data).filter(Boolean).length;
  const totalFields = Object.keys(data).length;
  const completionPct = Math.round((completedFields / totalFields) * 100);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><Shield className="h-6 w-6" /> SITE SECURITY ASSESSMENT</h1>
            <p className="text-sm text-muted-foreground">Professional security evaluation and risk scoring</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-[10px] font-mono">{completionPct}% complete</Badge>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={clearForm}>
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${completionPct}%` }} />
        </div>

        {/* Form Sections */}
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const showSection = section.id === "clientInfo" || data.facilityType;

            if (!showSection) return null;

            return (
              <Card key={section.id} className="border-border/40">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span className="text-sm font-semibold">{section.title}</span>
                    <span className="text-[10px] text-muted-foreground">{section.tooltip}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 grid gap-3 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          {field.label}{field.required && <span className="text-red-500"> *</span>}
                        </label>
                        {field.type === "select" ? (
                          <select
                            value={data[field.name] || ""}
                            onChange={(e) => updateField(field.name, e.target.value)}
                            className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            value={data[field.name] || ""}
                            onChange={(e) => updateField(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px] resize-y"
                          />
                        ) : (
                          <Input
                            type={field.type}
                            value={data[field.name] || ""}
                            onChange={(e) => updateField(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className="h-8 text-sm"
                          />
                        )}
                        {field.tooltip && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{field.tooltip}</p>}
                      </div>
                    ))}

                    {/* Calculate button in risk section */}
                    {section.id === "riskScoring" && (
                      <div className="sm:col-span-2 pt-2">
                        <Button className="w-full gap-2" onClick={handleCalculate}>
                          <BarChart3 className="h-4 w-4" /> Calculate Risk Score & Generate Report
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Risk Results */}
        {result && (
          <div id="risk-results" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-mono">ASSESSMENT RESULTS</h2>
              <Button size="sm" className="gap-1.5" onClick={downloadPDF} disabled={generating}>
                {generating ? <Save className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                Download PDF Report
              </Button>
            </div>

            {/* Report for PDF */}
            <div ref={reportRef} className="bg-white text-black rounded-xl overflow-hidden" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
              {/* Report Header */}
              <div className="bg-gray-900 text-white p-8">
                <h1 className="text-2xl font-bold tracking-tight">SITE SECURITY ASSESSMENT REPORT</h1>
                <p className="text-gray-400 mt-1">{data.clientName || "Facility Assessment"}</p>
                <div className="flex gap-6 mt-4 text-sm text-gray-300">
                  {data.city && <span>{data.city}, {data.state}</span>}
                  {data.assessmentDate && <span>Date: {data.assessmentDate}</span>}
                  {data.assessorName && <span>Assessor: {data.assessorName}</span>}
                </div>
              </div>

              {/* Risk Score */}
              <div className="p-8 border-b border-gray-200">
                <div className="flex items-center gap-6">
                  <div className="relative h-28 w-28">
                    <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="60" cy="60" r="50" fill="none" stroke={result.color} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 50} strokeDashoffset={2 * Math.PI * 50 * (1 - result.score / 100)} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: result.color }}>{result.score}</span>
                      <span className="text-[10px] text-gray-500">/ 100</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl font-bold" style={{ color: result.color }}>{result.level} Risk</span>
                      {result.level === "Critical" && <AlertCircle className="h-5 w-5 text-red-500" />}
                      {result.level === "High" && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                      {result.level === "Moderate" && <Info className="h-5 w-5 text-yellow-600" />}
                      {result.level === "Low" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    </div>
                    <p className="text-sm text-gray-600">
                      {result.level === "Critical" ? "Immediate action required. Significant security vulnerabilities exist." :
                       result.level === "High" ? "Prompt attention needed. Multiple security gaps identified." :
                       result.level === "Moderate" ? "Some improvements recommended. Review priority items." :
                       "Security posture is adequate. Maintain current measures."}
                    </p>
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      <span>Threat: {data.threatLikelihood || "N/A"}</span>
                      <span>Impact: {data.potentialImpact || "N/A"}</span>
                      <span>Vulnerability: {data.overallVulnerability || "N/A"}</span>
                      <span>Resilience: {data.resilienceLevel || "N/A"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assessment Summary */}
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Assessment Summary</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Facility Type:</span> <span className="font-medium">{data.facilityType || "N/A"}</span></div>
                  <div><span className="text-gray-500">Address:</span> <span className="font-medium">{data.address || "N/A"}, {data.city} {data.state}</span></div>
                  <div><span className="text-gray-500">Entry Points:</span> <span className="font-medium">{data.entryPoints || "N/A"} total / {data.controlledEntries || "N/A"} controlled</span></div>
                  <div><span className="text-gray-500">Cameras:</span> <span className="font-medium">{data.cameraCount || "N/A"} — {data.cameraCoverage || "N/A"}</span></div>
                  <div><span className="text-gray-500">Door Construction:</span> <span className="font-medium">{data.doorType || "N/A"}</span></div>
                  <div><span className="text-gray-500">Access Control:</span> <span className="font-medium">{data.accessControlTech || "N/A"}</span></div>
                  <div><span className="text-gray-500">Emergency Plans:</span> <span className="font-medium">{data.emergencyPlans || "N/A"}</span></div>
                  <div><span className="text-gray-500">Staff Training:</span> <span className="font-medium">{data.staffTraining || "N/A"}</span></div>
                </div>
              </div>

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="p-8">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Recommendations ({result.recommendations.length})</h2>
                  {[1, 2, 3].map((priority) => {
                    const precs = result.recommendations.filter((r) => r.priority === priority);
                    if (precs.length === 0) return null;
                    const pLabel = priority === 1 ? "Critical Priority" : priority === 2 ? "High Priority" : "Standard Priority";
                    const pColor = priority === 1 ? "text-red-600" : priority === 2 ? "text-orange-600" : "text-blue-600";
                    const pBg = priority === 1 ? "bg-red-50 border-red-200" : priority === 2 ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200";
                    return (
                      <div key={priority} className="mb-6">
                        <h3 className={`text-sm font-bold ${pColor} mb-2 flex items-center gap-1`}>
                          {priority === 1 ? <XCircle className="h-4 w-4" /> : priority === 2 ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                          {pLabel}
                        </h3>
                        <div className="space-y-2">
                          {precs.map((rec, i) => (
                            <div key={i} className={`rounded-lg border p-3 ${pBg}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{rec.issue}</p>
                                  <p className="text-sm text-gray-600 mt-0.5">{rec.recommendation}</p>
                                </div>
                              </div>
                              <div className="flex gap-4 mt-2 text-[11px] text-gray-500">
                                <span>Timeline: {rec.timeline}</span>
                                <span>Responsibility: {rec.responsibility}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes Sections */}
              {(data.physicalNotes || data.accessNotes || data.surveillanceNotes || data.emergencyNotes || data.trainingNotes) && (
                <div className="p-8 border-t border-gray-200">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Field Observations</h2>
                  <div className="space-y-3 text-sm">
                    {data.physicalNotes && <div><span className="font-semibold text-gray-700">Physical Security:</span> <span className="text-gray-600">{data.physicalNotes}</span></div>}
                    {data.accessNotes && <div><span className="font-semibold text-gray-700">Access Control:</span> <span className="text-gray-600">{data.accessNotes}</span></div>}
                    {data.surveillanceNotes && <div><span className="font-semibold text-gray-700">Surveillance:</span> <span className="text-gray-600">{data.surveillanceNotes}</span></div>}
                    {data.emergencyNotes && <div><span className="font-semibold text-gray-700">Emergency Management:</span> <span className="text-gray-600">{data.emergencyNotes}</span></div>}
                    {data.trainingNotes && <div><span className="font-semibold text-gray-700">Training & Culture:</span> <span className="text-gray-600">{data.trainingNotes}</span></div>}
                  </div>
                </div>
              )}

              {/* Report Footer */}
              <div className="bg-gray-50 p-6 text-center text-xs text-gray-400 border-t border-gray-200">
                <p>This assessment was conducted by {data.assessorName || "Security Consultant"}{data.assessorTitle ? `, ${data.assessorTitle}` : ""}.</p>
                <p className="mt-1">Generated by Overwatch Security Platform &mdash; Evenfall Advantage LLC</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
