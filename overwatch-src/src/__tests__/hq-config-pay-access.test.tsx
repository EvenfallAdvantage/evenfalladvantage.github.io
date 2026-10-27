// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

let role = "manager";
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ activeCompanyId: "c1", getActiveCompany: () => ({ id: "c1", role }) }),
}));
vi.mock("@/components/layout/page-shell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/app/admin/settings/components/pay-overtime-section", () => ({ default: () => <div>PAY-SECTION</div> }));
import PaySettingsPage from "@/app/admin/settings/pay/page";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: (...a: unknown[]) => rpc(...a), from: vi.fn() }) }));
vi.mock("@/lib/supabase/db-users", () => ({ updateCompanySettings: vi.fn() }));
import { saveOvertimeConfig, DEFAULT_OT_CONFIG } from "@/lib/supabase/db-overtime";
import { saveBreakPolicy, DEFAULT_BREAK_POLICY } from "@/lib/supabase/db-breaks";
import { updateCompanySettings } from "@/lib/supabase/db-users";

afterEach(cleanup);

describe("pay & overtime access", () => {
  it.each([["owner", true], ["admin", true], ["instructor", true], ["manager", true], ["lead", false], ["staff", false]])("%s can edit: %s", (r, ok) => {
    role = r as string;
    render(<PaySettingsPage />);
    expect(!!screen.queryByText("PAY-SECTION")).toBe(ok);
    if (!ok) expect(screen.getByText("Access Restricted")).toBeTruthy();
  });

  it("saves through the manager+ RPC", async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await saveOvertimeConfig("c1", DEFAULT_OT_CONFIG);
    expect(rpc).toHaveBeenCalledWith("set_company_overtime_config", { p_company_id: "c1", p_config: DEFAULT_OT_CONFIG });
    expect(updateCompanySettings).not.toHaveBeenCalled();
  });
  it("falls back to the direct update before the migration exists", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } });
    await saveOvertimeConfig("c1", DEFAULT_OT_CONFIG);
    expect(updateCompanySettings).toHaveBeenCalledWith("c1", { overtime_config: DEFAULT_OT_CONFIG });
  });
  it("surfaces a permission error instead of falling back", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "42501", message: "no" } });
    await expect(saveOvertimeConfig("c1", DEFAULT_OT_CONFIG)).rejects.toMatchObject({ code: "42501" });
  });

  it("saves break policy through set_company_break_policy RPC and falls back when missing", async () => {
    vi.mocked(updateCompanySettings).mockClear();
    rpc.mockResolvedValueOnce({ error: null });
    await saveBreakPolicy("c1", DEFAULT_BREAK_POLICY);
    expect(rpc).toHaveBeenCalledWith("set_company_break_policy", { p_company_id: "c1", p_config: DEFAULT_BREAK_POLICY });
    expect(updateCompanySettings).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } });
    await saveBreakPolicy("c1", DEFAULT_BREAK_POLICY);
    expect(updateCompanySettings).toHaveBeenCalledWith("c1", { break_policy: DEFAULT_BREAK_POLICY });
  });
});
