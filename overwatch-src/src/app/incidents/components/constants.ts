import {
  AlertTriangle,
  Shield,
  Flame,
  CircleDot,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Incident = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IncidentUpdate = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Member = any;

export const SEVERITY = [
  { value: "critical", label: "Critical", color: "bg-red-600 text-white", icon: Flame },
  { value: "high", label: "High", color: "bg-orange-500 text-white", icon: AlertTriangle },
  { value: "medium", label: "Medium", color: "bg-amber-500 text-white", icon: Shield },
  { value: "low", label: "Low", color: "bg-blue-500 text-white", icon: CircleDot },
];

export const STATUS = [
  { value: "open", label: "Open", color: "bg-red-500/15 text-red-600" },
  { value: "investigating", label: "Investigating", color: "bg-amber-500/15 text-amber-600" },
  { value: "resolved", label: "Resolved", color: "bg-green-500/15 text-green-600" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
];

export const TYPES = [
  "general", "trespass", "theft", "vandalism", "assault",
  "suspicious_activity", "medical", "fire", "alarm",
  "access_control", "policy_violation", "workplace_violence",
  "drug_alcohol", "harassment", "missing_person", "vehicle_incident",
  "water_leak", "power_outage", "elevator_entrapment", "slip_trip_fall", "other",
];

export const WEATHER_OPTIONS = ["Clear", "Cloudy", "Rain", "Snow", "Fog", "Windy", "Extreme Heat", "Extreme Cold", "N/A — Indoors"];
export const LIGHTING_OPTIONS = ["Well-lit", "Dim / Partial", "Dark / No Lighting", "Strobe / Flickering", "Natural Daylight"];
export const SERVICES_OPTIONS = ["Police / Law Enforcement", "Fire Department", "EMS / Ambulance", "Building Maintenance", "Management / Supervisor", "K-9 Unit", "None"];
export const EVIDENCE_OPTIONS = ["Photographs Taken", "Video / CCTV Captured", "Witness Statements", "Physical Evidence Collected", "Body-Cam Footage", "Audio Recording", "None"];
export const ACTIONS_OPTIONS = ["Area Secured / Cordoned Off", "First Aid Administered", "Suspect Detained", "Suspect Trespassed / Issued CTW", "Verbal Warning Issued", "Escorted Individual Off Property", "Locked / Secured Access Point", "Filed Police Report", "Notified Management", "Completed Incident Log", "Monitored via CCTV", "De-escalation Techniques Used"];
export const INJURY_TYPES = ["None", "Minor — No Medical Needed", "Moderate — First Aid Given", "Serious — EMS Called", "Fatal"];
export const PROPERTY_DAMAGE = ["None", "Minor (< $500)", "Moderate ($500–$5,000)", "Major (> $5,000)", "Unknown"];

export const sevInfo = (sev: string) => SEVERITY.find(s => s.value === sev) ?? SEVERITY[3];
export const statInfo = (st: string) => STATUS.find(s => s.value === st) ?? STATUS[0];
