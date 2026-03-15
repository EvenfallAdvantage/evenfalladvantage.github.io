"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-items";
import { useAuthStore } from "@/stores/auth-store";
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
  ChevronsUpDown,
  LogOut,
  Building2,
  Plus,
  Bell,
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
  Search,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getUnreadNotificationCount } from "@/lib/supabase/db";

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
  Bell,
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
};

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeCompanyId, setActiveCompany, clearSession } = useAuthStore();

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

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    getUnreadNotificationCount(activeCompanyId).then(setUnreadCount).catch(() => {});
    const interval = setInterval(() => {
      getUnreadNotificationCount(activeCompanyId).then(setUnreadCount).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [activeCompanyId]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border/50 bg-background/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Company Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border/50 px-4">
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
          <div className="flex min-w-0 flex-1 flex-col">
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
        <Link
          href="/notifications"
          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            collapsed && "ml-0"
          )}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Search hint */}
      {!collapsed && (
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
          className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <Search className="h-3 w-3" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[9px] font-mono">Ctrl K</kbd>
        </button>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.roles || item.roles.includes(userRole)
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
                  const isActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");

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

            <DropdownMenuItem className="gap-2" onClick={() => router.push("/settings")}>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>

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
        <div className="px-4 py-2 text-center space-y-0.5">
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
