// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HQ_BLOCK_ORDER, HQ_SECTIONS } from "@/lib/hq-config";

let role = "admin";

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({
    activeCompanyId: "c1",
    user: { id: "u1" },
    getActiveCompany: () => ({ companyId: "c1", role }),
  }),
}));

vi.mock("@/lib/supabase/db", () => ({
  getCompanyDetails: vi.fn(async () => ({
    name: "Acme",
    timezone: "UTC",
    brand_color: "#1d3451",
    accent_color: "#d59b3c",
    logo_url: "",
    website_url: "",
    settings: { hiddenTabs: [] },
  })),
  getCompanyJoinCode: vi.fn(async () => "JOIN1"),
  getTimeOffPolicies: vi.fn(async () => []),
  getIntegrationsConfig: vi.fn(async () => []),
  getIntegrationConnections: vi.fn(async () => []),
}));

vi.mock("@/app/admin/settings/components/company-profile-section", () => ({ default: () => <div>profile</div> }));
vi.mock("@/app/admin/settings/components/feature-visibility-section", () => ({ default: () => <div>features</div> }));
vi.mock("@/app/admin/settings/components/leave-policies-section", () => ({ default: () => <div>leave</div> }));
vi.mock("@/app/admin/settings/components/pay-overtime-section", () => ({ default: () => <div>pay</div> }));
vi.mock("@/app/admin/settings/components/client-portal-section", () => ({ default: () => <div>clients</div> }));
vi.mock("@/app/admin/settings/components/incident-config-section", () => ({ default: () => <div>incidents</div> }));
vi.mock("@/app/admin/settings/components/radio-state-section", () => ({ default: () => <div>radio</div> }));
vi.mock("@/app/admin/settings/components/delivery-channels-section", () => ({ default: () => <div>delivery</div> }));
vi.mock("@/app/admin/settings/components/connection-cards", () => ({ default: () => <div>connections</div> }));
vi.mock("@/app/admin/settings/components/airtable-connection-panel", () => ({ default: () => <div>airtable</div> }));
vi.mock("@/app/admin/settings/components/integrations-section", () => ({ default: () => <div>external</div> }));
vi.mock("@/app/admin/settings/components/api-sources-section", () => ({ default: () => <div>api</div> }));
vi.mock("@/app/admin/settings/components/integration-health-strip", () => ({ default: () => <div>health</div> }));
vi.mock("@/app/admin/settings/components/error-log-viewer", () => ({ default: () => <div>logs</div> }));

import AdminSettingsPage from "@/app/admin/settings/page";
import { getIntegrationsConfig } from "@/lib/supabase/db";

afterEach(cleanup);

describe("HQ Config group order", () => {
  beforeEach(() => {
    role = "admin";
    vi.mocked(getIntegrationsConfig).mockReset();
    vi.mocked(getIntegrationsConfig).mockResolvedValue([]);
  });

  it("lists each jump-bar section once, in the same order as the blocks", () => {
    expect(HQ_BLOCK_ORDER.map((g) => g.section)).toEqual(HQ_SECTIONS.map((s) => s.id));
    const ids = HQ_BLOCK_ORDER.flatMap((g) => [...g.blocks]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("renders blocks in that order and keeps the jump bar", async () => {
    render(<AdminSettingsPage />);
    await screen.findByRole("navigation", { name: "HQ Config sections" });
    const links = screen.getAllByRole("link").map((a) => a.textContent);
    expect(links).toEqual(HQ_SECTIONS.map((s) => s.label));
    const rendered = [...document.querySelectorAll("[data-hq-block]")].map((el) => el.getAttribute("data-hq-block"));
    expect(rendered).toEqual(HQ_BLOCK_ORDER.flatMap((g) => [...g.blocks]));
    expect(screen.getByText("profile")).toBeTruthy();
    expect(screen.getByText("leave").compareDocumentPosition(screen.getByText("pay")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("delivery").compareDocumentPosition(screen.getByText("airtable")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides credential forms when integrations fail to load", async () => {
    vi.mocked(getIntegrationsConfig).mockRejectedValue(new Error("offline"));
    render(<AdminSettingsPage />);
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(/hidden to avoid overwriting/);
    expect(document.querySelector('[data-hq-block="external-integrations"]')).toBeNull();
    expect(screen.queryByText("airtable")).toBeNull();
    expect(screen.queryByText("external")).toBeNull();
  });

  it("keeps HQ Config closed to people who are not admins or owners", () => {
    role = "staff";
    render(<AdminSettingsPage />);
    expect(screen.getByText("Access Restricted")).toBeTruthy();
    expect(document.querySelector("[data-hq-block]")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "HQ Config sections" })).toBeNull();
  });
});
