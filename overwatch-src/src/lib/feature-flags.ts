export type ToggleableTab = {
  href: string;
  label: string;
  description: string;
  section: string;
};

export const TOGGLEABLE_TABS: ToggleableTab[] = [
  { href: "/patrols", label: "Patrols", description: "GPS patrol tracking and checkpoint scanning", section: "Field Ops" },
  { href: "/training/scenarios", label: "De-Escalation", description: "Interactive de-escalation training scenarios", section: "Academy" },
  { href: "/courses", label: "Courses", description: "Video courses and learning content", section: "Academy" },
  { href: "/geo-risk", label: "Geo-Risk", description: "Geographic risk analysis and heat maps", section: "Tools" },
  { href: "/site-assessment", label: "Site Assessment", description: "Security site assessment reports", section: "Tools" },
  { href: "/invoices", label: "Invoices", description: "Invoice generator and management", section: "Tools" },
  { href: "/state-laws", label: "State Laws", description: "State-by-state guard law reference", section: "Academy" },
];
