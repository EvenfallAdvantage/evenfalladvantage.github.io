import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function AdminEventsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
            <p className="text-sm text-muted-foreground">Plan and manage security operations</p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Operation
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Calendar className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No operations planned</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Create your first operation to start building shift schedules and deploying personnel.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
