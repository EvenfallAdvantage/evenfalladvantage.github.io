import { ClipboardList, ChevronRight } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

const FORMS = [
  { name: "Incident Report Form", color: "bg-pink-500", icon: "📋" },
  { name: "Teachable Completion", color: "bg-pink-500", icon: "📋" },
  { name: "Guard Card Info", color: "bg-pink-500", icon: "📋" },
];

export default function FormsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Reports</h1>
          <p className="text-sm text-muted-foreground">Submit and track incident reports and forms</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
            {FORMS.map((form) => (
              <div
                key={form.name}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${form.color} text-white text-sm`}>
                  {form.icon}
                </div>
                <span className="flex-1 truncate text-sm font-medium">{form.name}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Select a Form to submit</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
