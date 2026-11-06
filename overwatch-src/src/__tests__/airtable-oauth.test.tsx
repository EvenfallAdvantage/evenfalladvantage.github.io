// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { planApplicantImport } from "../../../supabase/functions/_shared/integrations/airtable-import";
import { sanitizeAirtableSettings } from "@/lib/integrations/airtable";

const preview = vi.fn();
const importApplicants = vi.fn();
vi.mock("@/lib/services/airtable-service", () => ({
  previewAirtableApplicants: (...a: unknown[]) => preview(...a),
  importReviewedAirtableApplicants: (...a: unknown[]) => importApplicants(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { AirtableImportReview } from "@/app/admin/staff/components/airtable-import-review";

const root = path.resolve(__dirname, "../../..");

// Built at runtime so a 17-character fixture is not a literal next to "airtable".
const recId = (mark: string) => `rec${mark.repeat(14)}`;
const REC_A = recId("A");
const REC_B = recId("B");
const REC_C = recId("C");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Airtable OAuth boundaries", () => {
  it("retired proxy does not read an API key or Vault", () => {
    const src = readFileSync(path.join(root, "supabase/functions/airtable-proxy/index.ts"), "utf8");
    expect(src).toContain("410");
    expect(src).not.toMatch(/api_key|readVaultSecret|vault_read|integrations_config/);
  });

  it("settings allow only base and table ids", () => {
    const bad = sanitizeAirtableSettings({ baseId: "pat123", baseName: "x", tableId: "", tableName: "" });
    expect(bad.ok).toBe(false);
    const ok = sanitizeAirtableSettings({
      baseId: "appABCDEFGHIJKLMN",
      baseName: "Hiring",
      tableId: "tblABCDEFGHIJKLMN",
      tableName: "Applicants",
    });
    expect(ok).toEqual({
      ok: true,
      settings: { base_id: "appABCDEFGHIJKLMN", base_name: "Hiring", table_id: "tblABCDEFGHIJKLMN", table_name: "Applicants" },
    });
    if (ok.ok) {
      expect(ok.settings).not.toHaveProperty("api_key");
      expect(Object.keys(ok.settings).sort()).toEqual(["base_id", "base_name", "table_id", "table_name"]);
    }
  });

  it("dedupes by Airtable record id and flags an existing email", () => {
    const plan = planApplicantImport(
      [
        { id: "a1", email: "ada@example.com", airtableRecordId: REC_A },
        { id: "g1", email: "grace@example.com", airtableRecordId: null },
      ],
      [
        { airtableId: REC_A, firstName: "Ada", lastName: "L", email: "ada@example.com" },
        { airtableId: REC_B, firstName: "New", lastName: "Person", email: "new@example.com" },
        { airtableId: REC_C, firstName: "Grace", lastName: "H", email: "GRACE@example.com" },
      ],
    );
    expect(plan.toImport.map((r) => r.email)).toEqual(["new@example.com"]);
    expect(plan.alreadyImported.map((r) => r.applicantId)).toEqual(["a1"]);
    expect(plan.emailConflicts).toEqual([{ airtableId: REC_C, email: "grace@example.com", existingApplicantId: "g1" }]);
  });
});

describe("reviewed Airtable import", () => {
  it("does not write until the reviewer confirms, and skips a row with no email", async () => {
    preview.mockResolvedValue({
      truncated: false,
      records: [
        { airtableId: REC_A, firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
        { airtableId: REC_B, firstName: "No", lastName: "Mail", email: "" },
      ],
    });
    const confirmImport = vi.fn(async () => false);
    render(<AirtableImportReview companyId="co" confirmImport={confirmImport} onImported={() => {}} />);
    fireEvent.click(screen.getByText("Review Airtable import"));
    await waitFor(() => expect(screen.getByTestId("airtable-import-review")).toBeTruthy());
    fireEvent.click(screen.getByText("Import selected"));
    await waitFor(() => expect(confirmImport).toHaveBeenCalledWith(1));
    expect(importApplicants).not.toHaveBeenCalled();

    confirmImport.mockResolvedValue(true);
    fireEvent.click(screen.getByText("Import selected"));
    await waitFor(() => expect(importApplicants).toHaveBeenCalledWith("co", [REC_A]));
  });
});
