/** Pure logic for course-checkout (unit-tested in lib_test.ts). */

export const SITE_ORIGINS = ["https://www.evenfalladvantage.com", "http://localhost:3000"] as const;
export const DEFAULT_SITE_ORIGIN = SITE_ORIGINS[0];
export const COURSES_PATH = "/overwatch/courses/";
/** Stripe's minimum charge for USD. */
export const MIN_CHARGE_CENTS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** courses.price is dollars (numeric). Returns integer cents, or null when not a usable price. */
export function priceToCents(price: unknown): number | null {
  const n = typeof price === "string" ? Number(price) : price;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Where Stripe sends the buyer back. Built server-side only, from an
 * allowlisted origin, so a caller can't turn checkout into an open redirect.
 */
export function redirectUrls(origin: string | null | undefined, courseId: string): { success: string; cancel: string } {
  const base = (SITE_ORIGINS as readonly string[]).includes(origin ?? "") ? origin! : DEFAULT_SITE_ORIGIN;
  const c = encodeURIComponent(courseId);
  return {
    success: `${base}${COURSES_PATH}?checkout=success&course=${c}&session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}${COURSES_PATH}?checkout=cancelled&course=${c}`,
  };
}

export interface CourseRow {
  id: string;
  company_id: string | null;
  title: string | null;
  course_name: string | null;
  price: number | string | null;
  is_active: boolean | null;
}

export interface Refusal { status: number; error: string }

/**
 * Decide whether this caller may start a checkout for this course.
 * Returns null when allowed. Order matters: never reveal a course's details
 * to someone outside its company.
 */
export function checkoutRefusal(input: {
  course: CourseRow | null;
  isMember: boolean;
  existingEnrollmentStatus: string | null;
  hasStripeKey: boolean;
}): Refusal | null {
  const { course, isMember, existingEnrollmentStatus, hasStripeKey } = input;
  if (!course || !course.company_id) return { status: 404, error: "Course not found" };
  if (!isMember) return { status: 403, error: "You are not a member of this course's company" };
  if (course.is_active === false) return { status: 409, error: "This course is not currently offered" };
  const cents = priceToCents(course.price);
  if (cents === null || cents === 0) return { status: 400, error: "This course is free; enroll from the course page" };
  if (cents < MIN_CHARGE_CENTS) return { status: 400, error: "Course price is below the minimum card charge" };
  if (existingEnrollmentStatus && existingEnrollmentStatus !== "cancelled") {
    return { status: 409, error: "You are already enrolled in this course" };
  }
  if (!hasStripeKey) return { status: 503, error: "Payments are not configured yet" };
  return null;
}

export function courseDisplayName(course: CourseRow): string {
  return (course.title || course.course_name || "Overwatch course").slice(0, 250);
}

/** Form body for POST /v1/checkout/sessions. Price always comes from the database, never the client. */
export function checkoutSessionParams(input: {
  paymentId: string;
  course: CourseRow;
  authUserId: string;
  publicUserId: string | null;
  email: string | null;
  origin: string | null;
}) {
  const { paymentId, course, authUserId, publicUserId, email, origin } = input;
  const cents = priceToCents(course.price)!;
  const urls = redirectUrls(origin, course.id);
  const metadata = {
    payment_id: paymentId,
    course_id: course.id,
    company_id: course.company_id,
    auth_user_id: authUserId,
    user_id: publicUserId ?? "",
    source: "overwatch-course-checkout",
  };
  return {
    mode: "payment",
    client_reference_id: paymentId,
    customer_email: email ?? undefined,
    success_url: urls.success,
    cancel_url: urls.cancel,
    line_items: [{
      quantity: 1,
      price_data: { currency: "usd", unit_amount: cents, product_data: { name: courseDisplayName(course) } },
    }],
    metadata,
    payment_intent_data: { metadata, description: `Overwatch course: ${courseDisplayName(course)}`.slice(0, 1000) },
  };
}

/** Only ever send the browser to Stripe-hosted checkout. */
export function isStripeCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "checkout.stripe.com";
  } catch {
    return false;
  }
}
