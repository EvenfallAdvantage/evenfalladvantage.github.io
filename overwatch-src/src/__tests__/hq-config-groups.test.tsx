// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { DEFAULT_OT_CONFIG } from "@/lib/supabase/db-overtime";
import { DEFAULT_BREAK_POLICY } from "@/lib/supabase/db-breaks";
import type { ClientMember } from "@/lib/supabase/db-client-portal";

type SavedIntegration = {
  provider: string;
  config: Record<string, string>;
  is_active: boolean;
};

const db = vi.hoisted(() => ({
  updateCompany: vi.fn(),
  saveIntegrationConfig: vi.fn(),
  getIntegrationsConfig: vi.fn(async (): Promise<SavedIntegration[]> => []),
  getOvertimeConfig: vi.fn(async () => DEFAULT_OT_CONFIG),
  saveOvertimeConfig: vi.fn(),
  getCompanyDefaultRates: vi.fn(async () => ({ payRate: 22, billRate: 35 })),
  saveCompanyDefaultRates: vi.fn(),
  getBreakPolicy: vi.fn(async () => DEFAULT_BREAK_POLICY),
  saveBreakPolicy: vi.fn(),
  isClientRoleSupported: vi.fn(async () => true),
  getClientMembers: vi.fn(async (): Promise<ClientMember[]> => []),
  addClientMember: vi.fn(),
  removeClientMember: vi.fn(),
  setUser: vi.fn(),
  upsertMapping: vi.fn(),
  getCompanySettings: vi.fn(async () => ({})),
  updateCompanySettings: vi.fn(),
}));

const authState = {
  activeCompanyId: "c1",
  user: {
    id: "u1",
    companies: [{
      companyId: "c1",
      companyName: "Old",
      companyLogo: "https://x.co/l.png",
      brandColor: "#1d3451",
      accentColor: "#d59b3c",
      settings: {},
    }],
  },
  setUser: db.setUser,
  getActiveCompany: () => ({ companyId: "c1", role: "admin" }),
};

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: Object.assign(
    (sel?: (s: typeof authState) => unknown) => (typeof sel === "function" ? sel(authState) : authState),
    { getState: () => authState },
  ),
}));
vi.mock("@/lib/supabase/db", () => ({
  updateCompany: db.updateCompany,
  saveIntegrationConfig: db.saveIntegrationConfig,
  getIntegrationsConfig: db.getIntegrationsConfig,
  getOvertimeConfig: db.getOvertimeConfig,
  saveOvertimeConfig: db.saveOvertimeConfig,
  getCompanyDefaultRates: db.getCompanyDefaultRates,
  saveCompanyDefaultRates: db.saveCompanyDefaultRates,
  getBreakPolicy: db.getBreakPolicy,
  saveBreakPolicy: db.saveBreakPolicy,
  DEFAULT_OT_CONFIG,
  DEFAULT_BREAK_POLICY,
  isClientRoleSupported: db.isClientRoleSupported,
  getClientMembers: db.getClientMembers,
  addClientMember: db.addClientMember,
  removeClientMember: db.removeClientMember,
}));
vi.mock("@/lib/supabase/db-users", () => ({
  uploadCompanyLogo: vi.fn(),
  rotateCompanyJoinCode: vi.fn(),
  getCompanySettings: db.getCompanySettings,
  updateCompanySettings: db.updateCompanySettings,
}));
vi.mock("@/lib/supabase/db-api-keys", () => ({
  listApiKeys: vi.fn(async () => []),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getApiKeyUsage: vi.fn(),
}));
vi.mock("@/lib/supabase/db-intake-mappings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/db-intake-mappings")>();
  return { ...actual, listMappings: vi.fn(async () => []), upsertMapping: db.upsertMapping, deleteMapping: vi.fn() };
});
vi.mock("@/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({ confirm: () => Promise.resolve(true), ConfirmDialog: () => null }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { HqDisclosure } from "@/app/admin/settings/components/hq-disclosure";
import CompanyProfileSection from "@/app/admin/settings/components/company-profile-section";
import IntegrationsSection from "@/app/admin/settings/components/integrations-section";
import PayOvertimeSection from "@/app/admin/settings/components/pay-overtime-section";
import ClientPortalSection from "@/app/admin/settings/components/client-portal-section";
import ApiSourcesSection from "@/app/admin/settings/components/api-sources-section";

afterEach(cleanup);
beforeEach(() => {
  window.location.hash = "";
  Object.values(db).forEach((fn) => fn.mockClear());
  db.getIntegrationsConfig.mockResolvedValue([]);
  db.getBreakPolicy.mockResolvedValue(DEFAULT_BREAK_POLICY);
  db.getOvertimeConfig.mockResolvedValue(DEFAULT_OT_CONFIG);
  db.getCompanyDefaultRates.mockResolvedValue({ payRate: 22, billRate: 35 });
  db.isClientRoleSupported.mockResolvedValue(true);
  db.getClientMembers.mockResolvedValue([]);
  db.getCompanySettings.mockResolvedValue({});
  db.saveBreakPolicy.mockResolvedValue(undefined);
  db.saveIntegrationConfig.mockResolvedValue({});
  db.updateCompany.mockResolvedValue({});
});

function DraftBox() {
  const [note, setNote] = useState("keep-me");
  const [dirty, setDirty] = useState(false);
  return (
    <HqDisclosure title="Advanced settings" description="Optional details" forceOpen={dirty} testId="adv">
      <label htmlFor="note">Note</label>
      <input id="note" value={note} onChange={(e) => { setNote(e.target.value); setDirty(e.target.value !== "keep-me"); }} />
      <button type="button">Save note</button>
    </HqDisclosure>
  );
}

describe("HQ disclosure", () => {
  it("is a button, starts collapsed, and keeps a draft after collapse", () => {
    render(<DraftBox />);
    const trigger = screen.getByRole("button", { name: /Advanced settings/ });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger.getAttribute("aria-controls")).toBeTruthy();
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Note", hidden: true })).toHaveValue("keep-me");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "edited" } });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Unsaved changes stay open/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save note" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "keep-me" } });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("textbox", { name: "Note" })).toBeNull();
    const note = screen.getByLabelText("Note");
    const panel = note.closest("[hidden]");
    expect(panel).toBeInstanceOf(HTMLElement);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(note).toHaveValue("keep-me");
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "still here" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "keep-me" } });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Note")).toHaveValue("keep-me");
  });

  it("opens when the hash targets the frame or a field inside it, and ignores a section anchor", async () => {
    window.location.hash = "#hq-organization";
    const { unmount } = render(
      <HqDisclosure id="hq-company-logo" title="Logo and website" testId="logo">
        <label htmlFor="company-logo-url">Company Logo</label>
        <input id="company-logo-url" defaultValue="kept" />
      </HqDisclosure>,
    );
    const trigger = screen.getByRole("button", { name: /Logo and website/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById("hq-company-logo")?.getAttribute("data-hq-disclosure")).toBe("closed");
    unmount();

    window.location.hash = "#company-logo-url";
    render(
      <HqDisclosure id="hq-company-logo" title="Logo and website">
        <label htmlFor="company-logo-url">Company Logo</label>
        <input id="company-logo-url" defaultValue="kept" />
      </HqDisclosure>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Logo and website/ })).toHaveAttribute("aria-expanded", "true"));
    expect(document.getElementById("hq-company-logo")?.querySelector("[hidden]")).toBeNull();
    expect(screen.getByLabelText("Company Logo")).toHaveValue("kept");
    window.location.hash = "";
  });
});

describe("company profile stays editable and keeps the selected colors", () => {
  it("saves a cleared website without putting the form in a collapsed panel", async () => {
    render(
      <CompanyProfileSection
        companyId="c1"
        initialName="Old"
        initialTimezone="America/Los_Angeles"
        initialBrandColor="#080626"
        initialAccentColor="#22c55e"
        initialLogoUrl="https://x.co/l.png"
        initialWebsiteUrl="https://old.example.com"
        joinCode="ABC123"
        canRotateJoinCode
      />,
    );
    const name = screen.getByLabelText("Company Name");
    const primary = screen.getByLabelText(/Primary Color/i);
    const accent = screen.getByLabelText(/Accent Color/i);
    const logo = screen.getByRole("button", { name: /Logo and website/ });
    expect(name.closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText(/Timezone/i).closest("[hidden]")).toBeNull();
    expect(primary).toHaveValue("#080626");
    expect(accent).toHaveValue("#22c55e");
    expect(screen.getByTestId("hq-brand-preview").closest("[hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: /^Save$/ }).closest("[hidden]")).toBeNull();
    expect(logo).toHaveAttribute("aria-expanded", "false");
    expect(logo.textContent).toMatch(/Logo on file/);
    expect(logo.textContent).toMatch(/(?:^|[^\w.])old\.example\.com(?:$|[^\w.])/);
    expect(screen.getByLabelText(/Company Website/i).closest("[hidden]")).toBeTruthy();

    fireEvent.click(logo);
    fireEvent.change(screen.getByLabelText(/Company Website/i), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/Company Logo/i), { target: { value: "https://cdn.example.com/mark.png" } });
    fireEvent.click(logo);
    expect(logo).toHaveAttribute("aria-expanded", "false");
    expect(logo.textContent).toMatch(/unsaved edits kept/);
    const website = screen.getByLabelText(/Company Website/i);
    const logoUrl = screen.getByLabelText(/Company Logo/i);
    expect(website.closest("[hidden]")).toBeTruthy();
    expect(logoUrl.closest("[hidden]")).toBeTruthy();
    expect(website).toHaveValue("");
    expect(logoUrl).toHaveValue("https://cdn.example.com/mark.png");
    fireEvent.change(name, { target: { value: "  New Co " } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(db.updateCompany).toHaveBeenCalled());
    expect(db.updateCompany.mock.calls[0][1]).toMatchObject({
      name: "New Co",
      websiteUrl: null,
      logoUrl: "https://cdn.example.com/mark.png",
      brandColor: "#080626",
      accentColor: "#22c55e",
    });
  });

  it("does not read localStorage for brand colors or copy a stored company id into the preview", () => {
    localStorage.setItem("companyId", "00000000-0000-4000-8000-000000000099");
    localStorage.setItem("overwatch:brand", JSON.stringify({ brandColor: "#ff0000", accentColor: "#00ff00", logoUrl: "https://evil.example/logo.png", apiKey: "sekret" }));
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <CompanyProfileSection
        companyId="c1"
        initialName="Old"
        initialTimezone="America/Los_Angeles"
        initialBrandColor="#080626"
        initialAccentColor="#22c55e"
        initialLogoUrl=""
        initialWebsiteUrl=""
        joinCode="ABC123"
      />,
    );
    const primary = screen.getByTestId("hq-brand-preview-primary");
    expect(primary.getAttribute("style") ?? "").toMatch(/080626/i);
    expect(primary.getAttribute("style") ?? "").not.toMatch(/ff0000/i);
    expect(screen.getByTestId("hq-brand-preview").innerHTML).not.toContain("sekret");
    expect(screen.getByTestId("hq-brand-preview").innerHTML).not.toContain("evil.example");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    localStorage.clear();
  });

  it("only uses a parsed http(s) logo address as the image source", () => {
    const props = {
      companyId: "c1",
      initialName: "Old",
      initialTimezone: "America/Los_Angeles",
      initialBrandColor: "#080626",
      initialAccentColor: "#22c55e",
      initialWebsiteUrl: "",
      joinCode: "ABC123",
    };
    const { unmount } = render(
      <CompanyProfileSection {...props} initialLogoUrl="javascript:alert(1)" />,
    );
    expect(document.querySelector("img")).toBeNull();
    unmount();
    render(
      <CompanyProfileSection {...props} initialLogoUrl="https://cdn.example.com/mark.png?x=1&y=2" />,
    );
    expect(document.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example.com/mark.png?x=1&y=2");
  });
});

describe("external integration groups", () => {
  it("collapses unavailable groups and exposes them with the group button", () => {
    render(<IntegrationsSection companyId="c" initialIntegrations={[]} />);
    const hiring = screen.getByRole("button", { name: /Hiring & Onboarding/ });
    const messaging = screen.getByRole("button", { name: /Messaging & Alerts/ });
    const payroll = screen.getByRole("button", { name: /Payroll & Finance/ });
    for (const button of [messaging, hiring, payroll]) expect(button).toHaveAttribute("aria-expanded", "false");
    expect(messaging.compareDocumentPosition(hiring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hiring.compareDocumentPosition(payroll) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("integration-whatsapp").closest("[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(messaging);
    expect(messaging).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("integration-whatsapp").closest("[aria-hidden='true']")).toBeNull();
    expect(screen.getByTestId("integration-whatsapp").textContent).toContain("Not available yet");
    expect(screen.getByTestId("integration-whatsapp").textContent).not.toContain("Auto-invite");
    expect(screen.getByTestId("integration-whatsapp").textContent).not.toMatch(/Saved|Enabled/);
    fireEvent.click(payroll);
    expect(payroll).toHaveAttribute("aria-expanded", "true");
    expect(messaging).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("integration-whatsapp").closest("[aria-hidden='true']")).toBeTruthy();
    fireEvent.click(messaging);
    expect(messaging).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("integration-whatsapp").closest("[aria-hidden='true']")).toBeNull();
    fireEvent.click(messaging);
    expect(screen.getByTestId("integration-whatsapp").closest("[aria-hidden='true']")).toBeTruthy();
  });

  it("keeps an in-progress vendor form and its Save control open, then saves", async () => {
    render(
      <IntegrationsSection
        companyId="c"
        initialIntegrations={[]}
        groups={[{
          id: "hiring",
          label: "Hiring & Onboarding",
          desc: "Background checks",
          items: [{
            provider: "checkr",
            available: true,
            label: "Checkr",
            logo: null,
            desc: "Background checks",
            fields: [{ key: "package_slug", label: "Default Package", type: "text", placeholder: "tasker_standard" }],
          }],
        }]}
      />,
    );
    const group = screen.getByRole("button", { name: /Hiring & Onboarding/ });
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /^Save$/ })).toBeNull();
    fireEvent.click(group);
    fireEvent.change(screen.getByLabelText("Default Package"), { target: { value: "tasker_standard" } });
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Default Package")).toHaveValue("tasker_standard");
    db.getIntegrationsConfig.mockResolvedValue([{ provider: "checkr", config: { package_slug: "tasker_standard" }, is_active: false }]);
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(db.saveIntegrationConfig).toHaveBeenCalledWith(
      "c",
      "checkr",
      { package_slug: "tasker_standard" },
      false,
    ));
    await waitFor(() => expect(group).not.toHaveTextContent(/Unsaved changes/));
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(group);
    expect(screen.getByLabelText("Default Package")).toHaveValue("tasker_standard");
  });

  it("labels a saved enabled vendor as saved and enabled, and does not save when the group collapses", async () => {
    render(
      <IntegrationsSection
        companyId="c"
        initialIntegrations={[{ provider: "checkr", config: { package_slug: "tasker_standard" }, is_active: true }]}
        groups={[{
          id: "hiring",
          label: "Hiring & Onboarding",
          desc: "Background checks",
          items: [{
            provider: "checkr",
            available: true,
            label: "Checkr",
            logo: null,
            desc: "Background checks",
            fields: [
              { key: "package_slug", label: "Default Package", type: "text" },
              { key: "api_key", label: "API Key", type: "password" },
            ],
          }, {
            provider: "fillout",
            available: false,
            label: "Fillout",
            logo: null,
            desc: "Applications",
            fields: [{ key: "webhook_secret", label: "Webhook Secret", type: "password" }],
          }],
        }, {
          id: "payroll",
          label: "Payroll & Finance",
          desc: "Payroll",
          items: [{
            provider: "gusto",
            available: false,
            label: "Gusto",
            logo: null,
            desc: "Payroll",
            fields: [],
          }],
        }]}
      />,
    );
    const hiring = screen.getByRole("button", { name: /Hiring & Onboarding/ });
    expect(hiring.textContent).toMatch(/1 saved/);
    expect(hiring.textContent).toMatch(/1 enabled/);
    expect(hiring.textContent).toMatch(/1 not available/);
    fireEvent.click(hiring);
    const checkr = screen.getByTestId("integration-checkr");
    expect(checkr.textContent).toContain("Saved");
    expect(checkr.textContent).toContain("Enabled");
    expect(checkr.textContent).not.toContain("Active");
    expect(checkr.textContent).not.toContain("Configured");
    const fillout = screen.getByTestId("integration-fillout");
    expect(fillout.textContent).toContain("Not available yet");
    expect(fillout.textContent).not.toMatch(/Saved|Enabled/);
    expect(fillout.querySelector("input")).toBeNull();
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sekret-value" } });
    fireEvent.click(screen.getByRole("button", { name: /Payroll & Finance/ }));
    expect(hiring).toHaveAttribute("aria-expanded", "true");
    expect(db.saveIntegrationConfig).not.toHaveBeenCalled();
    expect(screen.getByLabelText("API Key")).toHaveValue("sekret-value");
  });
});

describe("pay break details", () => {
  it("keeps default rates visible, summarizes saved overtime and breaks, and saves edits made inside a collapsed panel", async () => {
    render(<PayOvertimeSection companyId="c1" />);
    const saveBreak = await screen.findByRole("button", { name: /Save break policy/ });
    const saveOt = screen.getByRole("button", { name: /Save overtime rules/ });
    expect(saveBreak.closest("[hidden]")).toBeNull();
    expect(saveOt.closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText(/Default pay rate/i).closest("[hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: /Save rates/ }).closest("[hidden]")).toBeNull();

    const ot = screen.getByRole("button", { name: /Overtime rules/ });
    expect(ot).toHaveAttribute("aria-expanded", "false");
    expect(ot.textContent).toMatch(/Federal \(FLSA\)/);
    expect(ot.textContent).toMatch(/40 hrs\/week/);
    expect(screen.queryByRole("spinbutton", { name: /OT after \(hrs\/week\)/i })).toBeNull();

    const breaks = screen.getByRole("button", { name: /Break policy/ });
    expect(breaks).toHaveAttribute("aria-expanded", "false");
    expect(breaks.textContent).toMatch(/California \(CA Labor Code\)/);
    expect(breaks.textContent).toMatch(/break buttons on/);
    expect(breaks.textContent).toMatch(/meal 30 min unpaid/);
    expect(breaks.textContent).toMatch(/rest 10 min paid/);
    expect(screen.queryByRole("spinbutton", { name: /Meal duration/i })).toBeNull();

    fireEvent.click(ot);
    fireEvent.change(screen.getByLabelText(/OT after \(hrs\/week\)/i), { target: { value: "36" } });
    fireEvent.click(ot);
    expect(ot).toHaveAttribute("aria-expanded", "false");
    expect(ot.textContent).toMatch(/unsaved edits kept/);
    expect(screen.getByRole("spinbutton", { name: /OT after \(hrs\/week\)/i, hidden: true })).toHaveValue(36);
    fireEvent.click(saveOt);
    await waitFor(() => expect(db.saveOvertimeConfig).toHaveBeenCalled());
    expect(db.saveOvertimeConfig.mock.calls[0][1]).toMatchObject({ weeklyThreshold: 36 });

    fireEvent.click(breaks);
    fireEvent.change(screen.getByLabelText(/Meal duration/i), { target: { value: "45" } });
    fireEvent.click(breaks);
    expect(breaks).toHaveAttribute("aria-expanded", "false");
    expect(breaks.textContent).toMatch(/unsaved edits kept/);
    expect(screen.getByRole("spinbutton", { name: /Meal duration/i, hidden: true })).toHaveValue(45);
    fireEvent.click(saveBreak);
    await waitFor(() => expect(db.saveBreakPolicy).toHaveBeenCalled());
    expect(db.saveBreakPolicy.mock.calls[0][1]).toMatchObject({ mealBreakMinutes: 45 });
  });
});

describe("client portal", () => {
  it("stays collapsed until needed and will not cover an address being added", async () => {
    db.getClientMembers.mockResolvedValue([{
      id: "m1", userId: "u2", email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", callsign: null, status: "active", createdAt: "",
    }]);
    render(<ClientPortalSection companyId="c1" />);
    const trigger = await screen.findByRole("button", { name: /Client portal/ });
    await waitFor(() => expect(trigger.textContent).toMatch(/1 client/));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Add Client/ })).toBeNull();
    fireEvent.click(trigger);
    expect(screen.getByRole("button", { name: /Remove Ada Lovelace/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Client Email"), { target: { value: "new@client.test" } });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Add Client/ })).toBeTruthy();
    expect(screen.getByLabelText("Client Email")).toHaveValue("new@client.test");
  });
});

describe("API sources advanced blocks", () => {
  it("keeps key creation and lead alerts visible, and mapping Save visible while a row is unsaved", async () => {
    db.upsertMapping.mockResolvedValue({ id: "m1", source_field: "fullName", canonical_field: "client_name" });
    render(<ApiSourcesSection companyId="c1" userId="u1" />);
    await screen.findByLabelText("Create API Key");
    expect(screen.getByLabelText(/Addresses/i).closest("[hidden]")).toBeNull();
    const mappings = screen.getByRole("button", { name: /Field mappings/ });
    const docs = screen.getByRole("button", { name: /Integration guide/ });
    const tester = screen.getByRole("button", { name: /Test a payload/ });
    expect(mappings).toHaveAttribute("aria-expanded", "false");
    expect(docs).toHaveAttribute("aria-expanded", "false");
    expect(tester).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(tester);
    const sample = screen.getByLabelText("Sample JSON");
    const original = (sample as HTMLTextAreaElement).value;
    fireEvent.change(sample, { target: { value: '{"name":"Edited"}' } });
    fireEvent.click(tester);
    expect(tester).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(tester);
    expect(screen.getByLabelText("Sample JSON")).toHaveValue('{"name":"Edited"}');
    fireEvent.change(screen.getByLabelText("Sample JSON"), { target: { value: original } });
    fireEvent.click(docs);
    expect(docs).toHaveAttribute("aria-expanded", "true");
    expect(tester).toHaveAttribute("aria-expanded", "false");
    const hiddenSample = screen.getByLabelText("Sample JSON");
    expect(hiddenSample.closest("[hidden]")).toBeTruthy();
    expect(hiddenSample).toHaveValue(original);

    fireEvent.click(mappings);
    fireEvent.change(screen.getByLabelText("Your form field"), { target: { value: "fullName" } });
    fireEvent.click(mappings);
    expect(mappings).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(within(screen.getByTestId("hq-field-mappings")).getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(db.upsertMapping).toHaveBeenCalledWith({
      companyId: "c1",
      sourceField: "fullName",
      canonicalField: "client_name",
    }));
    expect(await screen.findByText("fullName")).toBeTruthy();
  });
});
