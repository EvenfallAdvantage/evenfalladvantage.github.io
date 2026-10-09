import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/db", () => ({}));
import { draftToFields } from "@/app/admin/settings/components/leave-policies-section";

const base = { name: "PTO", type: "vacation", accrualRate: "", accrualPeriod: "", maxBalance: "", isPaid: true };
describe("leave policy draft", () => {
  it("requires a name and valid numbers", () => {
    expect(draftToFields({ ...base, name: " " })).toMatch(/name/);
    expect(draftToFields({ ...base, maxBalance: "x" })).toMatch(/Cap/);
    expect(draftToFields({ ...base, accrualRate: "1" })).toMatch(/often/);
  });
  it("maps to fields", () => {
    expect(draftToFields({ ...base, accrualRate: "0.0333", accrualPeriod: "per_hour_worked", maxBalance: "48" })).toEqual({
      name: "PTO", type: "vacation", accrualRate: 0.0333, accrualPeriod: "per_hour_worked", maxBalance: 48, isPaid: true,
    });
  });
});
