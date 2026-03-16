"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-items";
import { useAuthStore } from "@/stores/auth-store";
import { isSuperAdmin } from "@/lib/security/super-admin";
import type { NavItem } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  HelpCircle,
  MapPin,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Building2,
  Plus,
  Menu,
  AlertTriangle,
  Footprints,
  Target,
  FileText,
  Shield,
  Scale,
  Award,
  MessageCircle,
  BookOpen,
  Video,
  User,
  Compass,
  Briefcase,
  ClipboardCheck,
  Flag,
  UserCog,
  SlidersHorizontal,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
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
  HelpCircle,
  MapPin,
  BarChart3,
  Settings,
  Menu,
  AlertTriangle,
  Footprints,
  Target,
  FileText,
  Shield,
  Scale,
  Award,
  MessageCircle,
  BookOpen,
  Video,
  Compass,
  Briefcase,
  ClipboardCheck,
  Flag,
  UserCog,
  SlidersHorizontal,
  ShieldAlert,
};

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function isChildActive(item: NavItem, pathname: string): boolean {
  if (!item.children) return false;
  return item.children.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + "/")
  );
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeCompanyId, setActiveCompany, clearSession } = useAuthStore();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close flyout when clicking outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
      // Check if click was on one of the toggle buttons
      const clickedBtn = Object.values(btnRefs.current).some(b => b?.contains(e.target as Node));
      if (!clickedBtn) {
        setExpanded({});
        setFlyoutPos(null);
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  function toggleGroup(key: string, btnEl?: HTMLButtonElement | null) {
    const wasOpen = expanded[key];
    if (wasOpen) {
      setExpanded((prev) => ({ ...prev, [key]: false }));
      setFlyoutPos(null);
    } else {
      setExpanded((prev) => ({ ...prev, [key]: true }));
      // Position flyout next to the button for collapsed mode
      if (collapsed && btnEl) {
        const rect = btnEl.getBoundingClientRect();
        setFlyoutPos({ top: rect.top, left: rect.right + 8 });
      }
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearSession();
    router.push("/login");
    router.refresh();
  }

  const activeCompany = user?.companies.find(
    (c) => c.companyId === activeCompanyId
  );
  const userRole = activeCompany?.role ?? "staff";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border/50 bg-background/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Company Header — click logo to toggle sidebar */}
      <button
        onClick={onToggle}
        className="flex h-16 w-full items-center gap-3 border-b border-border/50 px-4 transition-colors hover:bg-accent/50"
      >
        {activeCompany?.companyLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeCompany.companyLogo}
            alt={activeCompany.companyName}
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-sm font-bold text-primary">
            {activeCompany?.companyName?.[0] ?? "O"}
          </div>
        )}
        {!collapsed && (
          <div className="flex min-w-0 flex-1 flex-col text-left">
            <span className="truncate text-sm font-semibold">
              {activeCompany?.companyName ?? "Overwatch"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {activeCompany?.role
                ? activeCompany.role.charAt(0).toUpperCase() +
                  activeCompany.role.slice(1)
                : ""}
            </span>
          </div>
        )}
        {!collapsed && (
          <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300" />
        )}
      </button>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) =>
                (!item.roles || item.roles.includes(userRole)) &&
                (!item.superAdminOnly || isSuperAdmin(user?.email))
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label || "main"} className="space-y-0.5">
                {section.label && !collapsed && (
                  <div className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 font-mono">
                    {section.label}
                  </div>
                )}
                {section.label && collapsed && (
                  <div className="my-2 mx-auto h-px w-6 bg-border/50" />
                )}
                {visibleItems.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const hasChildren = item.children && item.children.length > 0;
                  const childActive = hasChildren && isChildActive(item, pathname);
                  const isOpen = expanded[item.title] ?? childActive;
                  const isActive =
                    !hasChildren &&
                    (pathname === item.href ||
                      pathname.startsWith(item.href + "/"));

                  if (hasChildren) {
                    return (
                      <div key={item.title} className="relative">
                        <button
                          ref={(el) => { btnRefs.current[item.title] = el; }}
                          onClick={(e) => toggleGroup(item.title, e.currentTarget)}
                          className={cn(
                            "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                            childActive
                              ? "text-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                            collapsed && "justify-center px-2"
                          )}
                        >
                          {Icon && (
                            <Icon
                              className={cn(
                                "h-[18px] w-[18px] shrink-0 transition-colors",
                                childActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                          )}
                          {!collapsed && (
                            <>
                              <span className="truncate flex-1 text-left">{item.title}</span>
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
                                  isOpen && "rotate-90"
                                )}
                              />
                            </>
                          )}
                        </button>
                        {/* Expanded mode: inline children */}
                        {isOpen && !collapsed && (
                          <div className="ml-3 space-y-0.5 border-l border-border/40 pl-3 mt-0.5">
                            {item.children!.map((child) => {
                              const ChildIcon = ICON_MAP[child.icon];
                              const childIsActive =
                                pathname === child.href ||
                                pathname.startsWith(child.href + "/");
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={cn(
                                    "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                                    childIsActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                >
                                  {ChildIcon && (
                                    <ChildIcon
                                      className={cn(
                                        "h-4 w-4 shrink-0 transition-colors",
                                        childIsActive
                                          ? "text-primary"
                                          : "text-muted-foreground/70 group-hover:text-foreground"
                                      )}
                                    />
                                  )}
                                  <span className="truncate">{child.title}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                        {/* Collapsed mode: fixed flyout panel (escapes ScrollArea overflow) */}
                        {isOpen && collapsed && flyoutPos && (
                          <div
                            ref={flyoutRef}
                            className="fixed z-[9999] min-w-[180px] rounded-lg border border-border bg-popover p-1.5 shadow-xl"
                            style={{ top: flyoutPos.top, left: flyoutPos.left }}
                          >
                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{item.title}</p>
                            {item.children!.map((child) => {
                              const ChildIcon = ICON_MAP[child.icon];
                              const childIsActive =
                                pathname === child.href ||
                                pathname.startsWith(child.href + "/");
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={() => { setExpanded({}); setFlyoutPos(null); }}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                                    childIsActive
                                      ? "bg-primary/10 text-primary"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                  )}
                                >
                                  {ChildIcon && <ChildIcon className={cn("h-3.5 w-3.5 shrink-0", childIsActive ? "text-primary" : "text-muted-foreground/70")} />}
                                  <span>{child.title}</span>
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
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                      )}
                      {!collapsed && (
                        <span className="truncate">{item.title}</span>
                      )}
                      {!collapsed && item.badge && item.badge > 0 && (
                        <Badge
                          variant="default"
                          className="ml-auto h-5 min-w-5 px-1.5 text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User Footer */}
      <div className="border-t border-border/50 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 text-sm transition-colors hover:bg-accent outline-none",
              collapsed && "justify-center"
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex min-w-0 flex-1 flex-col text-left">
                  <span className="truncate text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email ?? user?.phone}
                  </span>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? "right" : "top"}
            align="start"
            className="w-56"
          >
            <div className="px-2 py-1.5 text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </div>
            <DropdownMenuSeparator />

            {user?.companies && user.companies.length > 1 && (
              <>
                {user.companies.map((company) => (
                  <DropdownMenuItem
                    key={company.companyId}
                    onClick={() => setActiveCompany(company.companyId)}
                    className="gap-2"
                  >
                    <Building2 className="h-4 w-4" />
                    <span className="truncate">{company.companyName}</span>
                    {company.companyId === activeCompanyId && (
                      <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem className="gap-2" onClick={() => router.push("/profile")}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2" onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              My Settings
            </DropdownMenuItem>

            {["owner", "admin"].includes(userRole) && (
              <DropdownMenuItem className="gap-2" onClick={() => router.push("/admin/settings")}>
                <Building2 className="h-4 w-4" />
                Company Settings
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2" onClick={() => router.push("/join")}>
              <Plus className="h-4 w-4" />
              Join Company
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Branding */}
      {!collapsed && (
        <div className="px-4 py-2 flex flex-col items-center space-y-1">
          <Image src="/images/overwatch_logo.png" alt="" width={24} height={24} className="h-6 w-auto opacity-40" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 font-mono">
            Overwatch
          </p>
          <p className="text-[8px] uppercase tracking-widest text-muted-foreground/30">
            Powered by Evenfall Advantage LLC
          </p>
        </div>
      )}
    </aside>
  );
}
