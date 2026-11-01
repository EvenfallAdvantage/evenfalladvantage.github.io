/**
 * Personnel (/admin/staff) tab routing.
 *
 * Timesheets, Corrections and Leave live together under one "Approvals" tab.
 * Old deep links (?tab=timesheets|corrections|leave) keep working: they resolve
 * to the Approvals tab with the matching view selected.
 */
export const STAFF_TABS = [
  "roster", "teams", "geofences", "forms", "public-reports",
  "approvals", "postings", "applicants", "onboarding",
] as const;
export type StaffTab = (typeof STAFF_TABS)[number];

export const APPROVAL_VIEWS = ["timesheets", "corrections", "leave"] as const;
export type ApprovalView = (typeof APPROVAL_VIEWS)[number];

const isApprovalView = (v: string | null | undefined): v is ApprovalView =>
  !!v && (APPROVAL_VIEWS as readonly string[]).includes(v);

/** Resolve ?tab= / ?view= (including legacy tab names) to the tab + approvals view to show. */
export function resolveStaffTab(
  tab: string | null | undefined,
  view?: string | null,
): { tab: StaffTab; view: ApprovalView } {
  const fallbackView: ApprovalView = isApprovalView(view) ? view : "timesheets";
  if (isApprovalView(tab)) return { tab: "approvals", view: tab };
  if (tab && (STAFF_TABS as readonly string[]).includes(tab)) return { tab: tab as StaffTab, view: fallbackView };
  return { tab: "roster", view: fallbackView };
}

/** Canonical Personnel link for an approvals view. */
export const approvalsHref = (view: ApprovalView) => `/admin/staff?tab=approvals&view=${view}`;
