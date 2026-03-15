import { Radio, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/dashboard-layout";

export default function ChatPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Comms</h1>
            <p className="text-sm text-muted-foreground">
              Secure channels and team communications
            </p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add new
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              All · Unread · Teams · Help Desk
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
                OC
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Open Chat</p>
                <p className="truncate text-xs text-muted-foreground">
                  No messages yet
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Radio className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a chat from the sidebar to start messaging
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
