import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession } }) }));

import { startCourseCheckout, checkoutReturnUrls, checkoutErrorMessage } from "@/lib/legacy/checkout";

const fetchMock = vi.fn();
const res = (status: number, body: unknown) => ({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) }) as Response;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_URL", "https://eadb.example.co");
  vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY", "legacy-anon");
  getSession.mockResolvedValue({ data: { session: { access_token: "ow-token" } } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("startCourseCheckout()", () => {
  it("calls EADB create-checkout-session with the Overwatch token and ONLY the course id + return URLs", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
    expect(await startCourseCheckout("c1")).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://eadb.example.co/functions/v1/create-checkout-session");
    expect(init.headers).toMatchObject({ Authorization: "Bearer ow-token", apikey: "legacy-anon" });
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(["cancelUrl", "courseId", "successUrl"]);
    expect(body.courseId).toBe("c1");
    expect(body).not.toHaveProperty("priceInCents");
    expect(body).not.toHaveProperty("studentId");
  });

  it("no longer calls the non-existent OverwatchDB stripe-checkout", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { url: "https://checkout.stripe.com/x" }));
    await startCourseCheckout("c1");
    expect(String(fetchMock.mock.calls[0][0])).not.toContain("stripe-checkout");
  });

  it("refuses to redirect anywhere but Stripe Checkout", async () => {
    fetchMock.mockResolvedValueOnce(res(200, { url: "https://evil.example/pay" }));
    expect(await startCourseCheckout("c1")).toEqual({ error: "http_200" });
  });

  it("passes server refusals through", async () => {
    fetchMock.mockResolvedValueOnce(res(409, { error: "already_enrolled" }));
    expect(await startCourseCheckout("c1")).toEqual({ error: "already_enrolled" });
    expect(checkoutErrorMessage("already_enrolled")).toMatch(/already enrolled/);
  });

  it("needs a session and a configured EADB URL", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } });
    expect(await startCourseCheckout("c1")).toEqual({ error: "not_signed_in" });
    vi.stubEnv("NEXT_PUBLIC_LEGACY_SUPABASE_URL", "");
    expect(await startCourseCheckout("c1")).toEqual({ error: "payments_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns to /overwatch/courses with the status the page shows", () => {
    expect(checkoutReturnUrls("https://www.evenfalladvantage.com")).toEqual({
      successUrl: "https://www.evenfalladvantage.com/overwatch/courses/?status=success",
      cancelUrl: "https://www.evenfalladvantage.com/overwatch/courses/?status=cancelled",
    });
  });
});
