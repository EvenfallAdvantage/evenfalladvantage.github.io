"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { AuthGuard } from "@/components/auth-guard";
import { MfaGate } from "@/components/security/mfa-gate";

// Loaded on demand so public routes (landing, login, apply, careers...) don't
// download the sidebar/topbar/nav and their data modules on first load.
const loadDashboardShell = () => import("@/components/layout/dashboard-shell");
const DashboardShell = dynamic(
  () => loadDashboardShell().then((m) => m.DashboardShell),
  { loading: () => <div className="min-h-screen bg-background" /> },
);

const PUBLIC_ROUTES = ["/login", "/register", "/verify", "/join", "/auth/callback", "/apply", "/health", "/careers", "/intake", "/client-intake", "/report", "/auth/reset", "/auth/update-password", "/status"];

export function isPublicRoute(rawPathname: string | null): boolean {
  // Collapse repeated slashes ("//status//" from a hand-typed or doubled link)
  // so the client agrees with the statically exported page. Otherwise the
  // client renders the signed-in shell over a public page -> React #418.
  const pathname = (rawPathname || "/").replace(/\/{2,}/g, "/");
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
      <MfaGate>
        <DashboardShell>{children}</DashboardShell>
      </MfaGate>
    </AuthGuard>
  );
}
