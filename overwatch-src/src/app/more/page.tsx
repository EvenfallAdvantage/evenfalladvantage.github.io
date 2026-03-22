"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import { isSuperAdmin } from "@/lib/security/super-admin";
import { NAV_SECTIONS } from "@/components/layout/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Radar,
  Radio,
  Users,
  Clock,
  CalendarDays,
  CalendarOff,
  QrCode,
  ClipboardList,
  GraduationCap,
  School,
  Footprints,
  Target,
  BookOpen,
  Award,
  MapPin,
  Shield,
  Scale,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  Bell,
  Building2,
  Plus,
  MessageCircle,
  Video,
  HelpCircle,
  AlertTriangle,
  Compass,
  Briefcase,
  ClipboardCheck,
  Flag,
  UserCog,
  ShieldAlert,
  Activity,
  NotebookPen,
  ArrowRightLeft,
  Check,
  X,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, Radar, Radio, Users, Clock, CalendarDays, CalendarOff,
  QrCode, ClipboardList, GraduationCap, Footprints, Target, BookOpen, Award,
  MapPin, Shield, Scale, FileText, BarChart3, Settings, Bell, MessageCircle,
  Video, HelpCircle, AlertTriangle, Compass, Briefcase, ClipboardCheck,
  Flag, UserCog, ShieldAlert, Activity, NotebookPen, School,
};

export default function MorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, clearSession, activeCompanyId, setActiveCompany } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const userRole = activeCompany?.role ?? "staff";
  const hiddenTabs = new Set(activeCompany?.settings?.hiddenTabs ?? []);
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ Academy: true, Tools: true });
  const [showSwitcher, setShowSwitcher] = useState(false);
  const hasMultipleCompanies = (user?.companies?.length ?? 0) > 1;
  const toggle = (key: string) => setCollapsed((p) => ({ ...p, [key]: !p[key] }));

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="space-y-5">
        {/* User card */}
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 transition-colors active:bg-accent"
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-primary/20 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">
              {user?.firstName ?? "Your"} {user?.lastName ?? "Name"}
            </p>
            <p className="text-xs text-muted-foreground">View profile</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        {/* Dynamic nav sections from NAV_SECTIONS */}
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items
            .filter(
              (item) =>
                (!item.roles || item.roles.includes(userRole)) &&
                (!item.superAdminOnly || isSuperAdmin(user?.email)) &&
                !hiddenTabs.has(item.href)
            )
            .map((item) =>
              item.children
                ? { ...item, children: item.children.filter((c) => !hiddenTabs.has(c.href)) }
                : item
            )
            .filter((item) => !item.children || item.children.length > 0);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label || "main"}>
              {section.label && (
                <h3 className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 font-mono">
                  {section.label}
                </h3>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const hasChildren = item.children && item.children.length > 0;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                  if (hasChildren) {
                    const isOpen = !collapsed[item.title];
                    return (
                      <div key={item.title}>
                        <button
                          onClick={() => toggle(item.title)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 transition-colors active:bg-accent/30"
                        >
                          {Icon && <Icon className="h-4 w-4" />}
                          <span className="flex-1 text-left">{item.title}</span>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !isOpen && "-rotate-90")} />
                        </button>
                        {isOpen && (
                          <div className="space-y-0.5">
                            {item.children!.map((child) => {
                              const ChildIcon = ICON_MAP[child.icon];
                              const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent",
                                    childActive ? "bg-primary/10 text-primary" : "text-foreground"
                                  )}
                                >
                                  {ChildIcon && <ChildIcon className={cn("h-[18px] w-[18px]", childActive ? "text-primary" : "text-muted-foreground")} />}
                                  <span className="flex-1">{child.title}</span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent",
                        isActive ? "bg-primary/10 text-primary" : "text-foreground"
                      )}
                    >
                      {Icon && <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-primary" : "text-muted-foreground")} />}
                      <span className="flex-1">{item.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Notifications + Settings + Sign out */}
        <div className="border-t border-border/50 pt-4 space-y-0.5">
          <Link
            href="/notifications"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent"
          >
            <Bell className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1">Notifications</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </Link>
          {hasMinRole(userRole as CompanyRole, "admin") && (
            <Link
              href="/admin/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent"
            >
              <Building2 className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="flex-1">HQ Config</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </Link>
          )}
          {hasMultipleCompanies && (
            <button
              onClick={() => setShowSwitcher(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent"
            >
              <ArrowRightLeft className="h-[18px] w-[18px] text-muted-foreground" />
              <span className="flex-1 text-left">Switch Company</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </button>
          )}
          <Link
            href="/join"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors active:bg-accent"
          >
            <Plus className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1">Join Company</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors active:bg-destructive/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Company Switcher Modal */}
      {showSwitcher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSwitcher(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold">Switch Company</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Select an organization</p>
              </div>
              <button onClick={() => setShowSwitcher(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 space-y-1 max-h-64 overflow-auto">
              {user?.companies?.map((company) => {
                const isActive = company.companyId === activeCompanyId;
                return (
                  <button
                    key={company.companyId}
                    onClick={() => {
                      if (!isActive) {
                        setActiveCompany(company.companyId);
                        setShowSwitcher(false);
                        window.location.reload();
                      }
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                      isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-accent active:bg-accent/80 border border-transparent"
                    )}
                  >
                    {company.companyLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={company.companyLogo} alt={company.companyName} className="h-9 w-9 rounded-lg object-contain bg-muted/30 shrink-0" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold shrink-0">
                        {company.companyName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{company.companyName}</p>
                      <p className="text-[11px] text-muted-foreground capitalize">{company.role}</p>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
