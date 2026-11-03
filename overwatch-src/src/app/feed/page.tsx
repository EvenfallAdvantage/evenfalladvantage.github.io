"use client";

import { useEffect, type ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { dashboardColumns, dashboardSections, dashboardVariant, type DashboardSection } from "@/lib/dashboard/layout";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MyWeekCard } from "./components/my-week-card";

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
  const hiddenList: string[] = activeCompany?.settings?.hiddenTabs ?? [];
  const hiddenTabs = new Set<string>(hiddenList);
  const variant = dashboardVariant(activeCompany?.role);
  // One layout mounted at a time so widgets never fetch twice.
  const wide = useMediaQuery("(min-width: 1280px)");
  const phone = useMediaQuery("(max-width: 639px)");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    const greeting = user && (user.firstName || user.callsign || user.lastName)
      ? formatMemberName(user)
      : "Staff";
    const short = user?.firstName || user?.callsign || greeting;
    setHeader(
      phone ? `Welcome, ${short}` : `Welcome back, ${greeting}`,
      new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }),
      <LayoutDashboard className="h-5 w-5" />
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, user, phone]);

  if (!user) {
    return <DashboardSkeleton />;
  }

  const cid = activeCompanyId ?? null;

  const render = (section: DashboardSection): ReactNode => {
    switch (section) {
      case "onboarding": return <OnboardingBanner user={user} />;
      case "action-required": return cid ? <ActionRequired activeCompanyId={cid} hiddenTabs={hiddenList} /> : null;
      case "pinned-briefing": return cid ? <PinnedBriefing activeCompanyId={cid} userId={user.id} /> : null;
      case "my-post": return cid ? <MyPostCard activeCompanyId={cid} /> : null;
      case "duty-status": return <DutyStatus activeCompanyId={activeCompanyId} />;
      case "my-week": return cid ? <MyWeekCard activeCompanyId={cid} /> : null;
      case "kpis": return cid ? <KpiCards activeCompanyId={cid} /> : null;
      case "quick-actions": return <QuickActions variant={variant} hiddenTabs={hiddenList} />;
      case "compliance-overtime": return cid ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:[&>:only-child]:col-span-2">
          {!hiddenTabs.has("/certifications") && <ComplianceWidget activeCompanyId={cid} />}
          <OvertimeWidget activeCompanyId={cid} />
        </div>
      ) : null;
      case "intel": return cid ? <IntelCenter activeCompanyId={cid} hiddenTabs={hiddenList} /> : null;
      case "professional-tools": return <ProfessionalTools hiddenTabs={hiddenTabs} role={activeCompany?.role} />;
    }
  };

  const list = (sections: readonly DashboardSection[]) =>
    sections.map((s) => {
      const node = render(s);
      return node ? <div key={s} className="contents">{node}</div> : null;
    });

  if (wide) {
    const { rows } = dashboardColumns(variant);
    // Paired card fills the row: same top edge and height as its neighbour.
    const fill = "flex flex-col [&>[data-slot=card]]:flex-1 [&_[data-slot=card-content]]:h-full [&_[data-slot=card-content]>div]:h-full";
    return (
      <div className="flex flex-col gap-6" data-dashboard={variant} data-layout="columns">
        {rows.map((row) => {
          if (row.length === 1) return list(row);
          const [left, right] = row.map((sec) => [sec, render(sec)] as const);
          if (!left[1] || !right[1]) return list(row);
          return (
            <div key={row.join("|")} className="grid grid-cols-[minmax(0,1fr)_360px] items-stretch gap-6">
              <div className={`min-w-0 ${left[0] === "quick-actions" ? "" : fill}`}>{left[1]}</div>
              <div className={`min-w-0 ${fill} ${left[0] === "quick-actions" ? "pt-8" : ""}`}>{right[1]}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-dashboard={variant} data-layout="stack">
      {/* Active SOS alerts show on every page (components/sos/global-panic-listener). */}
      {list(dashboardSections(variant))}
    </div>
  );
}
