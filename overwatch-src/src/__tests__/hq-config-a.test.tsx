// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { normalizeHttpUrl, HQ_SECTIONS } from "@/lib/hq-config";

describe("normalizeHttpUrl()", () => {
  it("empty clears the field", () => {
    expect(normalizeHttpUrl("   ")).toEqual({ ok: true, value: null });
  });
  it("adds https:// when the scheme is missing", () => {
    expect(normalizeHttpUrl("evenfalladvantage.com")).toEqual({ ok: true, value: "https://evenfalladvantage.com/" });
  });
  it("keeps http and https", () => {
    expect(normalizeHttpUrl("http://a.co/x")).toEqual({ ok: true, value: "http://a.co/x" });
  });
  it("rejects javascript: and data: URLs", () => {
    expect(normalizeHttpUrl("javascript:alert(1)").ok).toBe(false);
    expect(normalizeHttpUrl("data:text/html,hi").ok).toBe(false);
  });
  it("rejects hosts without a dot", () => {
    expect(normalizeHttpUrl("notaurl").ok).toBe(false);
  });
});

describe("HQ_SECTIONS", () => {
  it("has unique ids", () => {
    const ids = HQ_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ── CompanyProfileSection: clearing + store refresh + join-code rotation ── */
const db = vi.hoisted(() => ({
  updateCompany: vi.fn(),
  uploadCompanyLogo: vi.fn(),
  rotateCompanyJoinCode: vi.fn(),
  setUser: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/lib/supabase/db", () => ({ updateCompany: db.updateCompany }));
vi.mock("@/lib/supabase/db-users", () => ({ uploadCompanyLogo: db.uploadCompanyLogo, rotateCompanyJoinCode: db.rotateCompanyJoinCode }));
vi.mock("sonner", () => ({ toast: { error: db.toastError, success: db.toastSuccess } }));
vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: { id: "u1", companies: [{ companyId: "c1", companyName: "Old", companyLogo: "https://x.co/l.png", brandColor: "#000000", accentColor: "#ffffff" }] },
    setUser: db.setUser,
  }),
}));
vi.mock("@/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({ confirm: () => Promise.resolve(true), ConfirmDialog: () => null }),
}));

import CompanyProfileSection from "@/app/admin/settings/components/company-profile-section";

function renderProfile(over: Partial<React.ComponentProps<typeof CompanyProfileSection>> = {}) {
  return render(
    <CompanyProfileSection
      companyId="c1"
      initialName="Old"
      initialTimezone="America/Los_Angeles"
      initialBrandColor="#1d3451"
      initialAccentColor="#d59b3c"
      initialLogoUrl="https://x.co/l.png"
      initialWebsiteUrl="https://old.example.com"
      joinCode="ABC123"
      canRotateJoinCode
      {...over}
    />,
  );
}

describe("CompanyProfileSection", () => {
  beforeEach(() => { Object.values(db).forEach((f) => f.mockReset()); });

  it("sends null to clear website and logo, and refreshes the session copy", async () => {
    db.updateCompany.mockResolvedValue({});
    renderProfile();
    fireEvent.change(screen.getByLabelText(/Company Website/i), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Remove logo"));
    fireEvent.change(screen.getByLabelText("Company Name"), { target: { value: "  New Co " } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(db.updateCompany).toHaveBeenCalled());
    expect(db.updateCompany.mock.calls[0][1]).toMatchObject({ name: "New Co", websiteUrl: null, logoUrl: null });
    await waitFor(() => expect(db.setUser).toHaveBeenCalled());
    expect(db.setUser.mock.calls[0][0].companies[0]).toMatchObject({ companyName: "New Co", companyLogo: null });
  });

  it("blocks a javascript: website", async () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText(/Company Website/i), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(db.toastError).toHaveBeenCalled());
    expect(db.updateCompany).not.toHaveBeenCalled();
  });

  it("rotates the join code", async () => {
    db.rotateCompanyJoinCode.mockResolvedValue("ZZZ999");
    renderProfile();
    fireEvent.click(screen.getByRole("button", { name: /New code/ }));
    await screen.findByText("ZZZ999");
    expect(db.rotateCompanyJoinCode).toHaveBeenCalledWith("c1");
  });

  it("hides rotation when not allowed", () => {
    renderProfile({ canRotateJoinCode: false });
    expect(screen.queryByRole("button", { name: /New code/ })).toBeNull();
  });
});
