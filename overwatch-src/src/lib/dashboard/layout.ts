import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { approvalsHref } from "@/lib/personnel/staff-tabs";

/**
 * Role-based dashboard: officers get a shift-focused home, leadership gets an
 * ops/approvals home. Analytics lives on /admin/analytics (sidebar), not here.
 */
export type DashboardVariant = "officer" | "leadership";

export type DashboardSection =
  | "onboarding"
  | "action-required"
  | "pinned-briefing"
  | "my-post"
  | "duty-status"
  | "kpis"
  | "quick-actions"
  | "compliance-overtime"
  | "intel"
  | "professional-tools";

export function dashboardVariant(role: string | null | undefined): DashboardVariant {
  return hasMinRole((role ?? "staff") as CompanyRole, "manager") ? "leadership" : "officer";
}

export function dashboardSections(variant: DashboardVariant): DashboardSection[] {
  if (variant === "leadership") {
    return ["onboarding", "action-required", "kpis", "quick-actions", "pinned-briefing", "duty-status", "compliance-overtime", "intel"];
  }
  return ["onboarding", "pinned-briefing", "my-post", "duty-status", "quick-actions", "professional-tools"];
}

export type QuickActionKey =
  | "clock" | "incidents" | "patrols" | "forms" | "comms" | "training"
  | "approvals" | "deployments" | "personnel" | "analytics";

export const QUICK_ACTION_HREFS: Record<QuickActionKey, string> = {
  clock: "/timeclock",
  incidents: "/incidents",
  patrols: "/patrols",
  forms: "/forms",
  comms: "/chat",
  training: "/academy",
  approvals: approvalsHref("timesheets"),
  deployments: "/schedule",
  personnel: "/admin/staff",
  analytics: "/admin/analytics",
};

export function quickActionKeys(variant: DashboardVariant): QuickActionKey[] {
  return variant === "leadership"
    ? ["approvals", "deployments", "personnel", "incidents", "comms", "analytics"]
    : ["clock", "incidents", "patrols", "forms", "comms", "training"];
}
