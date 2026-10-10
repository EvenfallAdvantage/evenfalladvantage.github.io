// Pure helpers for create-checkout-session (unit-tested in lib_test.ts).

export function bearer(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '')
  return m ? m[1] : null
}

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** Price in cents from the COURSE ROW (never from the client). */
export function amountCents(price: unknown): number {
  const n = typeof price === 'number' ? price : Number(price)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export type CheckoutRefusal = { status: number; error: string }

/** Why this course can't be bought right now, or null when checkout may proceed. */
export function checkoutRefusal(
  course: { is_active?: boolean | null; price?: unknown } | null,
  activeEnrollment: unknown,
): CheckoutRefusal | null {
  if (!course) return { status: 404, error: 'course_not_found' }
  if (course.is_active === false) return { status: 409, error: 'course_inactive' }
  if (amountCents(course.price) < 50) return { status: 400, error: 'not_a_paid_course' } // Stripe minimum is $0.50
  if (activeEnrollment) return { status: 409, error: 'already_enrolled' }
  return null
}
