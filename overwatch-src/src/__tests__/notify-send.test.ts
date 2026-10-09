import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseNotifyRequest, authorize, notificationEmailHtml, smsText } from "../../../supabase/functions/notify-send/rules";

const CO = "0f03bc15-0000-4000-8000-000000000001";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("notify-send rules", () => {
  it("validates notification bodies", () => {
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["email"], user_ids: [U1], title: "Hi" })).toMatchObject({ kind: "notification", user_ids: [U1] });
    expect(parseNotifyRequest({ company_id: "x", kind: "notification" })).toMatch(/company_id/);
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["fax"], user_ids: [U1], title: "t" })).toMatch(/channels/);
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["sms"], user_ids: [U1], title: "t", action_url: "https://evil.example" })).toMatch(/action_url/);
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["sms"], user_ids: [U1], title: "t", action_url: "//evil.example" })).toMatch(/action_url/);
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["sms"], user_ids: Array.from({ length: 101 }, (_, i) => `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`), title: "t" })).toMatch(/At most/);
  });
  it("validates welcome bodies", () => {
    expect(parseNotifyRequest({ company_id: CO, kind: "welcome", to_email: "a@b.co" })).toMatchObject({ kind: "welcome" });
    expect(parseNotifyRequest({ company_id: CO, kind: "welcome", to_email: "nope" })).toMatch(/to_email/);
  });
  it("authorizes by role and membership", () => {
    const n = parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["email"], user_ids: [U1, U2], title: "t" });
    if (typeof n === "string") throw new Error(n);
    expect(authorize(n, null, {})).toMatch(/member/);
    expect(authorize(n, "admin", { [U1]: "staff" })).toMatch(/recipient/);
    expect(authorize(n, "staff", { [U1]: "admin", [U2]: "staff" })).toMatch(/managers/);
    expect(authorize(n, "staff", { [U1]: "admin", [U2]: "owner" })).toBeNull();
    expect(authorize(n, "lead", { [U1]: "staff", [U2]: "staff" })).toBeNull();
    const w = parseNotifyRequest({ company_id: CO, kind: "welcome", to_email: "a@b.co" });
    if (typeof w === "string") throw new Error(w);
    expect(authorize(w, "lead", {})).toMatch(/managers/);
    expect(authorize(w, "manager", {})).toBeNull();
  });
  it("escapes content", () => {
    expect(notificationEmailHtml("<b>x</b>", "a&b", null)).not.toContain("<b>x</b>");
    expect(smsText("t", "x".repeat(600)).length).toBeLessThanOrEqual(480);
  });
});

const fetchMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } }) }));
const createNotification = vi.fn(async () => ({}));
vi.mock("@/lib/supabase/db", () => ({ createNotification: (...a: unknown[]) => createNotification(...(a as [])) }));

describe("dispatcher", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  it("in-app only when no channels requested (no network)", async () => {
    const { dispatch } = await import("@/lib/services/notification-dispatcher");
    const r = await dispatch({ userId: U1, companyId: CO, title: "t", type: "x" });
    expect(r.inApp).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("sends email+sms via notify-send with user ids only", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ email: { sent: 1, failed: 0 }, sms: { sent: 0, failed: 0, skipped: "x" } }), { status: 200 }));
    const { dispatch } = await import("@/lib/services/notification-dispatcher");
    const r = await dispatch({ userId: U1, companyId: CO, title: "t", type: "x", urgent: true, emailFallback: true, email: "leak@x.co", actionUrl: "/schedule" });
    expect(fetchMock).toHaveBeenCalledWith("https://example.supabase.co/functions/v1/notify-send", expect.anything());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ kind: "notification", channels: ["email", "sms"], user_ids: [U1], action_url: "/schedule" });
    expect(JSON.stringify(body)).not.toContain("leak@x.co");
    expect(r).toMatchObject({ email: true, sms: false });
  });
});
