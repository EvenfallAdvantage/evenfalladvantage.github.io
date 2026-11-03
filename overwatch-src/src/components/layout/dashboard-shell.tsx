"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { QuickActionFab } from "./quick-action-fab";
import { MobileNav } from "./mobile-nav";
import { GlobalPanicListener } from "@/components/sos/global-panic-listener";
import { MobilePageAction } from "@/components/mobile-page-action";
import { usePageHeader } from "@/stores/page-header-store";
import { ErrorBoundary } from "@/components/error-boundary";
import { SyncIndicator } from "@/components/sync-indicator";
import { ServiceWorkerRegistration } from "@/components/sw-registration";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WhatsNewModal } from "@/components/updates/whats-new-modal";

const STORAGE_KEY = "overwatch-sidebar-collapsed";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const inlineActions = usePageHeader((s) => s.inlineActionHosts > 0);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === "true";
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Tablets (768–1023px) default to the icon rail so content isn't squeezed;
  // this state is separate so it never overwrites the desktop preference.
  const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const [tabletCollapsed, setTabletCollapsed] = useState(true);
  const railCollapsed = isTablet ? tabletCollapsed : collapsed;
  const toggleRail = () => (isTablet ? setTabletCollapsed((v) => !v) : setCollapsed(!collapsed));

  // The dashboard is a two-column command view, so it gets more width on big screens.
  const pathname = usePathname();
  const wideRoute = pathname?.replace(/\/$/, "") === "/feed";

  return (
    <TooltipProvider delay={0}>
      <div className="min-h-screen bg-background">
        {/* Skip navigation — WCAG 2.4.1 */}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg">
          Skip to main content
        </a>

        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar
            collapsed={railCollapsed}
            onToggle={toggleRail}
          />
        </div>

        {/* Topbar */}
        <Topbar sidebarCollapsed={railCollapsed} />

        {/* Main content */}
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "min-h-screen pb-32 transition-all duration-300 md:pb-0 outline-none",
            railCollapsed ? "md:pl-[68px]" : "md:pl-[260px]"
          )}
        >
          <div className={cn("mx-auto px-3 py-4 sm:p-6", wideRoute ? "max-w-[1680px]" : "max-w-7xl")}>
            {/* Mobile action button — right-aligned above page content */}
            {!inlineActions && (
              <div className="flex justify-end mb-2 sm:hidden">
                <MobilePageAction />
              </div>
            )}
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>

        {/* SOS alerts for supervisors on every page */}
        <GlobalPanicListener />

        {/* Mobile bottom nav */}
        <MobileNav />

        {/* Thumb-zone quick actions (phone) */}
        <QuickActionFab />

        {/* Offline sync indicator (only visible when there's something to show) */}
        <SyncIndicator />

        {/* Role-filtered What's New single roll-up modal */}
        <WhatsNewModal />

        {/* Service worker registration (mount-once, no UI). */}
        <ServiceWorkerRegistration />
      </div>
    </TooltipProvider>
  );
}
