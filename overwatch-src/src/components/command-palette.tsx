"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  LayoutDashboard, Radio, Users, Clock, AlertTriangle, CalendarDays,
  School, BookOpen, MessageCircle, Scale, Video, Award,
  MapPin, ClipboardCheck, FileText, CalendarOff, Flag, UserCog,
  NotebookPen, GraduationCap, ShieldAlert, Activity, User,
  Bell, Search, ScanLine, Settings, ListChecks,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Radio, Users, Clock, AlertTriangle, CalendarDays,
  School, BookOpen, MessageCircle, Scale, Video, Award,
  MapPin, ClipboardCheck, FileText, CalendarOff, Flag, UserCog,
  NotebookPen, GraduationCap, ShieldAlert, Activity, User,
  Bell, Search, ScanLine, Settings, ListChecks,
};

interface CommandItem {
  label: string;
  href: string;
  icon: string;
  keywords?: string;
  roles?: string[];
}

const COMMANDS: CommandItem[] = [
  // Core
  { label: "Dashboard", href: "/feed", icon: "LayoutDashboard", keywords: "home feed" },
  { label: "Comms", href: "/chat", icon: "Radio", keywords: "chat messages channels" },
  { label: "Directory", href: "/directory", icon: "Users", keywords: "roster staff contacts" },
  { label: "Watch Log", href: "/timeclock", icon: "Clock", keywords: "timeclock clock in out" },
  { label: "Incidents", href: "/incidents", icon: "AlertTriangle", keywords: "reports incidents" },
  { label: "Tasks", href: "/tasks", icon: "ListChecks", keywords: "tasks todo work assignments" },
  { label: "Operations", href: "/schedule", icon: "CalendarDays", keywords: "schedule shifts" },
  // Readiness
  { label: "Academy Hub", href: "/academy", icon: "School", keywords: "training learning" },
  { label: "Field Manual", href: "/knowledge-base", icon: "BookOpen", keywords: "sops protocols" },
  { label: "De-Escalation", href: "/training/scenarios", icon: "MessageCircle", keywords: "scenarios conflict" },
  { label: "State Laws", href: "/state-laws", icon: "Scale", keywords: "guard licensing" },
  { label: "Courses", href: "/courses", icon: "Video", keywords: "training courses" },
  { label: "Certifications", href: "/certifications", icon: "Award", keywords: "certs credentials" },
  { label: "Geo-Risk", href: "/geo-risk", icon: "MapPin", keywords: "crime data risk" },
  { label: "Site Assessment", href: "/site-assessment", icon: "ClipboardCheck", keywords: "security evaluation" },
  { label: "Invoices", href: "/invoices", icon: "FileText", keywords: "billing invoice" },
  { label: "Leave", href: "/time-off", icon: "CalendarOff", keywords: "time off vacation pto" },
  { label: "Forms", href: "/forms", icon: "FileText", keywords: "forms submissions reports" },
  { label: "Patrols", href: "/patrols", icon: "ScanLine", keywords: "checkpoints routes" },
  // Profile
  { label: "Profile", href: "/profile", icon: "User", keywords: "my profile account" },
  { label: "Notifications", href: "/notifications", icon: "Bell", keywords: "alerts updates" },
  // Command (manager+)
  { label: "Ops Planning", href: "/admin/events", icon: "Flag", keywords: "operations events planning", roles: ["owner", "admin", "manager"] },
  { label: "Personnel", href: "/admin/staff", icon: "UserCog", keywords: "staff management hr", roles: ["owner", "admin", "manager"] },
  { label: "Training Admin", href: "/admin/training", icon: "NotebookPen", keywords: "modules slides", roles: ["owner", "admin", "manager"] },
  { label: "HQ Config", href: "/admin/settings", icon: "Settings", keywords: "settings company organization", roles: ["owner", "admin"] },
  { label: "Mass Clock", href: "/scan", icon: "ScanLine", keywords: "qr scanner badge", roles: ["owner", "admin", "manager"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const role = activeCompany?.role;

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const filteredCommands = COMMANDS.filter((cmd) => {
    if (!cmd.roles) return true;
    return role && hasMinRole(role as CompanyRole, cmd.roles[cmd.roles.length - 1] as CompanyRole);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <Command className="rounded-lg" loop>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" />
            <Command.Input
              placeholder="Search pages..."
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {filteredCommands.map((cmd) => {
              const Icon = ICON_MAP[cmd.icon] ?? LayoutDashboard;
              return (
                <Command.Item
                  key={cmd.href}
                  value={`${cmd.label} ${cmd.keywords ?? ""}`}
                  onSelect={() => handleSelect(cmd.href)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{cmd.label}</span>
                </Command.Item>
              );
            })}
          </Command.List>
          <div className="border-t border-border/50 px-3 py-2 text-[10px] text-muted-foreground/60 flex items-center justify-between">
            <span>Navigate with <kbd className="rounded border border-border/50 px-1">↑↓</kbd> keys</span>
            <span><kbd className="rounded border border-border/50 px-1">↵</kbd> to open</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
