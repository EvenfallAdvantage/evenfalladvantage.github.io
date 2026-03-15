import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function AdminReportsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Intel</h1>
          <p className="text-sm text-muted-foreground">Analytics, metrics, and operational intelligence</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No data to report yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Hours, compliance, attendance, and asset reports will populate as your team uses the platform.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
