"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MOBILE_NAV_ITEMS } from "./nav-items";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Radio,
  Clock,
  AlertTriangle,
  Menu,
  ShieldAlert,
  Loader2,
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
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [sosFiring, setSosFiring] = useState(false);

  async function handleSOS() {
    if (!activeCompanyId || sosFiring) return;
    setSosFiring(true);
    try {
      const { triggerPanicAlert } = await import("@/lib/supabase/db-panic");
      const alertId = await triggerPanicAlert(activeCompanyId);
      if (alertId) {
        toast.success("SOS alert sent. Help is on the way.", { duration: 8000 });
      } else {
        toast.error("Failed to send SOS alert. Try again.");
      }
    } catch {
      toast.error("SOS alert failed. Try calling your supervisor directly.");
    } finally {
      setSosFiring(false);
    }
  }

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

      {/* SOS Panic Button — always visible on mobile */}
      {activeCompanyId && (
        <button
          onClick={handleSOS}
          disabled={sosFiring}
          className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] px-2 py-1 text-[10px] font-bold rounded-lg transition-colors text-red-500 active:bg-red-500/20"
          aria-label="Emergency SOS alert"
        >
          {sosFiring ? (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
          ) : (
            <ShieldAlert className="h-5 w-5 shrink-0" />
          )}
          <span className="leading-none">SOS</span>
        </button>
      )}
    </nav>
  );
}
