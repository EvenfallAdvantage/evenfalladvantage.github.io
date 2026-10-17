// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const runIntegrationAction = vi.fn();
const startIntegrationOAuth = vi.fn();
const getIntegrationConnections = vi.fn();
vi.mock("@/lib/supabase/db", () => ({
  runIntegrationAction: (...a: unknown[]) => runIntegrationAction(...a),
  startIntegrationOAuth: (...a: unknown[]) => startIntegrationOAuth(...a),
  getIntegrationConnections: (...a: unknown[]) => getIntegrationConnections(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ConnectionCards from "@/app/admin/settings/components/connection-cards";
import IntegrationHealthStrip from "@/app/admin/settings/components/integration-health-strip";
import {
  CONNECTION_SELECT, FRAMEWORK_PROVIDERS, connectionBadge, connectionHealth, isMissingTableError, sinceLabel,
  type ConnectionProviderDef, type IntegrationConnection,
} from "@/lib/integrations/connections";

const NOW = new Date("2026-10-10T17:00:00Z");
const defs: ConnectionProviderDef[] = [
  { provider: "mock", label: "Mock Payroll", logo: null, desc: "Test vendor", connect: "oauth", webhookSilenceDays: 3 },
  { provider: "mockkey", label: "Mock Key", logo: null, desc: "Key vendor", connect: "key" },
];
const row = (o: Partial<IntegrationConnection> = {}): IntegrationConnection => ({
  id: "c1", company_id: "co", provider: "mock", status: "connected", auth_type: "oauth_code", access_expires_at: null,
  external_account_id: "acct_42", external_account_name: "Acme Security LLC", settings: {}, last_test_at: "2026-10-10T14:00:00Z",
  last_test_ok: true, last_error: null, last_sync_at: null, last_webhook_at: "2026-10-10T16:30:00Z", refresh_failures: 0,
  updated_at: "2026-10-10T16:00:00Z", ...o,
});

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); getIntegrationConnections.mockResolvedValue([]); });

describe("connection model", () => {
  it("maps statuses to the four badges and never shows Connected without a passing test", () => {
    expect(connectionBadge(row())).toBe("connected");
    expect(connectionBadge(row({ last_test_ok: null }))).toBe("attention");
    expect(connectionBadge(row({ last_test_ok: false }))).toBe("attention");
    expect(connectionBadge(row({ status: "pending", last_test_ok: true }))).toBe("pending");
    expect(connectionBadge(row({ status: "error" }))).toBe("attention");
    expect(connectionBadge(row({ status: "revoked" }))).toBe("disconnected");
    expect(connectionBadge(null)).toBe("disconnected");
  });

  it("never selects secret or lock columns", () => {
    for (const c of ["vault_secret_id", "refresh_lock_token", "refresh_lock_until"]) expect(CONNECTION_SELECT).not.toContain(c);
  });

  it("no vendor is live on the framework yet (vendor PRs add them)", () => {
    expect(FRAMEWORK_PROVIDERS).toEqual([]);
  });

  it("health: failing, refresh failures, untested, webhook silence; disconnected ignored", () => {
    const issues = connectionHealth([
      row({ provider: "mock", last_webhook_at: "2026-10-01T00:00:00Z", refresh_failures: 2, last_test_ok: null }),
      row({ id: "c2", provider: "mockkey", status: "error", last_error: "Token refresh failed" }),
      row({ id: "c3", provider: "other", status: "disconnected" }),
    ], defs, NOW);
    expect(issues.map((i) => `${i.provider}:${i.kind}`).sort()).toEqual(["mock:token_refresh", "mock:untested", "mock:webhook_silence", "mockkey:failing"]);
    expect(connectionHealth([row()], defs, NOW)).toEqual([]);
  });

  it("labels and missing-table detection", () => {
    expect(sinceLabel(null, NOW)).toBe("Never");
    expect(sinceLabel("2026-10-10T14:00:00Z", NOW)).toBe("3h ago");
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ code: "42501" })).toBe(false);
  });
});

describe("ConnectionCards", () => {
  it("renders nothing until a vendor is on the framework", () => {
    const { container } = render(<ConnectionCards companyId="co" canManage providers={[]} initialConnections={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows badge, account, last test/sync/webhook times and manage buttons for owners", () => {
    render(<ConnectionCards companyId="co" canManage providers={defs} initialConnections={[row()]} />);
    const card = screen.getByTestId("connection-mock");
    expect(card.textContent).toContain("Connected");
    expect(card.textContent).toContain("Acme Security LLC");
    expect(card.textContent).toContain("Last test");
    expect(card.textContent).toContain("Last sync");
    expect(card.textContent).toContain("Never");
    expect(card.textContent).toContain("Last webhook");
    expect(screen.getAllByText("Test connection")).toHaveLength(1);
    expect(screen.getByTestId("connection-mockkey").textContent).toContain("Disconnected");
    expect(screen.getByText("Enter key")).toBeTruthy();
  });

  it("pending and needs-attention states", () => {
    render(<ConnectionCards companyId="co" canManage providers={defs} initialConnections={[
      row({ status: "pending", last_test_ok: null }),
      row({ id: "c2", provider: "mockkey", status: "error", last_error: "Credentials were rejected" }),
    ]} />);
    expect(screen.getByTestId("connection-mock").textContent).toContain("Pending vendor approval");
    const bad = screen.getByTestId("connection-mockkey");
    expect(bad.textContent).toContain("Needs attention");
    expect(bad.textContent).toContain("Credentials were rejected");
  });

  it("managers are read-only: no buttons", () => {
    render(<ConnectionCards companyId="co" canManage={false} providers={defs} initialConnections={[row()]} />);
    expect(screen.queryByText("Test connection")).toBeNull();
    expect(screen.queryByText("Disconnect")).toBeNull();
    expect(screen.queryByText("Connect")).toBeNull();
    expect(screen.getAllByText(/Only owners and admins/)).toHaveLength(2);
  });

  it("Test connection calls integration-action and reloads", async () => {
    runIntegrationAction.mockResolvedValue({ ok: true });
    getIntegrationConnections.mockResolvedValue([row({ last_test_at: "2026-10-10T16:59:00Z" })]);
    render(<ConnectionCards companyId="co" canManage providers={defs} initialConnections={[row()]} />);
    fireEvent.click(screen.getByText("Test connection"));
    await waitFor(() => expect(getIntegrationConnections).toHaveBeenCalledWith("co"));
    expect(runIntegrationAction).toHaveBeenCalledWith("co", "mock", "test");
  });

  it("Connect starts OAuth through integration-oauth-start", async () => {
    startIntegrationOAuth.mockRejectedValue(new Error("This integration isn't configured on the platform yet"));
    render(<ConnectionCards companyId="co" canManage providers={defs} initialConnections={[]} />);
    fireEvent.click(screen.getByText("Connect"));
    await waitFor(() => expect(startIntegrationOAuth).toHaveBeenCalledWith("co", "mock"));
  });
});

describe("IntegrationHealthStrip", () => {
  it("empty, healthy and issue states", () => {
    const { rerender } = render(<IntegrationHealthStrip connections={[]} providers={defs} now={NOW} />);
    expect(screen.getByTestId("integration-health").textContent).toContain("No vendor connections yet");
    rerender(<IntegrationHealthStrip connections={[row()]} providers={defs} now={NOW} />);
    expect(screen.getByTestId("integration-health").textContent).toContain("All 1 vendor connection healthy");
    rerender(<IntegrationHealthStrip connections={[row({ status: "error", last_error: "boom" })]} providers={defs} now={NOW} />);
    expect(screen.getByTestId("integration-health").textContent).toContain("Mock Payroll: boom");
  });
});
