import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array, pushSupport, isIosNotInstalled } from "@/lib/push/web-push";
import { channelsFor } from "@/lib/services/notification-dispatcher";
import { parseNotifyRequest, smsRecipientIds, pushPayload } from "../../../supabase/functions/notify-send/rules";

const base = { hasSW: true, hasPush: true, hasNotification: true, key: "BKey", ua: "Mozilla/5.0 (Linux; Android 14)", standalone: false, permission: "default" };
const C = "c0000000-0000-4000-8000-000000000001";
const U1 = "a0000000-0000-4000-8000-00000000000a";
const U2 = "b0000000-0000-4000-8000-00000000000b";

describe("web push client", () => {
  it("decodes base64url VAPID keys", () => {
    expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
  });
  it("reports why push is unavailable", () => {
    expect(pushSupport({ ...base, key: "" })).toBe("not-configured");
    expect(pushSupport({ ...base, ua: "iPhone OS 17" })).toBe("needs-install");
    expect(pushSupport({ ...base, ua: "iPhone OS 17", standalone: true })).toBeNull();
    expect(pushSupport({ ...base, hasPush: false })).toBe("unsupported");
    expect(pushSupport({ ...base, permission: "denied" })).toBe("denied");
    expect(pushSupport(base)).toBeNull();
    expect(isIosNotInstalled("Android", false)).toBe(false);
  });
});

describe("dispatcher channels", () => {
  it("push always; urgent = SMS fallback; critical = SMS always", () => {
    expect(channelsFor({}, true)).toEqual({ channels: ["push"], smsFallback: false });
    expect(channelsFor({ urgent: true }, true)).toEqual({ channels: ["push"], smsFallback: true });
    expect(channelsFor({ critical: true }, true)).toEqual({ channels: ["push", "sms"], smsFallback: false });
    expect(channelsFor({ emailFallback: true }, true).channels).toEqual(["push", "email"]);
  });
  it("without a VAPID key keeps the old behaviour", () => {
    expect(channelsFor({}, false)).toEqual({ channels: [], smsFallback: false });
    expect(channelsFor({ urgent: true, emailFallback: true }, false)).toEqual({ channels: ["email", "sms"], smsFallback: false });
    expect(channelsFor({ critical: true }, false)).toEqual({ channels: ["sms"], smsFallback: false });
  });
});

describe("notify-send push rules", () => {
  it("accepts push and sms_fallback", () => {
    const r = parseNotifyRequest({ company_id: C, kind: "notification", channels: ["push"], user_ids: [U1], title: "T", sms_fallback: true });
    expect(typeof r).toBe("object");
    expect(r).toMatchObject({ channels: ["push"], sms_fallback: true });
  });
  it("ignores sms_fallback without push, or when sms is already requested", () => {
    expect(parseNotifyRequest({ company_id: C, kind: "notification", channels: ["email"], user_ids: [U1], title: "T", sms_fallback: true })).toMatchObject({ sms_fallback: false });
    expect(parseNotifyRequest({ company_id: C, kind: "notification", channels: ["push", "sms"], user_ids: [U1], title: "T", sms_fallback: true })).toMatchObject({ sms_fallback: false });
  });
  it("SMS goes only to members push missed", () => {
    expect(smsRecipientIds({ channels: ["push"], sms_fallback: true }, [U1, U2], new Set([U1]))).toEqual([U2]);
    expect(smsRecipientIds({ channels: ["push", "sms"] }, [U1, U2], new Set([U1]))).toEqual([U1, U2]);
    expect(smsRecipientIds({ channels: ["push"] }, [U1, U2], new Set())).toEqual([]);
  });
  it("caps payload size", () => {
    const p = JSON.parse(pushPayload("x".repeat(500), "y".repeat(900), null));
    expect(p.title.length).toBe(120);
    expect(p.body.length).toBe(300);
  });
});
