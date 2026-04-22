"use client";

import { AlertTriangle, Clock, MapPin, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientShell } from "@/components/layout/client-shell";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { getIncidents } from "@/lib/supabase/db";
import { PageLoader } from "@/components/page-loader";

export default function ClientIncidentsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: incidents = [], isLoading } = useCompanyQuery<any[]>(
    "client-incidents", (cid) => getIncidents(cid)
  );

  const severityColors: Record<string, string> = {
    low: "bg-blue-500/15 text-blue-600",
    medium: "bg-amber-500/15 text-amber-600",
    high: "bg-orange-500/15 text-orange-600",
    critical: "bg-red-500/15 text-red-500",
  };

  const statusColors: Record<string, string> = {
    open: "bg-red-500/15 text-red-500",
    investigating: "bg-amber-500/15 text-amber-600",
    resolved: "bg-green-500/15 text-green-600",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <ClientShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold">Incident Reports</h1>
          <p className="text-sm text-muted-foreground">Security incidents reported at your sites</p>
        </div>

        {isLoading ? <PageLoader /> : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No incidents reported</p>
            <p className="mt-1 text-xs text-muted-foreground">Incident reports will appear here when filed by security staff.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc: { id: string; title: string; severity: string; status: string; type: string; location?: string; created_at: string; reported_user?: { first_name: string; last_name: string } }) => (
              <Card key={inc.id} className={inc.severity === "critical" ? "border-red-500/40" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm">{inc.title}</h3>
                    <Badge className={`text-[9px] ${severityColors[inc.severity] ?? ""}`}>{inc.severity}</Badge>
                    <Badge className={`text-[9px] ${statusColors[inc.status] ?? ""}`}>{inc.status}</Badge>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {inc.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(inc.created_at).toLocaleString()}
                    </span>
                    {inc.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {inc.location}
                      </span>
                    )}
                    {inc.reported_user && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {inc.reported_user.first_name} {inc.reported_user.last_name}
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
