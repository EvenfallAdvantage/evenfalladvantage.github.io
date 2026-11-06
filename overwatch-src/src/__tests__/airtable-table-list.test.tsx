// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const BASE = "appOPERATIONS1234";
const EMPLOYEES = "tblEMPLOYEES12345";
const EVENTS = "tblEVENTS12345678";
const VENDORS = "tblVENDORS1234567";

const listTables = vi.fn(async (_companyId: string, baseId: string) => {
  expect(baseId).toBe(BASE);
  return [
    { id: EMPLOYEES, name: "Employees" },
    { id: EVENTS, name: "Events" },
    { id: VENDORS, name: "Vendors" },
  ];
});

vi.mock("@/lib/services/airtable-service", () => ({
  listAirtableBases: vi.fn(async () => [{ id: BASE, name: "Operations" }]),
  listAirtableTables: (...args: [string, string]) => listTables(...args),
  describeAirtableTable: vi.fn(async () => []),
  saveAirtableTable: vi.fn(),
  saveAirtableFieldMapping: vi.fn(),
  getAirtableFieldMapping: vi.fn(async () => ({ mapping: {}, confirmedAt: null })),
  previewAirtableApplicants: vi.fn(async () => ({ records: [], truncated: false })),
  previewAirtableSync: vi.fn(),
  syncAirtablePurpose: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import AirtableConnectionPanel from "@/app/admin/settings/components/airtable-connection-panel";

const connection = {
  id: "c1",
  company_id: "co",
  provider: "airtable",
  status: "connected" as const,
  auth_type: "oauth_code" as const,
  access_expires_at: null,
  external_account_id: null,
  external_account_name: "Airtable",
  settings: { base_id: BASE, base_name: "Operations", table_id: EMPLOYEES, table_name: "Employees" },
  last_test_at: null,
  last_test_ok: true,
  last_error: null,
  last_sync_at: null,
  last_webhook_at: null,
  refresh_failures: 0,
  updated_at: "2026-11-06T00:00:00Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function names(label: string): string[] {
  return [...(screen.getByLabelText(label) as HTMLSelectElement).options].map((option) => option.text);
}

describe("Airtable table dropdown", () => {
  it("does not replace the authorized table list with the saved Employees row", async () => {
    render(<AirtableConnectionPanel companyId="co" canManage connection={connection} onSaved={() => {}} />);
    expect(names("Applicants table")).toEqual(["Load bases to see every table"]);
    expect(screen.getByText(/Saved applicants table: Operations \/ Employees/)).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Events" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Load bases" }));
    await waitFor(() => expect(names("Applicants table")).toEqual(["Select a table", "Employees", "Events", "Vendors"]));
    expect((screen.getByLabelText("Applicants table") as HTMLSelectElement).value).toBe(EMPLOYEES);
    expect(names("Roster table")).toEqual(["Select a table", "Employees", "Events", "Vendors"]);
    expect(names("Ops Planning table")).toEqual(["Select a table", "Employees", "Events", "Vendors"]);
    expect((screen.getByLabelText("Roster table") as HTMLSelectElement).value).toBe(EMPLOYEES);
    expect((screen.getByLabelText("Ops Planning table") as HTMLSelectElement).value).toBe(EVENTS);
    expect(listTables).toHaveBeenCalledWith("co", BASE);
  });
});
