import { GraduationCap, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function QuizzesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drills</h1>
          <p className="text-sm text-muted-foreground">Training assessments and readiness checks</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
            <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white text-sm">
                📝
              </div>
              <span className="flex-1 truncate text-sm font-medium">
                Radio Protocol and best practices
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Select a quiz from the list</p>
            <p className="mt-1 text-xs text-muted-foreground">to fill and send</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
