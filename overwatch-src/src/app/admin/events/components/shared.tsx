/* ── Shared types, constants, and helpers for events admin ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Event = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Member = any;

/* ── OPs Guide Type ──────────────────────────────────── */

export type OpsGuide = {
  clientName: string;
  clientContact: string;
  clientPhone: string;
  clientEmail: string;
  siteAddress: string;
  siteType: string;
  scope: string;
  postOrders: string;
  dressCode: string;
  requiredGear: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyProcedure: string;
  communicationChannel: string;
  reportingInstructions: string;
  specialInstructions: string;
  parkingInfo: string;
  checkInProcedure: string;
};

export const EMPTY_GUIDE: OpsGuide = {
  clientName: "", clientContact: "", clientPhone: "", clientEmail: "",
  siteAddress: "", siteType: "", scope: "", postOrders: "",
  dressCode: "", requiredGear: "",
  emergencyContact: "", emergencyPhone: "", emergencyProcedure: "",
  communicationChannel: "", reportingInstructions: "",
  specialInstructions: "", parkingInfo: "", checkInProcedure: "",
};

export const SITE_TYPES = ["Corporate", "Retail", "Warehouse", "Residential", "Construction", "Event/Festival", "Government", "Healthcare", "Education", "Other"];
export const DRESS_CODES = ["Full Uniform (Company branded)", "Business Casual", "All Black", "Suit & Tie", "Tactical / BDU", "Client-Provided Uniform", "Plain Clothes", "Other"];

export const ENGAGEMENT_TYPES = ["Event Security", "Executive Protection", "Consulting / Assessment", "Recurring Contract", "Loss Prevention", "Training", "Other"];
export const VENUE_TYPES = ["Bar / Nightclub", "Festival / Outdoor Event", "Corporate / Office", "Private Property", "Mixed-Use", "Warehouse / Industrial", "Retail", "Other"];
export const THREAT_TYPES = ["Crowd Surge", "Disorderly Conduct / Fights", "Medical Emergencies", "Unauthorized Access", "Theft", "Environmental (weather, terrain)", "Other"];
export const SERVICES_REQUESTED = ["Access Control", "Crowd Management", "Patrol", "Executive Protection", "Risk Assessment", "Training", "Consulting", "Event Security", "Other"];
export const CONSTRAINT_TYPES = ["Budget", "Staffing", "Legal / Licensing", "Venue Restrictions", "Time"];
export const MEDICAL_CAPABILITIES = ["None", "Basic First Aid", "STOP THE BLEED®", "EMS On-site"];
export const COMMAND_MODELS = ["Single Supervisor", "Tiered Leadership", "ICS-Aligned"];
export const COMPANY_ROLES = ["Advisory", "Planning", "Operational Support", "Training"];
export const SUCCESS_CRITERIA_OPTIONS = ["No major incidents", "Controlled crowd flow", "Effective incident response", "Clear communication maintained", "Client satisfaction"];

/* ── Helpers ───────────────────────────────────────────── */

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
export function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
export function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const cur = new Date(s);
  while (cur <= e) { days.push(cur.toISOString().split("T")[0]); cur.setDate(cur.getDate() + 1); }
  return days;
}

export const PATTERNS: Record<string, { label: string; sH: number; sM: number; eH: number; eM: number; overnight: boolean }[]> = {
  "8": [
    { label: "Day",   sH: 6,  sM: 0, eH: 14, eM: 0, overnight: false },
    { label: "Swing", sH: 14, sM: 0, eH: 22, eM: 0, overnight: false },
    { label: "Night", sH: 22, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
  "12": [
    { label: "Day",   sH: 6,  sM: 0, eH: 18, eM: 0, overnight: false },
    { label: "Night", sH: 18, sM: 0, eH: 6,  eM: 0, overnight: true },
  ],
};

export function toISO(dateStr: string, h: number, m: number, nextDay: boolean) {
  const d = new Date(dateStr + "T00:00:00");
  if (nextDay) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function groupByDay(shifts: Shift[]): Map<string, Shift[]> {
  const m = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const day = new Date(sh.start_time).toISOString().split("T")[0];
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(sh);
  }
  return m;
}

export function pad2(n: number) { return String(n).padStart(2, "0"); }

/* ── Textarea helper ───────────────────────────────── */

export function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
  );
}
