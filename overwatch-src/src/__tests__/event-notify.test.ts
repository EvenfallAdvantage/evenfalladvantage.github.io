import { describe, it, expect } from "vitest";
import { parseNotifyRequest, authorize, refMatches, type NotificationRequest } from "../../../supabase/functions/notify-send/rules";
import { shouldPushDm, previewText, DM_PUSH_COOLDOWN_MS } from "@/lib/services/event-notify";

const CO = "0f03bc15-0000-4000-8000-000000000001";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const now = Date.parse("2026-10-20T20:00:00Z");

describe("notify-send ref", () => {
  it("parses a ref and requires a single recipient", () => {
    const ok = parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [B], title: "t", ref: { type: "dm", id: R } });
    expect((ok as NotificationRequest).ref).toEqual({ type: "dm", id: R });
    expect(parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [A, B], title: "t", ref: { type: "dm", id: R } })).toBe("ref allows a single recipient");
    expect(typeof parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [B], title: "t", ref: { type: "x", id: R } })).toBe("string");
  });
  it("staff→staff is denied without a verified ref and allowed with one", () => {
    const req = parseNotifyRequest({ company_id: CO, kind: "notification", channels: ["push"], user_ids: [B], title: "t", ref: { type: "dm", id: R } }) as NotificationRequest;
    expect(authorize(req, "staff", { [B]: "staff" })).toMatch(/managers/);
    expect(authorize(req, "staff", { [B]: "staff" }, true)).toBeNull();
    expect(authorize(req, "staff", { [B]: undefined }, true)).toMatch(/member/);
  });
  it("refMatches checks caller, recipient, company and freshness", () => {
    const dm = { from_user_id: A, to_user_id: B, company_id: CO, created_at: "2026-10-20 19:58:00" };
    expect(refMatches({ type: "dm", id: R }, dm, A, B, CO, now)).toBe(true);
    expect(refMatches({ type: "dm", id: R }, dm, B, A, CO, now)).toBe(false);
    expect(refMatches({ type: "dm", id: R }, { ...dm, created_at: "2026-10-20T19:00:00Z" }, A, B, CO, now)).toBe(false);
    expect(refMatches({ type: "swap", id: R }, { replacement_id: A, requester_id: B, company_id: CO, updated_at: "2026-10-20T19:59:00Z" }, A, B, CO, now)).toBe(true);
    expect(refMatches({ type: "task", id: R }, { assigned_to: B, created_by: A, company_id: CO, updated_at: "2026-10-20T19:59:00Z" }, A, B, CO, now)).toBe(true);
    expect(refMatches({ type: "task", id: R }, { assigned_to: B, created_by: R, company_id: CO, updated_at: "2026-10-20T19:59:00Z" }, A, B, CO, now)).toBe(false);
    expect(refMatches({ type: "dm", id: R }, null, A, B, CO, now)).toBe(false);
  });
});

describe("event-notify helpers", () => {
  it("rate-limits DM pushes per recipient", () => {
    expect(shouldPushDm("u1", 1000)).toBe(true);
    expect(shouldPushDm("u1", 1000 + DM_PUSH_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldPushDm("u2", 1000)).toBe(true);
    expect(shouldPushDm("u1", 1000 + DM_PUSH_COOLDOWN_MS + 1)).toBe(true);
  });
  it("previews text", () => {
    expect(previewText("  hi\n there ")).toBe("hi there");
    expect(previewText("x".repeat(200)).length).toBe(120);
  });
});
