"use client";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AuthGuard } from "@/components/auth-guard";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
