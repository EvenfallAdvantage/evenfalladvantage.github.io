export type ToggleableTab = {
  href: string;
  label: string;
  description: string;
  section: string;
};

/**
 * Company-wide feature toggles (HQ Config › Feature Visibility). Sections and
 * labels mirror the sidebar after the declutter pass. Hrefs are the hiddenTabs
 * keys, so existing saved settings (e.g. "/invoices") keep working.
 */
export const TOGGLEABLE_TABS: ToggleableTab[] = [
  { href: "/patrols", label: "Patrols", description: "GPS patrol tracking and checkpoint scanning (also the officer phone bar's Patrols button)", section: "Field Ops" },
  { href: "/tasks", label: "Tasks", description: "Assigned tasks and checklists", section: "Field Ops" },
  { href: "/schedule?tab=swaps", label: "Shift Swaps", description: "Operations › Swaps for officers and Personnel › Approvals › Swaps for managers", section: "Field Ops" },
  { href: "/schedule?tab=geofences", label: "Geofences", description: "Operations › Geofences (managers), moved from Personnel", section: "Field Ops" },
  { href: "/courses", label: "Courses", description: "Video courses and learning content", section: "Academy" },
  { href: "/training/scenarios", label: "De-Escalation", description: "Interactive de-escalation training scenarios", section: "Academy" },
  { href: "/certifications", label: "Certifications", description: "Certification tracking and expiry", section: "Academy" },
  { href: "/knowledge-base", label: "Field Manual", description: "Company knowledge base and SOPs", section: "Academy" },
  { href: "/state-laws", label: "State Laws", description: "State-by-state guard law reference", section: "Academy" },
  { href: "/geo-risk", label: "Geo-Risk", description: "Geographic risk analysis and heat maps", section: "Tools" },
  { href: "/site-assessment", label: "Site Assessment", description: "Security site assessment reports", section: "Tools" },
  { href: "/armory", label: "Armory", description: "Equipment checkout and returns, moved from Operations", section: "Tools" },
  { href: "/time-off", label: "Leave", description: "Time-off requests", section: "Readiness" },
  { href: "/admin/staff?tab=teams", label: "Teams", description: "Personnel › Teams", section: "Personnel" },
  { href: "/admin/staff?tab=approvals", label: "Approvals", description: "Personnel › Approvals: timesheets, corrections, leave and swaps", section: "Personnel" },
  { href: "/admin/staff?tab=forms", label: "Forms", description: "Personnel › Forms: submissions and public reports", section: "Personnel" },
  { href: "/admin/staff?tab=postings", label: "Postings", description: "Job postings", section: "Personnel" },
  { href: "/admin/staff?tab=applicants", label: "Applicants", description: "Applicant pipeline", section: "Personnel" },
  { href: "/admin/staff?tab=onboarding", label: "Onboarding", description: "New-hire onboarding", section: "Personnel" },
  { href: "/invoices", label: "Invoices", description: "Invoice generator (managers and above)", section: "Command" },
  { href: "/admin/events", label: "Ops Planning", description: "Plan operations and events", section: "Command" },
  { href: "/admin/training", label: "Training HQ", description: "Courses, instructors and training records (managers and instructors)", section: "Command" },
];

/** Sections in sidebar order, derived from TOGGLEABLE_TABS. */
export const TOGGLEABLE_SECTIONS: string[] = [...new Set(TOGGLEABLE_TABS.map((t) => t.section))];

export const SWAPS_FLAG = "/schedule?tab=swaps";
export const GEOFENCES_FLAG = "/schedule?tab=geofences";

export const isFeatureHidden = (hiddenTabs: readonly string[] | undefined, href: string) =>
  !!hiddenTabs?.includes(href);
