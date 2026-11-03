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
  | "professional-tools"
  | "my-week";

export function dashboardVariant(role: string | null | undefined): DashboardVariant {
  return hasMinRole((role ?? "staff") as CompanyRole, "manager") ? "leadership" : "officer";
}

/**
 * Wide (xl+) dashboard as a stack of rows. A row with two sections renders
 * side by side (wide | 360px) with top edges aligned and equal height; a
 * one-section row spans the full width. Rows instead of a tall main column
 * beside a short rail, so neither side is left with dead space.
 * Below xl the page uses the single-column order from dashboardSections().
 */
export type DashboardRow = readonly [DashboardSection] | readonly [DashboardSection, DashboardSection];
export type DashboardColumns = { rows: DashboardRow[] };

export function dashboardColumns(variant: DashboardVariant): DashboardColumns {
  if (variant === "leadership") {
    return {
      rows: [
        ["pinned-briefing"], ["onboarding"], ["action-required"], ["kpis"],
        ["quick-actions", "duty-status"],
        ["compliance-overtime"], ["intel"],
      ],
    };
  }
  return {
    rows: [
      ["pinned-briefing"], ["onboarding"],
      ["duty-status", "my-week"],
      ["my-post"], ["quick-actions"], ["professional-tools"],
    ],
  };
}

/** Single-column order (phones, tablets, laptops below xl). */
export function dashboardSections(variant: DashboardVariant): DashboardSection[] {
  if (variant === "leadership") {
    return ["pinned-briefing", "onboarding", "action-required", "kpis", "quick-actions", "duty-status", "compliance-overtime", "intel"];
  }
  return ["pinned-briefing", "onboarding", "duty-status", "my-week", "my-post", "quick-actions", "professional-tools"];
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

/** HQ Config › Feature Visibility key that hides a quick action (none = always on). */
export const QUICK_ACTION_FLAGS: Partial<Record<QuickActionKey, string>> = {
  patrols: "/patrols",
  approvals: "/admin/staff?tab=approvals",
};

export function visibleQuickActionKeys(variant: DashboardVariant, hiddenTabs: readonly string[] = []): QuickActionKey[] {
  const hidden = new Set(hiddenTabs);
  return quickActionKeys(variant).filter((k) => {
    const flag = QUICK_ACTION_FLAGS[k];
    return !flag || !hidden.has(flag);
  });
}

/** Professional Tools tiles that need a minimum role (the page itself is gated). */
export const TOOL_MIN_ROLE: Record<string, CompanyRole> = { "/invoices": "manager" };

export function toolVisible(href: string, role: string | null | undefined, hiddenTabs: readonly string[] = []): boolean {
  if (hiddenTabs.includes(href)) return false;
  const min = TOOL_MIN_ROLE[href];
  return !min || hasMinRole((role ?? "staff") as CompanyRole, min);
}
