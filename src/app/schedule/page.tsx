import { CalendarDays } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function SchedulePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deployments</h1>
          <p className="text-sm text-muted-foreground">Your assigned shifts and upcoming operations</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No active deployments</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Your assigned shifts and available operations will appear here on a calendar view.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
