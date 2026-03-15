import { CalendarOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function TimeOffPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
            <p className="text-sm text-muted-foreground">Request and track leave days</p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Request Leave
          </Button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="text-sm font-semibold mb-3">Time off Policies</h3>
            <div className="flex flex-col items-center py-6 text-center">
              <CalendarOff className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">You are not assigned to any policy</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card p-6">
            <h3 className="text-sm font-semibold mb-3">Requests history</h3>
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-muted-foreground">No history to display</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
