import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession } }),
}));

import { checkoutReturnState, courseCheckoutEndpoint, isStripeCheckoutUrl, startCourseCheckout } from "@/lib/services/course-checkout";

const COURSE = "11111111-1111-4111-8111-111111111111";

describe("course checkout client", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://nneueuvyeohwnspbwfub.supabase.co/");
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts only the course id with the user's token to the OverwatchDB function", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }), { status: 200 }));
    const r = await startCourseCheckout(COURSE);
    expect(r).toEqual({ ok: true, url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/course-checkout");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ courseId: COURSE });
  });

  it("refuses to redirect anywhere but Stripe checkout", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ url: "https://evil.example/pay" }), { status: 200 }));
    const r = await startCourseCheckout(COURSE);
    expect(r.ok).toBe(false);
  });

  it("surfaces server refusals", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "You are already enrolled in this course" }), { status: 409 }));
    expect(await startCourseCheckout(COURSE)).toEqual({ ok: false, error: "You are already enrolled in this course" });
  });

  it("requires a session and a configured URL", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect((await startCourseCheckout(COURSE)).ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(courseCheckoutEndpoint("")).toBeNull();
  });

  it("handles network errors", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await startCourseCheckout(COURSE)).ok).toBe(false);
  });

  it("isStripeCheckoutUrl", () => {
    expect(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/x")).toBe(true);
    expect(isStripeCheckoutUrl("https://checkout.stripe.com.evil.example/x")).toBe(false);
    expect(isStripeCheckoutUrl("http://checkout.stripe.com/x")).toBe(false);
    expect(isStripeCheckoutUrl(undefined)).toBe(false);
  });

  it("reads the Stripe return flags", () => {
    const p = (q: string) => new URLSearchParams(q);
    expect(checkoutReturnState(p(`checkout=success&course=${COURSE}`))).toEqual({ state: "success", courseId: COURSE });
    expect(checkoutReturnState(p("status=cancelled"))).toEqual({ state: "cancelled", courseId: null });
    expect(checkoutReturnState(p("checkout=weird"))).toEqual({ state: null, courseId: null });
  });
});
