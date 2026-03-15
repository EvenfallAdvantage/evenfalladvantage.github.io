"use client";

import { Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface TopbarProps {
  sidebarCollapsed: boolean;
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl transition-all duration-300",
        sidebarCollapsed ? "left-[68px]" : "left-[260px]",
        "max-md:left-0"
      )}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search anything..."
          className="h-9 w-full rounded-lg border border-border/50 bg-muted/50 pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-background focus:ring-1 focus:ring-primary/20"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        {/* Company badge - mobile only */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5 md:hidden">
          <div className="h-5 w-5 rounded bg-primary/20 text-[10px] font-bold text-primary flex items-center justify-center">
            {activeCompany?.companyName?.[0] ?? "O"}
          </div>
          <span className="text-xs font-medium truncate max-w-[100px]">
            {activeCompany?.companyName ?? "Overwatch"}
          </span>
        </div>
      </div>
    </header>
  );
}
