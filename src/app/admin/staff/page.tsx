import { UserCog, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function AdminStaffPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
            <p className="text-sm text-muted-foreground">Manage team members and assignments</p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Invite Staff
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search staff..." className="pl-9" />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <UserCog className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No personnel registered</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Recruit team members to get started. They can join using a company code or direct invite link.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
