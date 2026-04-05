"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { useEffect, useState } from "react";
import { getUnreadNotificationCount } from "@/lib/supabase/db";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const { title, subtitle, icon, actions } = usePageHeader();

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    const refresh = () => getUnreadNotificationCount(activeCompanyId).then(setUnreadCount).catch(() => {});
    refresh();
    const interval = setInterval(refresh, 60000);
    const onRead = () => refresh();
    window.addEventListener("notifications-read", onRead);
    return () => { clearInterval(interval); window.removeEventListener("notifications-read", onRead); };
  }, [activeCompanyId]);

  const companyInitial = activeCompany?.companyName?.charAt(0)?.toUpperCase() ?? "O";

  return (
    <>
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b border-border/50 bg-background/80 px-3 sm:px-6 backdrop-blur-xl transition-all duration-300",
        sidebarCollapsed ? "left-[68px]" : "left-[260px]",
        "max-md:left-0"
      )}
    >
      {/* Mobile: company avatar + name */}
      <div className="flex items-center gap-2 min-w-0 md:hidden">
        {activeCompany?.companyLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeCompany.companyLogo} alt={activeCompany.companyName} className="h-7 w-7 rounded-lg object-contain bg-muted/30 shrink-0" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
            {companyInitial}
          </div>
        )}
        {!title && activeCompany?.companyName && (
          <span className="text-xs font-semibold truncate max-w-[140px]">{activeCompany.companyName}</span>
        )}
      </div>

      {/* Page title + subtitle (fills the header space) */}
      {title && (
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {icon && <span className="text-primary shrink-0">{icon}</span>}
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold font-mono uppercase tracking-tight truncate leading-tight">{title}</h1>
            {subtitle && <p className="text-[10px] text-muted-foreground truncate leading-tight">{subtitle}</p>}
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Page-specific action buttons — full in topbar on desktop */}
      {actions && <div className="hidden sm:flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>

    {/* Mobile FAB — floating action button above mobile nav */}
    {actions && (
      <div className="fixed bottom-20 right-4 z-40 sm:hidden [&_button]:shadow-lg [&_button]:shadow-primary/25 [&_button]:rounded-full [&_button]:h-11 [&_button]:min-w-11 [&_button]:text-xs">
        {actions}
      </div>
    )}
    </>
  );
}
