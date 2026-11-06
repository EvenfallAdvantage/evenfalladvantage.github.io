"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RosterDiagnosticReport } from "@/lib/integrations/airtable-sync";

const PAGE = 20;

const OP_LABEL: Record<RosterDiagnosticReport["rows"][number]["op"], string> = {
  failure: "Write failed",
  conflict: "Conflict",
  skip: "Skipped",
  optional: "Optional field",
  held: "Removal held",
  protected: "Protected",
};

export function RosterSyncReport({ report }: { report: RosterDiagnosticReport | null }) {
  const [page, setPage] = useState(0);
  if (!report) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="roster-report-empty">
        No roster report is stored yet. A run from before this report was saved cannot be reconstructed.
      </p>
    );
  }
  const start = page * PAGE;
  const visible = report.rows.slice(start, start + PAGE);
  const last = Math.min(report.rows.length, start + PAGE);
  return (
    <section className="space-y-2 text-sm" data-testid="roster-sync-report">
      <p className="text-sm leading-5 text-foreground">{report.reconcile}</p>
      <p className="text-xs text-muted-foreground">
        {report.kind === "preview" ? "Preview only. Nothing has been written." : "This is the sync that just finished."}
        {" "}Rows listed: {report.rows.length} of {report.rowsTotal}.
        {report.rowsOmitted > 0 ? ` ${report.rowsOmitted} more were not stored.` : ""}
        {report.writeFailureTotal > report.writeFailuresListed ? ` Write-failure messages shown: ${report.writeFailuresListed} of ${report.writeFailureTotal}.` : ""}
      </p>
      {visible.length > 0 && (
        <ol className="space-y-1" start={start + 1}>
          {visible.map((row, index) => (
            <li key={`${row.op}-${row.airtableId}-${start + index}`} className="rounded border border-border/40 px-2 py-1.5">
              <p className="text-xs font-medium break-all">{row.airtableId || "No Airtable id"}</p>
              <p className="text-xs">{OP_LABEL[row.op]}: {row.reason}</p>
              {row.name ? <p className="text-xs text-muted-foreground">{row.name}</p> : null}
            </li>
          ))}
        </ol>
      )}
      {report.rows.length > PAGE && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <p className="text-xs text-muted-foreground">Showing {start + 1}–{last} of {report.rows.length}</p>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={last >= report.rows.length} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
