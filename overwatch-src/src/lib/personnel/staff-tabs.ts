/**
 * Personnel (/admin/staff) tab routing.
 *
 * Timesheets, Corrections and Leave live together under one "Approvals" tab.
 * Old deep links (?tab=timesheets|corrections|leave) keep working: they resolve
 * to the Approvals tab with the matching view selected.
 */
export const STAFF_TABS = [
  "roster", "teams", "forms",
  "approvals", "postings", "applicants", "onboarding",
] as const;
export type StaffTab = (typeof STAFF_TABS)[number];

export const APPROVAL_VIEWS = ["timesheets", "corrections", "leave", "swaps"] as const;
export type ApprovalView = (typeof APPROVAL_VIEWS)[number];

const isApprovalView = (v: string | null | undefined): v is ApprovalView =>
  !!v && (APPROVAL_VIEWS as readonly string[]).includes(v);

/** Forms tab views: internal submissions, and Public Reports (QR / anonymous). */
export const FORMS_VIEWS = ["submissions", "public"] as const;
export type FormsView = (typeof FORMS_VIEWS)[number];
const isFormsView = (v: string | null | undefined): v is FormsView =>
  !!v && (FORMS_VIEWS as readonly string[]).includes(v);

/** Geofences moved from Personnel to Operations (/schedule, manager+). */
export const GEOFENCES_HREF = "/schedule?tab=geofences";

/** Resolve ?tab= / ?view= (including legacy tab names) to the tab + views to show. */
export function resolveStaffTab(
  tab: string | null | undefined,
  view?: string | null,
): { tab: StaffTab; view: ApprovalView; formsView: FormsView; redirect?: string } {
  const fallbackView: ApprovalView = isApprovalView(view) ? view : "timesheets";
  const formsView: FormsView = isFormsView(view) ? view : "submissions";
  if (tab === "geofences") return { tab: "roster", view: fallbackView, formsView, redirect: GEOFENCES_HREF };
  if (tab === "public-reports") return { tab: "forms", view: fallbackView, formsView: "public" };
  if (isApprovalView(tab)) return { tab: "approvals", view: tab, formsView };
  if (tab && (STAFF_TABS as readonly string[]).includes(tab)) return { tab: tab as StaffTab, view: fallbackView, formsView };
  return { tab: "roster", view: fallbackView, formsView };
}

/** Canonical Personnel link for an approvals view. */
export const approvalsHref = (view: ApprovalView) => `/admin/staff?tab=approvals&view=${view}`;

/** Canonical Personnel link for a Forms view. */
export const formsHref = (view: FormsView = "submissions") => `/admin/staff?tab=forms&view=${view}`;
