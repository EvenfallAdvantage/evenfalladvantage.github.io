"use client";

/**
 * /admin/settings/pay: Pay & Overtime for managers and above. The full HQ
 * Config page is owner/admin only, so managers reach these settings here
 * (Personnel → Timesheets link, command palette).
 */
import Link from "next/link";
import { ArrowLeft, DollarSign, Loader2, Lock } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { useAuthStore } from "@/stores/auth-store";
import { hasMinRole } from "@/lib/permissions";
import PayOvertimeSection from "../components/pay-overtime-section";

export default function PaySettingsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canEdit = !!activeCompany && hasMinRole(activeCompany.role, "manager");
  const isAdminPlus = ["owner", "admin"].includes(activeCompany?.role ?? "");

  return (
    <PageShell title="PAY & OVERTIME" subtitle="Default rates and overtime rules" icon={<DollarSign className="h-5 w-5" />}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href={isAdminPlus ? "/admin/settings" : "/admin/staff"} className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:min-h-0">
          <ArrowLeft className="h-3.5 w-3.5" /> {isAdminPlus ? "HQ Config" : "Personnel"}
        </Link>
        {!activeCompany || !activeCompanyId ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !canEdit ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Lock className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Access Restricted</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">Only managers, admins and owners can change pay and overtime settings.</p>
          </div>
        ) : (
          <PayOvertimeSection companyId={activeCompanyId} />
        )}
      </div>
    </PageShell>
  );
}
