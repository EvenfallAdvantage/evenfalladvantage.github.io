"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_ITEMS } from "./nav-items";
import {
  LayoutDashboard,
  Radio,
  Clock,
  AlertTriangle,
  Menu,
  type LucideIcon,
} from "lucide-react";

const MOBILE_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Radio,
  Clock,
  AlertTriangle,
  Menu,
};

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden safe-area-bottom">
      {MOBILE_NAV_ITEMS.map((item) => {
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
    </nav>
  );
}
