/**
 * Paid course checkout. Courses, students, payments and enrolments live in the
 * legacy EADB, so checkout runs there: the `create-checkout-session` edge
 * function (EADB) verifies our Overwatch session itself, resolves the buyer's
 * EADB student row from it and prices the course from the course row. We only
 * send the course id and where Stripe should send the buyer back.
 * Enrolment happens later in the `process-course-payment` Stripe webhook.
 */
import { createClient } from "@/lib/supabase/client";

export type CheckoutResult = { url: string } | { error: string };

export function checkoutReturnUrls(origin: string): { successUrl: string; cancelUrl: string } {
  return {
    successUrl: `${origin}/overwatch/courses/?status=success`,
    cancelUrl: `${origin}/overwatch/courses/?status=cancelled`,
  };
}

export async function startCourseCheckout(courseId: string): Promise<CheckoutResult> {
  const legacyUrl = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL ?? "";
  const legacyAnon = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY ?? "";
  if (!legacyUrl) return { error: "payments_not_configured" };

  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "not_signed_in" };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.evenfalladvantage.com";
  let res: Response;
  try {
    res = await fetch(`${legacyUrl}/functions/v1/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(legacyAnon ? { apikey: legacyAnon } : {}),
      },
      body: JSON.stringify({ courseId, ...checkoutReturnUrls(origin) }),
    });
  } catch {
    return { error: "network" };
  }
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (res.ok && typeof body.url === "string" && body.url.startsWith("https://checkout.stripe.com/")) return { url: body.url };
  return { error: body.error ?? `http_${res.status}` };
}

export function checkoutErrorMessage(error: string): string {
  const why: Record<string, string> = {
    already_enrolled: "You're already enrolled in this course.",
    course_inactive: "This course isn't available right now.",
    not_a_paid_course: "This course is free; no payment needed.",
    payments_not_configured: "Course purchases aren't available yet.",
    not_signed_in: "Please sign in again to purchase.",
    invalid_session: "Your session expired. Please sign in again.",
  };
  return why[error] ?? "Unable to start checkout. Please try again.";
}
