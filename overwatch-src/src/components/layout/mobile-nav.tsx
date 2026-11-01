"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_ITEMS, OFFICER_MOBILE_NAV_ITEMS, OFFICER_ROLES, navPathname } from "./nav-items";
import { useAuthStore, useActiveCompany } from "@/stores/auth-store";
import { SosButton } from "@/components/sos/sos-button";
import {
  LayoutDashboard,
  Radio,
  Clock,
  AlertTriangle,
  Menu,
  Footprints,
  type LucideIcon,
} from "lucide-react";

const MOBILE_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Radio,
  Clock,
  AlertTriangle,
  Menu,
  Footprints,
};

export function MobileNav() {
  const pathname = navPathname(usePathname());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useActiveCompany();
  const role = activeCompany?.role ?? "";
  const hiddenTabs = new Set(activeCompany?.settings?.hiddenTabs ?? []);
  const isOfficer = (OFFICER_ROLES as readonly string[]).includes(role);
  // Officers get Clock / Patrol / Report / Chat / More. If the company has
  // switched off Patrols, fall back to the standard nav.
  const navItems =
    isOfficer && !hiddenTabs.has("/patrols") ? OFFICER_MOBILE_NAV_ITEMS : MOBILE_NAV_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden safe-area-bottom">
      {navItems.map((item) => {
        const Icon = MOBILE_ICON_MAP[item.icon];
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1 text-[10px] font-medium rounded-lg transition-colors active:bg-accent/50",
              isActive
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive && "text-primary"
                )}
              />
            )}
            <span className="leading-none">{item.title}</span>
          </Link>
        );
      })}

      {/* SOS: press and hold (never a single tap) */}
      {activeCompanyId && <SosButton companyId={activeCompanyId} />}
    </nav>
  );
}
