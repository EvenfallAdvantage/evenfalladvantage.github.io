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
      { title: "Briefing", href: "/updates", icon: "Radar" },
      { title: "Comms", href: "/chat", icon: "Radio" },
      { title: "Roster", href: "/directory", icon: "Users" },
    ],
  },
  {
    label: "Field Ops",
    items: [
      { title: "Watch Log", href: "/timeclock", icon: "Clock" },
      { title: "Reports", href: "/incidents", icon: "ClipboardList" },
      { title: "Patrols", href: "/patrols", icon: "Footprints" },
      { title: "Deployments", href: "/schedule", icon: "CalendarDays" },
      { title: "Armory", href: "/assets", icon: "QrCode" },
    ],
  },
  {
    label: "Readiness",
    items: [
      {
        title: "Training",
        href: "/training",
        icon: "GraduationCap",
        children: [
          { title: "Modules", href: "/training", icon: "GraduationCap" },
          { title: "Drills", href: "/quizzes", icon: "Target" },
          { title: "Courses", href: "/courses", icon: "BookOpen" },
          { title: "Certifications", href: "/certifications", icon: "Award" },
        ],
      },
      {
        title: "Tools",
        href: "/geo-risk",
        icon: "Shield",
        children: [
          { title: "Geo-Risk", href: "/geo-risk", icon: "MapPin" },
          { title: "Site Assessment", href: "/site-assessment", icon: "Shield" },
          { title: "State Laws", href: "/state-laws", icon: "Scale" },
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
        title: "Operations",
        href: "/admin/events",
        icon: "MapPin",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Personnel",
        href: "/admin/staff",
        icon: "Users",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Training Admin",
        href: "/admin/training",
        icon: "GraduationCap",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Question Bank",
        href: "/admin/questions",
        icon: "HelpCircle",
        roles: ["owner", "admin", "manager"],
      },
      {
        title: "Intel",
        href: "/admin/reports",
        icon: "BarChart3",
        roles: ["owner", "admin", "manager"],
      },
    ],
  },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { title: "Home", href: "/feed", icon: "LayoutDashboard" },
  { title: "Comms", href: "/chat", icon: "Radio" },
  { title: "Watch", href: "/timeclock", icon: "Clock" },
  { title: "Deploy", href: "/schedule", icon: "CalendarDays" },
  { title: "More", href: "/more", icon: "Menu" },
];
