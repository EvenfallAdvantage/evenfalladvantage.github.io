"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Radar, Radio, Users, Clock, AlertTriangle,
  Footprints, CalendarDays, QrCode, ClipboardList, GraduationCap,
  Target, MessageCircle, FileText, Shield, MapPin, Scale, BookOpen,
  Video, Award, CalendarOff, BarChart3, Settings, HelpCircle,
  Flag, UserCog, SlidersHorizontal, Building2, ShieldAlert, Activity,
  Search, Command, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Radar, Radio, Users, Clock, AlertTriangle,
  Footprints, CalendarDays, QrCode, ClipboardList, GraduationCap,
  Target, MessageCircle, FileText, Shield, MapPin, Scale, BookOpen,
  Video, Award, CalendarOff, BarChart3, Settings, HelpCircle,
  Flag, UserCog, SlidersHorizontal, Building2, ShieldAlert, Activity,
};

type PaletteItem = {
  title: string;
  href: string;
  icon: string;
  section: string;
};

const ALL_ITEMS: PaletteItem[] = [
  { title: "Dashboard", href: "/feed", icon: "LayoutDashboard", section: "Navigation" },
  { title: "Briefing", href: "/updates", icon: "Radar", section: "Navigation" },
  { title: "Comms", href: "/chat", icon: "Radio", section: "Comms" },
  { title: "Roster", href: "/directory", icon: "Users", section: "Comms" },
  { title: "Watch Log", href: "/timeclock", icon: "Clock", section: "Field Ops" },
  { title: "Reports", href: "/incidents", icon: "ClipboardList", section: "Field Ops" },
  { title: "Field Reports", href: "/forms", icon: "ClipboardList", section: "Field Ops" },
  { title: "Patrols", href: "/patrols", icon: "Footprints", section: "Field Ops" },
  { title: "Deployments", href: "/schedule", icon: "CalendarDays", section: "Field Ops" },
  { title: "Armory", href: "/assets", icon: "QrCode", section: "Field Ops" },
  { title: "Academy", href: "/academy", icon: "GraduationCap", section: "Readiness" },
  { title: "Field Manual", href: "/knowledge-base", icon: "BookOpen", section: "Readiness" },
  { title: "Drills", href: "/quizzes", icon: "Target", section: "Readiness" },
  { title: "De-Escalation", href: "/training/scenarios", icon: "MessageCircle", section: "Readiness" },
  { title: "Courses", href: "/courses", icon: "BookOpen", section: "Readiness" },
  { title: "Certifications", href: "/certifications", icon: "Award", section: "Readiness" },
  { title: "Geo-Risk", href: "/geo-risk", icon: "MapPin", section: "Readiness" },
  { title: "Site Assessment", href: "/site-assessment", icon: "Shield", section: "Readiness" },
  { title: "State Laws", href: "/state-laws", icon: "Scale", section: "Readiness" },
  { title: "Invoices", href: "/invoices", icon: "FileText", section: "Readiness" },
  { title: "Leave", href: "/time-off", icon: "CalendarOff", section: "Readiness" },
  { title: "Operations", href: "/admin/events", icon: "Flag", section: "Command" },
  { title: "Personnel", href: "/admin/staff", icon: "UserCog", section: "Command" },
  { title: "Training Admin", href: "/admin/training", icon: "SlidersHorizontal", section: "Command" },
  { title: "Question Bank", href: "/admin/questions", icon: "HelpCircle", section: "Command" },
  { title: "Intel Center", href: "/feed", icon: "Activity", section: "Command" },
  { title: "Security", href: "/admin/security", icon: "ShieldAlert", section: "Command" },
  { title: "Profile", href: "/profile", icon: "Users", section: "Account" },
  { title: "My Settings", href: "/settings", icon: "Settings", section: "Account" },
  { title: "HQ Config", href: "/admin/settings", icon: "Building2", section: "Account" },
  { title: "Notifications", href: "/notifications", icon: "Radar", section: "Account" },
  { title: "Join Company", href: "/join", icon: "Users", section: "Account" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? ALL_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.section.toLowerCase().includes(query.toLowerCase()) ||
          item.href.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const navigate = useCallback(
    (href: string) => {
      closePalette();
      router.push(href);
    },
    [closePalette, router]
  );

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
      if (e.key === "Escape" && open) {
        closePalette();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openPalette, closePalette]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-palette-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      navigate(filtered[selectedIndex].href);
    }
  }

  if (!open) return null;

  // Group by section
  const sections: Record<string, PaletteItem[]> = {};
  filtered.forEach((item) => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  let globalIndex = -1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={closePalette} />

      {/* Palette */}
      <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-lg rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, tools, commands..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              Object.entries(sections).map(([section, items]) => (
                <div key={section} className="mb-1">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    {section}
                  </p>
                  {items.map((item) => {
                    globalIndex++;
                    const idx = globalIndex;
                    const Icon = ICON_MAP[item.icon] || Command;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.href}
                        data-palette-item
                        onClick={() => navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                          isSelected ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left font-medium">{item.title}</span>
                        {isSelected && <ArrowRight className="h-3 w-3 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/50 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted px-1 text-[9px] font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted px-1 text-[9px] font-mono">↵</kbd>
                select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border/60 bg-muted px-1 text-[9px] font-mono">esc</kbd>
                close
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground/50 font-mono">OVERWATCH</span>
          </div>
        </div>
      </div>
    </>
  );
}
