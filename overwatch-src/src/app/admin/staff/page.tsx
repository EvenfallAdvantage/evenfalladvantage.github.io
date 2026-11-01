"use client";

import { SubTab, SubTabList, TabActionRow } from "@/components/ui/sub-tabs";
import { countsAsPending } from "@/lib/timesheets/accidental";
import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Users, Loader2,
  UserPlus,
  BookOpenCheck, CalendarClock, FileText, Megaphone,
  CheckCircle2,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getCompanyMembers, getCompanyDetails, getCompanyJoinCode,
  getCompanyTimesheets, getAllTimeOffRequests,
  getAllFormSubmissions, getCompanyTimeChangeRequests,
  getApplicants, getIncidents,
} from "@/lib/supabase/db";
import { type HireResult } from "@/lib/services/hiring-orchestrator";
import { usePageHeader } from "@/stores/page-header-store";
import { OnboardingTab } from "./components/onboarding-tab";
import { ApprovalsTab } from "./components/approvals-tab";
import { hiddenStaffTabs, resolveStaffTab, type StaffTab, type ApprovalView, type FormsView } from "@/lib/personnel/staff-tabs";
import { PostingsTab } from "./components/postings-tab";
import { ApplicantsTab } from "./components/applicants-tab";
import { RosterTab } from "./components/roster-tab";
import { TeamsTab } from "./components/teams-tab";
import { FormsTab } from "./components/forms-tab";
import { getCompanyPostings } from "@/lib/supabase/db-postings";
import { logger } from "@/lib/logger";

type Member = Record<string, unknown> & {
  id: string;
  role: string;
  users?: { id?: string };
};

type Tab = StaffTab;

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

function AdminStaffPageInner() {
  const searchParams = useSearchParams();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const user = useAuthStore((s) => s.user);

  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);
  // Legacy ?tab=timesheets|corrections|leave links resolve to Approvals with that view.
  const initial = resolveStaffTab(searchParams.get("tab"), searchParams.get("view"));
  const [tab, setTab] = useState<Tab>(initial.tab);
  const [approvalView, setApprovalView] = useState<ApprovalView>(initial.view);
  const [formsView, setFormsView] = useState<FormsView>(initial.formsView);
  const router = useRouter();
  // Geofences moved to Operations; old ?tab=geofences links follow it.
  useEffect(() => {
    if (initial.redirect) router.replace(initial.redirect);
  }, [initial.redirect, router]);

  // Sync tab state with URL query param changes (e.g. sidebar nav clicks)
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    const raw = searchParams.get("tab");
    if (!raw) return;
    const next = resolveStaffTab(raw, searchParams.get("view"));
    if (next.tab !== tabRef.current) setTab(next.tab);
    if (next.redirect) { router.replace(next.redirect); return; }
    if (next.tab === "approvals") setApprovalView(next.view);
    if (next.tab === "forms") setFormsView(next.formsView);
  }, [searchParams, router]);

  const [hireResult, setHireResult] = useState<HireResult | null>(null);
  const [counts, setCounts] = useState<TabCounts>(ZERO_COUNTS);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);


  const myRole = user?.companies.find((c: { companyId: string }) => c.companyId === activeCompanyId)?.role ?? "staff";
  // Managers can change roles too, within the one-level-below rule enforced by update_member_role.
  const canManageRoles = myRole === "owner" || myRole === "admin" || myRole === "manager";
  const canManage = myRole === "owner" || myRole === "admin" || myRole === "manager";

  const load = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [m, company, code] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getCompanyDetails(activeCompanyId),
        canManage ? getCompanyJoinCode(activeCompanyId) : Promise.resolve(""),
      ]);
      setMembers(m);
      setJoinCode(code);
      setCompanyName(company?.name ?? "");

      // Load badge counts (non-blocking)
      Promise.all([
        getCompanyTimesheets(activeCompanyId).then(ts => ts.filter((t: { clock_in: string | null; clock_out: string | null; approved: boolean }) => countsAsPending(t)).length).catch(() => 0),
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
  }, [activeCompanyId, canManage]);

  useEffect(() => { load(); }, [load]);

  const userCompanies = (user?.companies ?? []).map((c: { companyId: string; companyLogo?: string | null; brandColor?: string | null }) => ({
    companyId: c.companyId,
    companyLogo: c.companyLogo ?? null,
    brandColor: c.brandColor ?? null,
  }));

  // HQ Config › Feature Visibility can switch Personnel tabs off; fall back to Roster.
  const hiddenStaff = hiddenStaffTabs(
    (user?.companies.find((c: { companyId: string }) => c.companyId === activeCompanyId) as { settings?: { hiddenTabs?: string[] } } | undefined)?.settings?.hiddenTabs,
  );
  const shownTab: Tab = hiddenStaff.has(tab) ? "roster" : tab;

  useEffect(() => {
    const heads: Record<Tab, [string, string, React.ReactNode]> = {
      roster: ["ROSTER", "Team members, roles and contact details", <Users key="i" className="h-5 w-5" />],
      teams: ["TEAMS", "Group officers into teams", <UsersRound key="i" className="h-5 w-5" />],
      forms: ["PERSONNEL FORMS", "Submitted field forms and public reports", <FileText key="i" className="h-5 w-5" />],
      approvals: ["APPROVALS", "Timesheets, corrections, leave and shift swaps", <CalendarClock key="i" className="h-5 w-5" />],
      postings: ["JOB POSTINGS", "Open positions you are hiring for", <Megaphone key="i" className="h-5 w-5" />],
      applicants: ["APPLICANTS", "Candidates who applied to your postings", <UserPlus key="i" className="h-5 w-5" />],
      onboarding: ["ONBOARDING", "New-hire onboarding progress", <BookOpenCheck key="i" className="h-5 w-5" />],
    };
    const [title, subtitle, icon] = heads[shownTab] ?? heads.roster;
    setHeader(title, subtitle, icon);
    return () => clearHeader();
  }, [setHeader, clearHeader, shownTab]);

  const approvalsBadge = counts.pendingTimesheets + counts.pendingCorrections + counts.pendingLeave;

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

        {/* Tabs. Phone: grouped picker (11 tabs don't fit a thumb-width strip). */}
        {(() => {
          const groups: { label: string; keys: Tab[] }[] = [
            { label: "People", keys: ["roster", "teams", "onboarding", "applicants", "postings"] },
            { label: "Time & pay", keys: ["approvals"] },
            { label: "Field", keys: ["forms"] },
          ];
          const meta: Record<Tab, { label: string; badge: number }> = {
            roster: { label: `Roster (${members.length})`, badge: 0 }, teams: { label: "Teams", badge: 0 },
            forms: { label: "Forms", badge: counts.pendingForms + counts.openIncidents },
            approvals: { label: "Approvals", badge: approvalsBadge },
            postings: { label: "Postings", badge: counts.activePostings }, applicants: { label: "Applicants", badge: counts.newApplicants },
            onboarding: { label: "Onboarding", badge: 0 },
          };
          return (
            <label className="block sm:hidden">
              <span className="sr-only">Section</span>
              <select value={shownTab} onChange={(e) => setTab(e.target.value as Tab)} data-testid="staff-section"
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base font-semibold">
                {groups.filter((g) => g.keys.some((k) => !hiddenStaff.has(k))).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.keys.filter((k) => !hiddenStaff.has(k)).map((k) => <option key={k} value={k}>{meta[k].label}{meta[k].badge > 0 ? ` (${meta[k].badge} pending)` : ""}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
          );
        })()}
        <SubTabList className="hidden sm:flex" hostAction={false}>
          {([
            { key: "roster" as Tab, label: `Roster (${members.length})`, badge: 0, icon: Users },
            { key: "teams" as Tab, label: "Teams", badge: 0, icon: UsersRound },
            { key: "forms" as Tab, label: "Forms", badge: counts.pendingForms + counts.openIncidents, icon: FileText },
            { key: "approvals" as Tab, label: "Approvals", badge: approvalsBadge, icon: CalendarClock },
            { key: "postings" as Tab, label: "Postings", badge: counts.activePostings, icon: Megaphone },
            { key: "applicants" as Tab, label: "Applicants", badge: counts.newApplicants, icon: UserPlus },
            { key: "onboarding" as Tab, label: "Onboarding", badge: 0, icon: BookOpenCheck },
          ]).filter((t) => !hiddenStaff.has(t.key)).map(t => (
            <SubTab key={t.key} active={shownTab === t.key} onClick={() => setTab(t.key)} icon={t.icon}>
              {t.label}
              {t.badge > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-amber-500/20 text-amber-600">{t.badge}</Badge>}
            </SubTab>
          ))}
        </SubTabList>
        <TabActionRow className="mt-0" />

        {/* ── Tab Content ── */}
        {shownTab === "roster" && activeCompanyId && (
          <RosterTab
            activeCompanyId={activeCompanyId}
            canManage={canManage}
            canManageRoles={canManageRoles}
            members={members}
            onReload={load}
            myRole={myRole}
            companyName={companyName}
            userCompanies={userCompanies}
            currentUserId={user?.id}
          />
        )}

        {shownTab === "approvals" && activeCompanyId && (
          <ApprovalsTab
            activeCompanyId={activeCompanyId}
            canManage={canManage}
            members={members}
            view={approvalView}
            onViewChange={setApprovalView}
            counts={{ timesheets: counts.pendingTimesheets, corrections: counts.pendingCorrections, leave: counts.pendingLeave }}
          />
        )}

        {shownTab === "forms" && activeCompanyId && (
          <FormsTab activeCompanyId={activeCompanyId} canManage={canManage} view={formsView} onViewChange={setFormsView} pendingSubmissions={counts.pendingForms + counts.openIncidents} />
        )}

        {shownTab === "postings" && activeCompanyId && (
          <PostingsTab activeCompanyId={activeCompanyId} canManage={canManage} companyName={companyName} />
        )}

        {shownTab === "applicants" && activeCompanyId && (
          <ApplicantsTab
            activeCompanyId={activeCompanyId}
            canManage={canManage}
            companyName={companyName}
            joinCode={joinCode}
            members={members}
            onHireResult={setHireResult}
          />
        )}

        {shownTab === "onboarding" && activeCompanyId && (
          <OnboardingTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

        {shownTab === "teams" && activeCompanyId && canManage && (
          <TeamsTab activeCompanyId={activeCompanyId} canManage={canManage} />
        )}

      </div>
    </>
  );
}

export default function AdminStaffPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <AdminStaffPageInner />
    </Suspense>
  );
}
