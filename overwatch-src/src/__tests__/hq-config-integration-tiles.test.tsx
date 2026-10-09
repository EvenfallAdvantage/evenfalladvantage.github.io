// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

vi.mock("@/lib/supabase/db", () => ({ getIntegrationsConfig: vi.fn(async () => []), saveIntegrationConfig: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import IntegrationsSection, { INTEGRATION_PROVIDERS } from "@/app/admin/settings/components/integrations-section";

afterEach(cleanup);

describe("integration tiles", () => {
  it("drops duplicate/dead tiles", () => {
    const ids = INTEGRATION_PROVIDERS.map((p) => p.provider);
    for (const gone of ["twilio", "signal", "email"]) expect(ids).not.toContain(gone);
    expect(INTEGRATION_PROVIDERS.filter((p) => p.available).map((p) => p.provider).sort()).toEqual(["airtable", "whatsapp"]);
  });

  it("never shows Active for an unavailable vendor, keeps Airtable working", () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[
      { provider: "checkr", config: { api_key: "x" }, is_active: true },
      { provider: "airtable", config: { base_id: "app1" }, is_active: true },
    ]} />);
    fireEvent.click(screen.getByText("Hiring & Onboarding"));
    const checkr = screen.getByTestId("integration-checkr");
    expect(checkr.textContent).toContain("Not available yet");
    expect(checkr.textContent).not.toContain("Active");
    expect(checkr.querySelector("input")).toBeNull();
    expect(screen.getByTestId("integration-airtable").textContent).toContain("Active");
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
