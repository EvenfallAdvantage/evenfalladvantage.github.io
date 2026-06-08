"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users, Loader2,
  CalendarOff,
  UserPlus,
  BookOpenCheck, CalendarClock, FileEdit, FileText, Megaphone,
  CheckCircle2,
  UsersRound,
  QrCode,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getCompanyMembers, getCompanyDetails,
  getCompanyTimesheets, getAllTimeOffRequests,
  getAllFormSubmissions, getCompanyTimeChangeRequests,
  getApplicants, getIncidents,
} from "@/lib/supabase/db";
import { type HireResult } from "@/lib/services/hiring-orchestrator";
import { usePageHeader } from "@/stores/page-header-store";
import { OnboardingTab } from "./components/onboarding-tab";
import { CorrectionsTab } from "./components/corrections-tab";
import { LeaveTab } from "./components/leave-tab";
import { PostingsTab } from "./components/postings-tab";
import { TimesheetsTab } from "./components/timesheets-tab";
import { ReportsTab } from "./components/reports-tab";
import { ApplicantsTab } from "./components/applicants-tab";
import { RosterTab } from "./components/roster-tab";
import { TeamsTab } from "./components/teams-tab";
import { PublicReportsTab } from "./components/public-reports-tab";
import { GeofencesTab } from "./components/geofences-tab";
import { getCompanyPostings } from "@/lib/supabase/db-postings";
import { logger } from "@/lib/logger";

type Member = Record<string, unknown> & {
  id: string;
  role: string;
  users?: { id?: string };
};

type Tab = "roster" | "timesheets" | "leave" | "forms" | "applicants" | "onboarding" | "corrections" | "postings" | "teams" | "public-reports" | "geofences";

/* ── Badge count state (lightweight — only counts, no full records) ── */
interface TabCounts {
  pendingTimesheets: number;
  pendingLeave: number;
  pendingForms: number;
  openIncidents: number;
  pendingCorrections: number;
  newApplicants: number;
  activePostings: number;
}

const ZERO_COUNTS: TabCounts = {
  pendingTimesheets: 0, pendingLeave: 0, pendingForms: 0,
  openIncidents: 0, pendingCorrections: 0, newApplicants: 0, activePostings: 0,
};

export default function AdminStaffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const user = useAuthStore((s) => s.user);

  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("roster");
  const [hireResult, setHireResult] = useState<HireResult | null>(null);
  const [counts, setCounts] = useState<TabCounts>(ZERO_COUNTS);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    const tabIcons: Record<string, React.ReactNode> = {
      roster: <Users className="h-5 w-5" />,
      timesheets: <CalendarClock className="h-5 w-5" />,
      corrections: <FileEdit className="h-5 w-5" />,
      leave: <CalendarOff className="h-5 w-5" />,
      forms: <FileText className="h-5 w-5" />,
      postings: <Megaphone className="h-5 w-5" />,
      applicants: <UserPlus className="h-5 w-5" />,
      onboarding: <BookOpenCheck className="h-5 w-5" />,
      teams: <UsersRound className="h-5 w-5" />,
    };
    setHeader(
      "PERSONNEL",
      "Manage team members, timesheets, leave, and submissions",
      tabIcons[tab] ?? <Users className="h-5 w-5" />,
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, tab]);

  const myRole = user?.companies.find((c: { companyId: string }) => c.companyId === activeCompanyId)?.role ?? "staff";
  const canManageRoles = myRole === "owner" || myRole === "admin";
  const canManage = myRole === "owner" || myRole === "admin" || myRole === "manager";

  const load = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [m, company] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getCompanyDetails(activeCompanyId),
      ]);
      setMembers(m);
      setJoinCode(company?.join_code ?? "");
      setCompanyName(company?.name ?? "");

      // Load badge counts (non-blocking)
      Promise.all([
        getCompanyTimesheets(activeCompanyId).then(ts => ts.filter((t: { clock_out: string | null; approved: boolean }) => t.clock_out && !t.approved).length).catch(() => 0),
        getAllTimeOffRequests(activeCompanyId).then(r => r.filter((x: { status: string }) => x.status === "pending").length).catch(() => 0),
        getAllFormSubmissions(activeCompanyId).then(f => f.filter((x: { status: string }) => x.status !== "reviewed").length).catch(() => 0),
        getIncidents(activeCompanyId).then(i => i.filter((x: { status: string }) => x.status === "open" || x.status === "investigating").length).catch(() => 0),
        getCompanyTimeChangeRequests(activeCompanyId).then(r => r.filter((x: { status: string }) => x.status === "pending").length).catch(() => 0),
        getApplicants(activeCompanyId).then(a => a.filter((x: { status: string }) => x.status === "applied").length).catch(() => 0),
        getCompanyPostings(activeCompanyId).then(p => p.filter((x: { status: string }) => x.status === "active").length).catch(() => 0),
      ]).then(([pendingTimesheets, pendingLeave, pendingForms, openIncidents, pendingCorrections, newApplicants, activePostings]) => {
        setCounts({ pendingTimesheets, pendingLeave, pendingForms, openIncidents, pendingCorrections, newApplicants, activePostings });
      });
    } catch (e) { logger.swallow("staff-dashboard:load-counts", e, "warn"); } finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const userCompanies = (user?.companies ?? []).map((c: { companyId: string; companyLogo?: string | null; brandColor?: string | null }) => ({
    companyId: c.companyId,
    companyLogo: c.companyLogo ?? null,
    brandColor: c.brandColor ?? null,
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {hireResult && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Hire Integrations Triggered</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "email" as const, label: "Email", ok: hireResult.email.sent },
                { key: "whatsapp" as const, label: "WhatsApp", ok: hireResult.whatsapp.sent },
                { key: "checkr" as const, label: "Checkr", ok: hireResult.checkr.triggered },
                { key: "docusign" as const, label: "DocuSign", ok: hireResult.docusign.sent },
              ]).map(i => (
                <span key={i.key} className={`text-[10px] px-2 py-0.5 rounded-full border ${i.ok ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-muted/30 border-border/40 text-muted-foreground"}`}>
                  {i.ok ? "✓" : "—"} {i.label}
                  {!i.ok && hireResult[i.key] && "error" in hireResult[i.key] && hireResult[i.key].error ? `: ${hireResult[i.key].error}` : ""}
                </span>
              ))}
            </div>
            <button onClick={() => setHireResult(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-1 scrollbar-hide">
          {([
            { key: "roster" as Tab, label: `Roster (${members.length})`, badge: 0, icon: Users },
            { key: "timesheets" as Tab, label: "Timesheets", badge: counts.pendingTimesheets, icon: CalendarClock },
            { key: "corrections" as Tab, label: "Corrections", badge: counts.pendingCorrections, icon: FileEdit },
            { key: "leave" as Tab, label: "Leave", badge: counts.pendingLeave, icon: CalendarOff },
            { key: "forms" as Tab, label: "Reports", badge: counts.pendingForms + counts.openIncidents, icon: FileText },
            { key: "postings" as Tab, label: "Postings", badge: counts.activePostings, icon: Megaphone },
            { key: "applicants" as Tab, label: "Applicants", badge: counts.newApplicants, icon: UserPlus },
            { key: "onboarding" as Tab, label: "Onboarding", badge: 0, icon: BookOpenCheck },
            { key: "teams" as Tab, label: "Teams", badge: 0, icon: UsersRound },
            { key: "public-reports" as Tab, label: "Public Reports", badge: 0, icon: QrCode },
            { key: "geofences" as Tab, label: "Geofences", badge: 0, icon: Target },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === t.key && <t.icon className="h-3.5 w-3.5 text-primary" />}
              {t.label}
              {t.badge > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-amber-500/20 text-amber-600">{t.badge}</Badge>}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {tab === "roster" && activeCompanyId && (
          <RosterTab
            activeCompanyId={activeCompanyId}
            canManage={canManage}
            canManageRoles={canManageRoles}
            members={members}
            onReload={load}
            myRole={myRole}
            companyName={companyName}
            userCompanies={userCompanies}
          />
        )}

        {tab === "timesheets" && activeCompanyId && (
          <TimesheetsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "corrections" && activeCompanyId && (
          <CorrectionsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "leave" && activeCompanyId && (
          <LeaveTab activeCompanyId={activeCompanyId} canManage={canManage} members={members} />
        )}

        {tab === "forms" && activeCompanyId && (
          <ReportsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "postings" && activeCompanyId && (
          <PostingsTab activeCompanyId={activeCompanyId} canManage={canManage} companyName={companyName} />
        )}

        {tab === "applicants" && activeCompanyId && (
          <ApplicantsTab
            activeCompanyId={activeCompanyId}
            canManage={canManage}
            companyName={companyName}
            joinCode={joinCode}
            members={members}
            onHireResult={setHireResult}
          />
        )}

        {tab === "onboarding" && activeCompanyId && (
          <OnboardingTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "teams" && activeCompanyId && canManage && (
          <TeamsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "public-reports" && activeCompanyId && (
          <PublicReportsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {tab === "geofences" && activeCompanyId && (
          <GeofencesTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}
      </div>
    </>
  );
}
