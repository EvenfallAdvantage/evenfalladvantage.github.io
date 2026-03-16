"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { MobileNav } from "./mobile-nav";

const STORAGE_KEY = "overwatch-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>

      {/* Topbar */}
      <Topbar sidebarCollapsed={collapsed} />

      {/* Main content */}
      <main
        className={cn(
          "min-h-screen pt-14 sm:pt-16 pb-20 transition-all duration-300 md:pb-0",
          collapsed ? "md:pl-[68px]" : "md:pl-[260px]"
        )}
      >
        <div className="mx-auto max-w-7xl px-3 py-4 sm:p-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
