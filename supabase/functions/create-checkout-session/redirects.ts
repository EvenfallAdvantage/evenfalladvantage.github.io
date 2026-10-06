// Stripe Checkout redirect URLs for course purchases.
//
// The old defaults pointed at /student-portal/courses.html, which has never
// existed (404 after paying or cancelling). The course catalog is the
// "training" section of the student portal SPA (student-portal/index.html).
//
// Client-supplied successUrl / cancelUrl are only honoured when they stay on
// an allowed site origin, so this function can't be used as an open redirect
// on a Stripe-hosted page.

import { isAllowedOrigin } from '../_shared/cors.ts'

export const DEFAULT_SITE_ORIGIN = 'https://www.evenfalladvantage.com'
export const PORTAL_PATH = '/student-portal/index.html'

function safeSameSiteUrl(candidate: unknown, base: string): string | null {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 2048) return null
  let url: URL
  try {
    url = new URL(candidate, base)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!isAllowedOrigin(url.origin)) return null
  return url.toString()
}

export function buildCheckoutRedirects(params: {
  origin: string | null
  courseId: string
  successUrl?: unknown
  cancelUrl?: unknown
}): { successUrl: string; cancelUrl: string } {
  const base = params.origin && isAllowedOrigin(params.origin) ? params.origin : DEFAULT_SITE_ORIGIN
  const course = encodeURIComponent(params.courseId)

  const defaultSuccess = `${base}${PORTAL_PATH}?payment=success&course=${course}#training`
  const defaultCancel = `${base}${PORTAL_PATH}?payment=canceled&course=${course}#training`

  return {
    successUrl: safeSameSiteUrl(params.successUrl, base) ?? defaultSuccess,
    cancelUrl: safeSameSiteUrl(params.cancelUrl, base) ?? defaultCancel,
  }
}
