"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { AuthGuard } from "@/components/auth-guard";

// Loaded on demand so public routes (landing, login, apply, careers...) don't
// download the sidebar/topbar/nav and their data modules on first load.
const loadDashboardShell = () => import("@/components/layout/dashboard-shell");
const DashboardShell = dynamic(
  () => loadDashboardShell().then((m) => m.DashboardShell),
  { loading: () => <div className="min-h-screen bg-background" /> },
);

const PUBLIC_ROUTES = ["/login", "/register", "/verify", "/join", "/auth/callback", "/apply", "/health", "/careers", "/intake", "/report", "/auth/reset", "/auth/update-password"];

function isPublicRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  // On app routes, start fetching the shell right after hydration, in
  // parallel with the auth check, instead of waiting for AuthGuard to render it.
  useEffect(() => {
    if (!isPublic) void loadDashboardShell();
  }, [isPublic]);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
