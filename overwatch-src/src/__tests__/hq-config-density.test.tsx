// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const db = vi.hoisted(() => ({
  getIncidentTypes: vi.fn(async () => [{
    id: "t1", companyId: "c1", key: "theft", label: "Theft", color: "#111111", icon: null,
    sortOrder: 0, isActive: true, createdAt: "", updatedAt: "",
  }]),
  getIncidentStatuses: vi.fn(async () => [{
    id: "s1", companyId: "c1", key: "closed", label: "Closed", color: "#222222",
    sortOrder: 0, isTerminal: true, createdAt: "", updatedAt: "",
  }]),
  getIncidentFields: vi.fn(async () => []),
  createIncidentType: vi.fn(async (_companyId: string, params: { key: string; label: string }) => {
    void params;
    return "t2";
  }),
  updateIncidentType: vi.fn(async () => true),
  deleteIncidentType: vi.fn(async () => true),
  createIncidentStatus: vi.fn(async () => "s2"),
  updateIncidentStatus: vi.fn(async () => true),
  deleteIncidentStatus: vi.fn(async () => true),
  createIncidentField: vi.fn(async () => "f1"),
  updateIncidentField: vi.fn(async () => true),
  deleteIncidentField: vi.fn(async () => true),
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel?: (s: { getActiveCompany: () => { companyId: string; role: string } }) => unknown) => {
    const state = { getActiveCompany: () => ({ companyId: "c1", role: "manager" }) };
    return typeof sel === "function" ? sel(state) : state;
  },
}));
vi.mock("@/lib/supabase/db", () => db);
vi.mock("@/hooks/use-confirm-dialog", () => ({
  useConfirmDialog: () => ({ confirm: () => Promise.resolve(true), ConfirmDialog: () => null }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import IncidentConfigSection from "@/app/admin/settings/components/incident-config-section";

afterEach(cleanup);
beforeEach(() => {
  Object.values(db).forEach((fn) => fn.mockClear());
});

describe("incident configuration disclosures", () => {
  it("collapses types, statuses, and fields with counts, and keeps an add draft plus delete", async () => {
    render(<IncidentConfigSection companyId="c1" />);
    const types = await screen.findByRole("button", { name: /Incident types/ });
    const statuses = screen.getByRole("button", { name: /Incident statuses/ });
    const fields = screen.getByRole("button", { name: /Custom fields/ });
    expect(screen.getByRole("heading", { name: "Incident Configuration" }).closest("[hidden]")).toBeNull();
    for (const button of [types, statuses, fields]) expect(button).toHaveAttribute("aria-expanded", "false");
    expect(types.textContent).toMatch(/1 of 1 enabled/);
    expect(statuses.textContent).toMatch(/1 status/);
    expect(statuses.textContent).toMatch(/1 close an incident/);
    expect(fields.textContent).toMatch(/No custom questions yet/);
    expect(screen.getByLabelText("New type name").closest("[hidden]")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete Theft" })).toBeNull();
    expect(document.getElementById("hq-incident-types")?.getAttribute("data-hq-disclosure")).toBe("closed");

    fireEvent.click(types);
    fireEvent.change(screen.getByLabelText("New type name"), { target: { value: "Noise complaint" } });
    fireEvent.click(types);
    expect(types).toHaveAttribute("aria-expanded", "false");
    const typeName = screen.getByLabelText("New type name");
    expect(typeName.closest("[hidden]")).toBeTruthy();
    expect(typeName).toHaveValue("Noise complaint");
    fireEvent.click(types);
    fireEvent.click(screen.getByRole("button", { name: /Add type/ }));
    await waitFor(() => expect(db.createIncidentType).toHaveBeenCalled());
    expect(db.createIncidentType.mock.calls[0][1]).toMatchObject({ label: "Noise complaint", key: "noise_complaint" });

    fireEvent.click(screen.getByRole("button", { name: "Delete Theft" }));
    await waitFor(() => expect(db.deleteIncidentType).toHaveBeenCalledWith("t1"));
    expect(db.deleteIncidentStatus).not.toHaveBeenCalled();
    expect(db.deleteIncidentField).not.toHaveBeenCalled();
  });
});
