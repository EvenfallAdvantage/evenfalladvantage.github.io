/**
 * Browser client for the `course-checkout` Edge Function (OverwatchDB).
 * Sends only the course id; the server reads the price, verifies the caller's
 * company membership and creates the Stripe Checkout session. Enrollment is
 * granted later by the signature-verified `course-payment-webhook`.
 */
import { createClient } from "@/lib/supabase/client";

export type CourseCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/** Only ever navigate to Stripe-hosted checkout. */
export function isStripeCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}

export function courseCheckoutEndpoint(base: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  return base ? `${base.replace(/\/+$/, "")}/functions/v1/course-checkout` : null;
}

export async function startCourseCheckout(courseId: string): Promise<CourseCheckoutResult> {
  const endpoint = courseCheckoutEndpoint();
  if (!endpoint) return { ok: false, error: "Course purchases are not available yet." };
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, error: "Sign in to buy a course." };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    const body = (await res.json().catch(() => ({}))) as { url?: unknown; error?: string };
    if (!res.ok) return { ok: false, error: body.error || `Checkout failed (HTTP ${res.status}).` };
    if (!isStripeCheckoutUrl(body.url)) return { ok: false, error: "Unable to start checkout. Please try again." };
    return { ok: true, url: body.url };
  } catch {
    return { ok: false, error: "Could not reach the payment service. Please try again." };
  }
}

/** Read the ?checkout= (new) or legacy ?status= return flag from Stripe. */
export function checkoutReturnState(params: { get(name: string): string | null }): { state: "success" | "cancelled" | null; courseId: string | null } {
  const raw = params.get("checkout") ?? params.get("status");
  const state = raw === "success" || raw === "cancelled" ? raw : null;
  return { state, courseId: state ? params.get("course") : null };
}
