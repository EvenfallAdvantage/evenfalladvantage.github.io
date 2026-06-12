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
      { title: "Directory", href: "/directory", icon: "Users" },
      {
        title: "Analytics",
        href: "/admin/analytics",
        icon: "BarChart3",
        roles: ["owner", "admin", "manager"],
      },
    ],
  },
  {
    label: "Field Ops",
    items: [
      { title: "Operations", href: "/schedule", icon: "Globe" },
      { title: "Watch Clock", href: "/timeclock", icon: "Clock" },
      { title: "Reports", href: "/incidents", icon: "AlertTriangle" },
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
          { title: "Academy Hub", href: "/academy", icon: "Compass" },
          { title: "Field Manual", href: "/knowledge-base", icon: "BookOpen" },
          { title: "De-Escalation", href: "/training/scenarios", icon: "MessageCircle" },
          { title: "State Laws", href: "/state-laws", icon: "Scale" },
          { title: "Courses", href: "/courses", icon: "Video" },
          { title: "Certifications", href: "/certifications", icon: "Award" },
        ],
      },
      {
        title: "Tools",
        href: "/geo-risk",
        icon: "Briefcase",
        children: [
          { title: "Geo-Risk", href: "/geo-risk", icon: "MapPin" },
          { title: "Site Assessment", href: "/site-assessment", icon: "ClipboardCheck" },
          { title: "Invoices", href: "/invoices", icon: "FileText" },
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
      },
      {
        title: "Teams",
        href: "/teams",
        icon: "Users",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Ops Planning",
        href: "/admin/events",
        icon: "Flag",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Training Admin",
        href: "/admin/training",
        icon: "NotebookPen",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Instructor HQ",
        href: "/admin/instructor",
        icon: "GraduationCap",
        roles: ["owner", "admin", "instructor"],
        trainingProviderOnly: true,
      },
      {
        title: "Security",
        href: "/admin/security",
        icon: "ShieldAlert",
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

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { title: "Watch", href: "/timeclock", icon: "Clock" },
  { title: "Reports", href: "/incidents", icon: "AlertTriangle" },
  { title: "Home", href: "/feed", icon: "LayoutDashboard" },
  { title: "Comms", href: "/chat", icon: "Radio" },
  { title: "More", href: "/more", icon: "Menu" },
];
