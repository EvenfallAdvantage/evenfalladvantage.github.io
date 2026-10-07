// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const save = vi.fn(async (..._a: unknown[]) => ({}));
vi.mock("@/lib/supabase/db", () => ({ getIntegrationsConfig: vi.fn(async () => []), saveIntegrationConfig: (...a: unknown[]) => save(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import IntegrationsSection from "@/app/admin/settings/components/integrations-section";

afterEach(cleanup);

describe("write-only integration secrets", () => {
  it("never prefills a secret and shows it is saved", async () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[
      { provider: "airtable", config: { base_id: "appX", table_name: "Staff", secret_keys_set: ["api_key"] } as unknown as Record<string, string>, is_active: true },
    ]} />);
    fireEvent.click(screen.getByText("Hiring & Onboarding"));
    const key = screen.getByLabelText("API Key") as HTMLInputElement;
    expect(key.value).toBe("");
    expect(key.placeholder).toMatch(/Saved/);
    expect((screen.getByLabelText("Base ID") as HTMLInputElement).value).toBe("appX");
    fireEvent.click(screen.getByTestId("integration-airtable").querySelector("button[type=submit]")!);
    await vi.waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][2]).not.toHaveProperty("api_key");
    expect(save.mock.calls[0][2]).not.toHaveProperty("secret_keys_set");
  });
  it("WhatsApp is not available until it is server-side", () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[]} />);
    fireEvent.click(screen.getByText("Messaging & Alerts"));
    expect(screen.getByTestId("integration-whatsapp").textContent).toContain("Not available yet");
  });
});
