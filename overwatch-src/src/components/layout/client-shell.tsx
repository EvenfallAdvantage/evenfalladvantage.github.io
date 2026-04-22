"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { isClientRole, type CompanyRole } from "@/lib/permissions";
import { useEffect } from "react";
import {
  LayoutDashboard, MapPin, AlertTriangle, FileText, ClipboardList, LogOut, Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ErrorBoundary } from "@/components/error-boundary";

const CLIENT_NAV = [
  { title: "Overview", href: "/client", icon: LayoutDashboard },
  { title: "Operations", href: "/client/operations", icon: MapPin },
  { title: "Incidents", href: "/client/incidents", icon: AlertTriangle },
  { title: "Invoices", href: "/client/invoices", icon: FileText },
  { title: "Reports", href: "/client/reports", icon: ClipboardList },
];

/**
 * Shell layout for the client portal — simplified nav, read-only views.
 * Redirects non-client users back to the main dashboard.
 */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const user = useAuthStore((s) => s.user);
  const role = activeCompany?.role as CompanyRole | undefined;

  // Redirect non-client users to main dashboard
  useEffect(() => {
    if (role && !isClientRole(role)) {
      router.replace("/feed");
    }
  }, [role, router]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAuthStore.getState().clearSession();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-xl px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-bold">{activeCompany?.companyName ?? "Client Portal"}</p>
            <p className="text-[10px] text-muted-foreground">Client Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.firstName} {user?.lastName}</span>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Navigation tabs */}
      <nav className="fixed top-14 left-0 right-0 z-20 border-b border-border/50 bg-background/95 backdrop-blur-xl px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto max-w-5xl mx-auto py-2">
          {CLIENT_NAV.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/client" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.title}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="pt-[104px] pb-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
