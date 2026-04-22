"use client";

import { MapPin, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientShell } from "@/components/layout/client-shell";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getEvents } from "@/lib/supabase/db";
import { PageLoader } from "@/components/page-loader";

export default function ClientOperationsPage() {
  const { data: events = [], isLoading } = useCompanyQuery(
    "client-events", (cid) => getEvents(cid)
  );

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-blue-500/15 text-blue-600",
    in_progress: "bg-green-500/15 text-green-600",
    completed: "bg-slate-500/15 text-slate-500",
    cancelled: "bg-red-500/15 text-red-500",
  };

  return (
    <ClientShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Operations</h1>
          <p className="text-sm text-muted-foreground">Security operations assigned to your organization</p>
        </div>

        {isLoading ? <PageLoader /> : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No operations yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Operations will appear here once your security provider sets them up.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev: { id: string; name: string; status: string; start_date: string; end_date: string; location?: string; client_name?: string }) => (
              <Card key={ev.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{ev.name}</h3>
                    <Badge className={`text-[10px] ${statusColors[ev.status] ?? ""} capitalize`}>
                      {ev.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(ev.start_date).toLocaleDateString()} — {new Date(ev.end_date).toLocaleDateString()}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {ev.location}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClientShell>
  );
}
