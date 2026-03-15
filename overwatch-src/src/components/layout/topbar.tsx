"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
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
    getUnreadNotificationCount(activeCompanyId).then(setUnreadCount).catch(() => {});
    const interval = setInterval(() => {
      getUnreadNotificationCount(activeCompanyId).then(setUnreadCount).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [activeCompanyId]);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl transition-all duration-300",
        sidebarCollapsed ? "left-[68px]" : "left-[260px]",
        "max-md:left-0"
      )}
    >
      {/* Search — triggers command palette */}
      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))}
        className="relative flex-1 max-w-md flex items-center gap-2 h-9 rounded-lg border border-border/50 bg-muted/50 px-3 text-sm text-muted-foreground/60 transition-colors hover:bg-muted/80 hover:border-primary/30 cursor-pointer"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left">Search anything...</span>
        <kbd className="hidden sm:inline-block rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground font-mono">
          Ctrl K
        </kbd>
      </button>

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
