import type { NavItem } from "@/types";

type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "",
    items: [
      { title: "Briefing", href: "/feed", icon: "Radar" },
      { title: "Dossier", href: "/profile", icon: "UserCircle" },
    ],
  },
  {
    label: "Comms",
    items: [
      { title: "Comms", href: "/chat", icon: "Radio" },
      { title: "Dispatch", href: "/updates", icon: "Siren" },
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
      { title: "Drills", href: "/quizzes", icon: "Target" },
      { title: "Field Manual", href: "/knowledge-base", icon: "BookOpen" },
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
        title: "HQ Config",
        href: "/admin/settings",
        icon: "Settings",
        roles: ["owner", "admin"],
      },
    ],
  },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { title: "Briefing", href: "/feed", icon: "Radar" },
  { title: "Comms", href: "/chat", icon: "Radio" },
  { title: "Watch", href: "/timeclock", icon: "Clock" },
  { title: "Deploy", href: "/schedule", icon: "CalendarDays" },
  { title: "Command", href: "/more", icon: "Menu" },
];
