import { BookOpen, FolderOpen, FileText, Video, Link as LinkIcon } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";

const KB_ITEMS = [
  { name: "*Employee Information", type: "folder", icon: FolderOpen },
  { name: "General Information Base", type: "folder", icon: FolderOpen },
  { name: "Guardian Online Training", type: "link", icon: LinkIcon },
  { name: "FireSafety1", type: "video", icon: Video },
  { name: "FireSafety2", type: "video", icon: Video },
  { name: "[SOP] Guard Card Online Traini...", type: "file", icon: FileText },
  { name: "The Guardian Team - 2023 Emp...", type: "file", icon: FileText },
];

export default function KnowledgeBasePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Field Manual</h1>
          <p className="text-sm text-muted-foreground">SOPs, protocols, and training materials</p>
        </div>

        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
            {KB_ITEMS.map((item) => (
              <div
                key={item.name}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">Select from the list to access content</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
