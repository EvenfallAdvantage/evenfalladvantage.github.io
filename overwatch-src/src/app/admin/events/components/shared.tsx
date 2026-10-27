/* ── Shared types, constants, and helpers for events admin ── */

export interface Event {
  id: string;
  name: string;
  company_id: string;
  status: string;
  start_date: string;
  end_date: string;
  location?: string;
  client_name?: string;
  timezone?: string;
  bill_rate?: number | null;
  post_orders?: string | null;
  site_map_url?: string | null;
  geofence_radius_meters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  settings?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown; // Allow additional Supabase columns
}

export interface Shift {
  id: string;
  event_id: string;
  date?: string;
  start_time: string;
  end_time: string;
  role?: string;
  assigned_user_id?: string | null;
  post_orders?: string | null;
  users?: { id: string; first_name: string; last_name: string; callsign?: string | null; email?: string } | null;
  events?: { name: string; timezone?: string } | null;
  [key: string]: unknown;
}

export interface Member {
  id?: string;
  user_id: string;
  role: string;
  status?: string;
  nickname?: string | null;
  pay_rate_override?: number | null;
  users?: { id: string; first_name: string; last_name: string; callsign?: string | null; email?: string; phone?: string | null; avatar_url?: string | null } | null;
  [key: string]: unknown;
}

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

import { parseUTC } from "@/lib/parse-utc";
import { formatInTimezone, localToUTC, utcToLocalInput, resolveTimezone } from "@/lib/timezone";

export function fmtTime(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { hour: "2-digit", minute: "2-digit" });
  }
  return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function fmtDateShort(iso: string) {
  if (!iso) return "";
  const m = /^(\d{4}-\d{2}-\d{2})$/.exec(iso.trim());
  if (m) {
    return new Date(`${m[1]}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  }
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
export function fmtDateLong(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function extractDateOnly(val: string, timezone?: string): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  const hasExplicitTz = /[T ]\\d{2}:\\d{2}/.test(trimmed) && /(?:Z|[+-]\\d{2}:?\\d{2})$/i.test(trimmed);
  if (hasExplicitTz) {
    return utcToLocalInput(trimmed, resolveTimezone(timezone)).slice(0, 10);
  }
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (m) return m[1];
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getDaysInRange(start: string, end: string, timezone?: string): string[] {
  const sDay = extractDateOnly(start, timezone);
  const eDay = extractDateOnly(end, timezone);
  if (!sDay || !eDay) return [];
  const days: string[] = [];
  const cur = new Date(`${sDay}T12:00:00Z`);
  const endDt = new Date(`${eDay}T12:00:00Z`);
  while (cur <= endDt) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export interface ShiftPeriod {
  label: string;
  sH: number;
  sM: number;
  eH: number;
  eM: number;
  overnight: boolean;
}

export const PATTERNS: Record<string, ShiftPeriod[]> = {
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

/** Compute overnight flag: end time is strictly less-or-equal to start time. */
export function isOvernight(sH: number, sM: number, eH: number, eM: number): boolean {
  return eH * 60 + eM <= sH * 60 + sM;
}

/** Parse "HH:MM" → { h, m }. Returns null on invalid. */
export function parseHHMM(value: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function toISO(dateStr: string, h: number, m: number, nextDay: boolean, timezone?: string) {
  if (timezone) {
    // Build a local datetime string and convert using the event timezone
    let day = dateStr; // "YYYY-MM-DD"
    if (nextDay) {
      const d = new Date(dateStr + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 1);
      day = d.toISOString().slice(0, 10);
    }
    const local = `${day}T${pad2(h)}:${pad2(m)}`;
    return localToUTC(local, timezone);
  }
  // Legacy fallback: browser-local interpretation
  const d = new Date(dateStr + "T00:00:00");
  if (nextDay) d.setDate(d.getDate() + 1);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Convert a UTC ISO timestamp (with or without trailing Z) to its YYYY-MM-DD
 * calendar date in the given IANA timezone (falling back to browser timezone).
 */
export function shiftDayInTz(iso: string, timezone?: string): string {
  const tz = resolveTimezone(timezone);
  return utcToLocalInput(iso, tz).slice(0, 10);
}

export function groupByDay(shifts: Shift[], timezone?: string): Map<string, Shift[]> {
  const m = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const day = shiftDayInTz(sh.start_time, timezone ?? sh.events?.timezone);
    if (!m.has(day)) m.set(day, []);
    m.get(day)!.push(sh);
  }
  return m;
}

export function pad2(n: number) { return String(n).padStart(2, "0"); }

/* ── Textarea helper ───────────────────────────────── */

export function Textarea({ id, value, onChange, placeholder, rows = 3 }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y" />
  );
}
