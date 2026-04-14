"use client";

import {
  Radio,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  AlertTriangle,
  Footprints,
  FileText,
  MapPin,
  Shield,
  MessageCircle,
  Scale,
  Award,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Post = any;

export type Metrics = {
  activePersonnel: number;
  openIncidents: number;
  todayPatrols: number;
  pendingReports: number;
  totalStaff: number;
  upcomingShifts: number;
};

export type OwnerIntel = {
  pipeline: { new: number; interview: number; hired: number; rejected: number; total: number };
  approvals: { timeCorrections: number; leaveRequests: number; formReviews: number; timesheets: number; total: number };
  integrationHealth: { active: number; configured: number; providers: { provider: string; active: boolean }[] };
  onboarding: { id: string; name: string; complete: boolean; hireDate: string }[];
  payroll: { approvedHours: number; totalHours: number; unapprovedHours: number; readyPct: number };
  notificationsSent: number;
};

export type CompanyStats = {
  memberCount: number;
  eventCount: number;
  assetCount: number;
  formCount: number;
  totalHoursLogged: number;
};

export type IntelData = {
  weeklyHours: number[];
  weeklyIncidents: number[];
  dayLabels: string[];
  personnel: { onDuty: number; offDuty: number; onLeave: number; total: number };
  activity: { patrols: number; training: number; shifts: number };
};

export function formatDuration(ms: number) {
  const abs = Math.max(0, ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox="0 0 100 40" className="w-full h-10">
      {data.map((v, i) => {
        const h = (v / max) * 36;
        return (
          <rect key={i} x={i * barW + 1} y={40 - h} width={barW - 2} height={h}
            rx={1.5} fill={color} opacity={0.15 + (i / data.length) * 0.85} />
        );
      })}
    </svg>
  );
}

export function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<{ pct: number; offset: number; color: string }[]>((acc, seg) => {
    const cum = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ pct: (seg.value / total) * circumference, offset: cum, color: seg.color });
    return acc;
  }, []);
  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-border/20" />
        {arcs.map((arc, i) => (
          <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={arc.color} strokeWidth="12"
            strokeDasharray={`${arc.pct} ${circumference}`}
            strokeDashoffset={-arc.offset} strokeLinecap="round" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-lg font-bold font-mono">{total}</p>
        <p className="text-[8px] text-muted-foreground">TOTAL</p>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono font-medium text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

export function hireDaysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export const PROVIDER_LABELS: Record<string, string> = {
  email: "Email", whatsapp: "WhatsApp", twilio: "SMS/Twilio", onesignal: "Push",
  checkr: "Checkr", docusign: "DocuSign", gusto: "Gusto", airtable: "Airtable",
};

export const QUICK_ACTIONS = [
  { title: "Comms", href: "/chat", icon: Radio, color: "text-blue-500", bg: "bg-blue-500/10" },
  { title: "Incidents", href: "/incidents", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  { title: "Patrols", href: "/patrols", icon: Footprints, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { title: "Deployments", href: "/schedule", icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-500/10" },
  { title: "Reports", href: "/forms", icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
  { title: "Training", href: "/academy", icon: GraduationCap, color: "text-violet-500", bg: "bg-violet-500/10" },
];

export const TOOLS_GRID = [
  { title: "Geo-Risk", href: "/geo-risk", icon: MapPin, color: "text-cyan-500", bg: "bg-cyan-500/10", desc: "Location risk intel" },
  { title: "Site Assessment", href: "/site-assessment", icon: Shield, color: "text-teal-500", bg: "bg-teal-500/10", desc: "Security evaluations" },
  { title: "Academy", href: "/academy", icon: GraduationCap, color: "text-indigo-500", bg: "bg-indigo-500/10", desc: "Courses & certs" },
  { title: "Scenarios", href: "/training/scenarios", icon: MessageCircle, color: "text-orange-500", bg: "bg-orange-500/10", desc: "De-escalation sims" },
  { title: "State Laws", href: "/state-laws", icon: Scale, color: "text-slate-400", bg: "bg-slate-400/10", desc: "50-state database" },
  { title: "Invoices", href: "/invoices", icon: FileText, color: "text-lime-500", bg: "bg-lime-500/10", desc: "Generate invoices" },
  { title: "Certifications", href: "/certifications", icon: Award, color: "text-yellow-500", bg: "bg-yellow-500/10", desc: "Manage certs" },
];
