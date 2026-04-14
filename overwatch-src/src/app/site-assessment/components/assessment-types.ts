import {
  Shield, Building2, DoorOpen, Video, AlertTriangle, Users, BarChart3,
} from "lucide-react";
import { createElement } from "react";

/* ── Types ──────────────────────────────────────────────── */

export type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: string[];
  tooltip?: string;
};

export type SectionDef = {
  id: string;
  title: string;
  icon: React.ReactNode;
  tooltip: string;
  fields: FieldDef[];
};

export type Recommendation = {
  issue: string;
  recommendation: string;
  priority: 1 | 2 | 3;
  timeline: string;
  responsibility: string;
};

export type RiskResult = {
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

export function calculateRisk(data: Record<string, string>): RiskResult {
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

/* ── Form Sections ──────────────────────────────────────── */

export const SECTIONS: SectionDef[] = [
  {
    id: "clientInfo", title: "Client Information", icon: createElement(Building2, { className: "h-4 w-4" }),
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
    id: "physicalSecurity", title: "Physical Security", icon: createElement(Shield, { className: "h-4 w-4" }),
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
    id: "accessControl", title: "Access Control & Entry", icon: createElement(DoorOpen, { className: "h-4 w-4" }),
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
    id: "surveillance", title: "Surveillance & Monitoring", icon: createElement(Video, { className: "h-4 w-4" }),
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
    id: "emergency", title: "Emergency Management", icon: createElement(AlertTriangle, { className: "h-4 w-4" }),
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
    id: "training", title: "Training & Culture", icon: createElement(Users, { className: "h-4 w-4" }),
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
    id: "riskScoring", title: "Risk Assessment", icon: createElement(BarChart3, { className: "h-4 w-4" }),
    tooltip: "Risk scoring combines likelihood, impact, vulnerability, and resilience.",
    fields: [
      { name: "threatLikelihood", label: "Threat Likelihood", type: "select", options: ["Rare", "Unlikely", "Possible", "Likely", "Certain"], tooltip: "Consider historical incidents and local crime data." },
      { name: "potentialImpact", label: "Potential Impact", type: "select", options: ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"], tooltip: "Life safety, property, operations, reputation." },
      { name: "overallVulnerability", label: "Overall Vulnerability", type: "select", options: ["Minimal", "Low", "Moderate", "High", "Critical"] },
      { name: "resilienceLevel", label: "Organizational Resilience", type: "select", options: ["Excellent", "Good", "Fair", "Poor", "None"] },
    ],
  },
];

export const STORAGE_KEY = "overwatch_site_assessment";

export function getDefaultData(): Record<string, string> {
  const defaults: Record<string, string> = {};
  SECTIONS.forEach((s) => s.fields.forEach((f) => {
    defaults[f.name] = f.type === "date" ? new Date().toISOString().split("T")[0] : "";
  }));
  return defaults;
}
