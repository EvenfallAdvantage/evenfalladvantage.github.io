"use client";

import { useEffect } from "react";
import { LayoutDashboard, BarChart3 } from "lucide-react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";

import { OnboardingBanner } from "./components/onboarding-banner";
import { ActionRequired } from "./components/action-required";
import { PinnedBriefing } from "./components/pinned-briefing";
import { UpcomingShift } from "./components/upcoming-shift";
import { DutyStatus } from "./components/duty-status";
import { KpiCards } from "./components/kpi-cards";
import { QuickActions } from "./components/quick-actions";
import { IntelCenter } from "./components/intel-center";
import { ComplianceWidget } from "./components/compliance-widget";
import { OvertimeWidget } from "./components/overtime-widget";
import { PanicAlertBanner } from "./components/panic-alert-banner";
import { ProfessionalTools } from "./components/professional-tools";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function FeedPage() {
  const { user, activeCompanyId, getActiveCompany } = useAuthStore();
  const activeCompany = getActiveCompany();
  const role = activeCompany?.role ?? "staff";
  const hiddenTabs = new Set<string>(activeCompany?.settings?.hiddenTabs ?? []);
  const isLeadership = hasMinRole((role ?? "staff") as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(
      `Welcome back, ${user?.firstName || "Staff"}`,
      new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
      <LayoutDashboard className="h-5 w-5" />
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, user?.firstName]);

  if (!user) {
    return <DashboardSkeleton />;
  }

  const validCompanyId = activeCompanyId ?? null;

  return (
    <div className="space-y-6">
      {/* Active SOS alerts — leadership only, top priority */}
      {isLeadership && validCompanyId && (
        <PanicAlertBanner activeCompanyId={validCompanyId} />
      )}

      {/* No-company onboarding banner */}
      <OnboardingBanner user={user} />

      {/* Action Required — leadership only */}
      {isLeadership && validCompanyId && (
        <ActionRequired activeCompanyId={validCompanyId} />
      )}

      {/* Pinned Briefing — always visible */}
      {validCompanyId && (
        <PinnedBriefing activeCompanyId={validCompanyId} userId={user.id} />
      )}

      {/* Upcoming Shift */}
      {validCompanyId && (
        <UpcomingShift activeCompanyId={validCompanyId} />
      )}

      {/* Duty Status — THE hero widget */}
      <DutyStatus activeCompanyId={activeCompanyId} />

      {/* KPI Cards — leadership only */}
      {isLeadership && validCompanyId && (
        <KpiCards activeCompanyId={validCompanyId} />
      )}

      {/* Quick Actions Grid */}
      <QuickActions />

      {/* Compliance + Overtime — leadership only */}
      {isLeadership && validCompanyId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ComplianceWidget activeCompanyId={validCompanyId} />
          <OvertimeWidget activeCompanyId={validCompanyId} />
        </div>
      )}

      {/* Intel Center — leadership only */}
      {isLeadership && validCompanyId && (
        <IntelCenter activeCompanyId={validCompanyId} />
      )}

      {/* Professional Tools */}
      <ProfessionalTools hiddenTabs={hiddenTabs} />

      {/* Analytics — leadership only */}
      {isLeadership && (
        <div id="analytics">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Analytics
            </h2>
          </div>
          <AnalyticsView />
        </div>
      )}
    </div>
  );
}
