"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect, useState } from "react";
import { getUnreadNotificationCount } from "@/lib/supabase/db";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

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

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b border-border/50 bg-background/80 px-3 sm:px-6 backdrop-blur-xl transition-all duration-300",
        sidebarCollapsed ? "left-[68px]" : "left-[260px]",
        "max-md:left-0"
      )}
    >
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Notifications — real link with live count */}
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
  );
}
