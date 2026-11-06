// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const save = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/supabase/db", () => ({ getIntegrationsConfig: vi.fn(async () => []), saveIntegrationConfig: (...a: unknown[]) => save(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import IntegrationsSection from "@/app/admin/settings/components/integrations-section";

afterEach(cleanup);

describe("write-only integration secrets", () => {
  it("does not offer an Airtable API key form", () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[
      { provider: "airtable", config: { base_id: "appX", table_name: "Staff", secret_keys_set: ["api_key"] } as unknown as Record<string, string>, is_active: true },
    ]} />);
    fireEvent.click(screen.getByText("Hiring & Onboarding"));
    expect(screen.queryByLabelText("API Key")).toBeNull();
    expect(screen.queryByTestId("integration-airtable")).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });
  it("WhatsApp is not available until it is server-side", () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[]} />);
    fireEvent.click(screen.getByText("Messaging & Alerts"));
    expect(screen.getByTestId("integration-whatsapp").textContent).toContain("Not available yet");
  });
});
