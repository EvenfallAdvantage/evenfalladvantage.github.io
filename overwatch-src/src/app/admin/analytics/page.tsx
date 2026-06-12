"use client";

import { useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export default function AnalyticsPage() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canView = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(
      "ANALYTICS",
      "Cross-domain operational metrics",
      <BarChart3 className="h-5 w-5" />,
    );
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  if (!canView) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Manager access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnalyticsView />
    </div>
  );
}
