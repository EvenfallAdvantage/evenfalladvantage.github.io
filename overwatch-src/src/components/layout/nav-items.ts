import type { NavItem } from "@/types";

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { title: "Dashboard", href: "/feed", icon: "LayoutDashboard" },
      { title: "Comms", href: "/chat", icon: "Radio" },
      { title: "Directory", href: "/directory", icon: "UserSearch" },
    ],
  },
  {
    label: "Field Ops",
    items: [
      { title: "Operations", href: "/schedule", icon: "Globe" },
      { title: "Clock", href: "/timeclock", icon: "Clock" },
      { title: "Patrols", href: "/patrols", icon: "Footprints" },
      { title: "Tasks", href: "/tasks", icon: "ListChecks" },
      { title: "Incidents", href: "/incidents", icon: "AlertTriangle" },
    ],
  },
  {
    label: "Readiness",
    items: [
      {
        title: "Academy",
        href: "/academy",
        icon: "School",
        children: [
          // Learn → Practice → Prove → Reference
          { title: "Academy Hub", href: "/academy", icon: "Compass" },
          { title: "Courses", href: "/courses", icon: "Video" },
          { title: "De-Escalation", href: "/training/scenarios", icon: "MessageCircle" },
          { title: "Certifications", href: "/certifications", icon: "Award" },
          { title: "Field Manual", href: "/knowledge-base", icon: "BookOpen" },
          { title: "State Laws", href: "/state-laws", icon: "Scale" },
        ],
      },
      {
        title: "Tools",
        href: "/geo-risk",
        icon: "Briefcase",
        children: [
          { title: "Geo-Risk", href: "/geo-risk", icon: "MapPin" },
          { title: "Site Assessment", href: "/site-assessment", icon: "ClipboardCheck" },
          { title: "Armory", href: "/armory", icon: "QrCode" },
        ],
      },
      { title: "Leave", href: "/time-off", icon: "CalendarOff" },
    ],
  },
  {
    label: "Command",
    items: [
      {
        title: "Personnel",
        href: "/admin/staff",
        icon: "UserCog",
        roles: ["owner", "admin", "manager"],
        children: [
          { title: "Roster", href: "/admin/staff?tab=roster", icon: "Users" },
          { title: "Teams", href: "/admin/staff?tab=teams", icon: "UsersRound" },
          { title: "Forms", href: "/admin/staff?tab=forms", icon: "FileText" },
          { title: "Approvals", href: "/admin/staff?tab=approvals", icon: "CalendarClock" },
          { title: "Postings", href: "/admin/staff?tab=postings", icon: "Megaphone" },
          { title: "Applicants", href: "/admin/staff?tab=applicants", icon: "UserPlus" },
          { title: "Onboarding", href: "/admin/staff?tab=onboarding", icon: "BookOpenCheck" },
        ],
      },
      {
        title: "Analytics",
        href: "/admin/analytics",
        icon: "BarChart3",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Invoices",
        href: "/invoices",
        icon: "FileText",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Ops Planning",
        href: "/admin/events",
        icon: "Flag",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Training HQ",
        href: "/admin/training",
        icon: "NotebookPen",
        roles: ["owner", "admin", "manager", "instructor"],
      },
      {
        title: "Security",
        href: "/admin/security",
        icon: "ShieldAlert",
        roles: ["owner", "admin"],
      },
      {
        title: "HQ Config",
        href: "/admin/settings",
        icon: "Settings",
        roles: ["owner", "admin"],
      },
      {
        title: "System Health",
        href: "/admin/health",
        icon: "Activity",
        superAdminOnly: true,
      },
    ],
  },
];

/**
 * Phone bars share one layout so muscle memory carries across roles:
 * slot 1 Clock, slot 3 Incidents, slot 4 Comms, slot 5 More. Slot 2 is Home
 * for managers and Patrols for field officers.
 */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  { title: "Clock", href: "/timeclock", icon: "Clock" },
  { title: "Home", href: "/feed", icon: "LayoutDashboard" },
  { title: "Incidents", href: "/incidents", icon: "AlertTriangle" },
  { title: "Comms", href: "/chat", icon: "Radio" },
  { title: "More", href: "/more", icon: "Menu" },
];

/**
 * Simplified bottom nav for field officers (staff / breaker / lead): the four
 * things they do on shift (clock, patrol, report, chat) plus More. Dashboard
 * and everything else stays reachable from More. Managers and above keep
 * MOBILE_NAV_ITEMS.
 */
export const OFFICER_MOBILE_NAV_ITEMS: NavItem[] = [
  { title: "Clock", href: "/timeclock", icon: "Clock" },
  { title: "Patrols", href: "/patrols", icon: "Footprints" },
  { title: "Incidents", href: "/incidents", icon: "AlertTriangle" },
  { title: "Comms", href: "/chat", icon: "Radio" },
  { title: "More", href: "/more", icon: "Menu" },
];

/** Roles that get the officer-focused bottom nav. */
export const OFFICER_ROLES = ["staff", "breaker", "lead"] as const;
