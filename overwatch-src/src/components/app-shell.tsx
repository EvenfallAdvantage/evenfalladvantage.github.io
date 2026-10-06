"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { AuthGuard } from "@/components/auth-guard";

// Loaded on demand so public routes (landing, login, apply, careers...) don't
// download the sidebar/topbar/nav and their data modules on first load.
const DashboardShell = dynamic(
  () => import("@/components/layout/dashboard-shell").then((m) => m.DashboardShell),
  { loading: () => <div className="min-h-screen bg-background" /> },
);

const PUBLIC_ROUTES = ["/login", "/register", "/verify", "/join", "/auth/callback", "/apply", "/health", "/careers", "/intake", "/report", "/auth/reset", "/auth/update-password"];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
