// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RosterSyncReport } from "@/components/integrations/roster-sync-report";
import type { RosterDiagnosticReport } from "@/lib/integrations/airtable-sync";

afterEach(cleanup);

function report(rows: RosterDiagnosticReport["rows"]): RosterDiagnosticReport {
  return {
    kind: "sync",
    rawRead: 624,
    seen: 624,
    valid: 301,
    invalidId: 0,
    duplicateRecord: 0,
    duplicateEmail: 2,
    localConflict: 1,
    conflict: 3,
    missingEmail: 20,
    missingFirstName: 1,
    missingRequired: 21,
    create: 41,
    attach: 0,
    link: 260,
    update: 0,
    unchanged: 0,
    remove: 0,
    held: 0,
    protected: 3,
    pages: 7,
    truncated: false,
    cap: 1000,
    removalHold: null,
    writeFailures: { create: 0, attach: 0, link: 1, update: 0, remove: 0 },
    writeFailureTotal: 1,
    writeFailuresListed: 1,
    rows,
    rowsTotal: rows.length,
    rowsOmitted: 0,
    reconcile: "Airtable returned 624 records across 7 pages (cap 1000).",
  };
}

describe("roster sync report", () => {
  it("pages the row list and keeps the accounting visible", () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      airtableId: `rec${String(index).padStart(14, "A")}`,
      op: "skip" as const,
      reason: index === 0 ? "No valid email, so this row was not added" : "Required first name is missing",
      name: index === 3 ? "Ada Lovelace" : "",
    }));
    render(<RosterSyncReport report={report(rows)} />);
    expect(screen.getByText(/returned 624 records/)).toBeTruthy();
    expect(screen.getByText("Showing 1–20 of 25")).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText(/@/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Showing 21–25 of 25")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("says an older run cannot be reconstructed", () => {
    render(<RosterSyncReport report={null} />);
    expect(screen.getByTestId("roster-report-empty").textContent).toMatch(/cannot be reconstructed/);
  });
});
