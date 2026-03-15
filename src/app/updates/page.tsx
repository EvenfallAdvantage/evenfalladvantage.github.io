import { Siren } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function UpdatesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">
            Priority alerts and operational announcements
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Siren className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No dispatches yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Priority alerts, announcements, and operational bulletins will appear here.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
