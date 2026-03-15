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
      { title: "Deployments", href: "/schedule", icon: "CalendarDays" },
      { title: "Armory", href: "/assets", icon: "Shield" },
      { title: "Field Reports", href: "/forms", icon: "ClipboardList" },
    ],
  },
  {
    label: "Readiness",
    items: [
      { title: "Training", href: "/training", icon: "GraduationCap" },
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
        title: "Intel",
        href: "/admin/reports",
        icon: "BarChart3",
        roles: ["owner", "admin", "manager"],
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
