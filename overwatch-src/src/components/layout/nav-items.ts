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
    ],
  },
  {
    label: "Comms",
    items: [
      { title: "Comms", href: "/chat", icon: "Radio" },
      { title: "Roster", href: "/directory", icon: "Users" },
    ],
  },
  {
    label: "Field Ops",
    items: [
      { title: "Watch Log", href: "/timeclock", icon: "Clock" },
      { title: "Incidents", href: "/incidents", icon: "AlertTriangle" },
      { title: "Patrols", href: "/patrols", icon: "Footprints" },
      { title: "Deployments", href: "/schedule", icon: "CalendarDays" },
      { title: "Armory", href: "/assets", icon: "QrCode" },
      { title: "Field Reports", href: "/forms", icon: "ClipboardList" },
    ],
  },
  {
    label: "Readiness",
    items: [
      { title: "Training", href: "/training", icon: "GraduationCap" },
      { title: "Drills", href: "/quizzes", icon: "Target" },
      { title: "Scenarios", href: "/training/scenarios", icon: "MessageCircle" },
      { title: "Invoices", href: "/invoices", icon: "FileText" },
      { title: "Site Assessment", href: "/site-assessment", icon: "Shield" },
      { title: "Geo-Risk", href: "/geo-risk", icon: "MapPin" },
      { title: "State Laws", href: "/state-laws", icon: "Scale" },
      { title: "Courses", href: "/courses", icon: "BookOpen" },
      { title: "Instructor", href: "/instructor", icon: "Video" },
      { title: "Certifications", href: "/certifications", icon: "Award" },
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
      {
        title: "HQ Config",
        href: "/admin/settings",
        icon: "Settings",
        roles: ["owner", "admin"],
      },
      {
        title: "Settings",
        href: "/settings",
        icon: "Settings",
        roles: ["owner", "admin"],
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
