"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { connectionHealth, type ConnectionProviderDef, type IntegrationConnection } from "@/lib/integrations/connections";

interface Props {
  connections: IntegrationConnection[];
  providers: ConnectionProviderDef[];
  now?: Date;
}

/** Diagnostics: failing connections, refresh failures, webhook silence. */
export default function IntegrationHealthStrip({ connections, providers, now }: Props) {
  const active = connections.filter((c) => c.status !== "disconnected" && c.status !== "revoked");
  const issues = connectionHealth(connections, providers, now);
  if (active.length === 0) {
    return <p data-testid="integration-health" className="text-xs text-muted-foreground">No vendor connections yet.</p>;
  }
  if (issues.length === 0) {
    return (
      <p data-testid="integration-health" className="flex items-center gap-2 text-xs text-green-500">
        <CheckCircle2 className="h-4 w-4" /> All {active.length} vendor connection{active.length === 1 ? "" : "s"} healthy
      </p>
    );
  }
  return (
    <div data-testid="integration-health" role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1">
      <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" /> {issues.length} integration issue{issues.length === 1 ? "" : "s"}</p>
      <ul className="list-disc pl-6">
        {issues.map((i) => <li key={`${i.provider}:${i.kind}`}>{i.message}</li>)}
      </ul>
    </div>
  );
}
