"use client";

import { useEffect, type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { dashboardSections, dashboardVariant, type DashboardSection } from "@/lib/dashboard/layout";

import { OnboardingBanner } from "./components/onboarding-banner";
import { ActionRequired } from "./components/action-required";
import { PinnedBriefing } from "./components/pinned-briefing";
import { DutyStatus } from "./components/duty-status";
import { MyPostCard } from "./components/my-post-card";
import { KpiCards } from "./components/kpi-cards";
import { QuickActions } from "./components/quick-actions";
import { IntelCenter } from "./components/intel-center";
import { ComplianceWidget } from "./components/compliance-widget";
import { OvertimeWidget } from "./components/overtime-widget";
import { ProfessionalTools } from "./components/professional-tools";
import { formatMemberName } from "@/lib/format-names";

export default function FeedPage() {
  const { user, activeCompanyId, getActiveCompany } = useAuthStore();
  const activeCompany = getActiveCompany();
  const hiddenTabs = new Set<string>(activeCompany?.settings?.hiddenTabs ?? []);
  const variant = dashboardVariant(activeCompany?.role);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    const greeting = user && (user.firstName || user.callsign || user.lastName)
      ? formatMemberName(user)
      : "Staff";
    setHeader(
      `Welcome back, ${greeting}`,
      new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
      <LayoutDashboard className="h-5 w-5" />
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, user]);

  if (!user) {
    return <DashboardSkeleton />;
  }

  const cid = activeCompanyId ?? null;

  const render = (section: DashboardSection): ReactNode => {
    switch (section) {
      case "onboarding": return <OnboardingBanner user={user} />;
      case "action-required": return cid ? <ActionRequired activeCompanyId={cid} /> : null;
      case "pinned-briefing": return cid ? <PinnedBriefing activeCompanyId={cid} userId={user.id} /> : null;
      case "my-post": return cid ? <MyPostCard activeCompanyId={cid} /> : null;
      case "duty-status": return <DutyStatus activeCompanyId={activeCompanyId} />;
      case "kpis": return cid ? <KpiCards activeCompanyId={cid} /> : null;
      case "quick-actions": return <QuickActions variant={variant} />;
      case "compliance-overtime": return cid ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ComplianceWidget activeCompanyId={cid} />
          <OvertimeWidget activeCompanyId={cid} />
        </div>
      ) : null;
      case "intel": return cid ? <IntelCenter activeCompanyId={cid} /> : null;
      case "professional-tools": return <ProfessionalTools hiddenTabs={hiddenTabs} />;
    }
  };

  return (
    <div className="space-y-6" data-dashboard={variant}>
      {/* Active SOS alerts show on every page (components/sos/global-panic-listener). */}
      {dashboardSections(variant).map((s) => {
        const node = render(s);
        return node ? <div key={s} className="contents">{node}</div> : null;
      })}
    </div>
  );
}
