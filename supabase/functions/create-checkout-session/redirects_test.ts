import { assertEquals } from 'jsr:@std/assert@1'
import { buildCheckoutRedirects } from './redirects.ts'

Deno.test('defaults point at the student portal training section, not courses.html', () => {
  const r = buildCheckoutRedirects({ origin: 'https://www.evenfalladvantage.com', courseId: 'c-1' })
  assertEquals(r.successUrl, 'https://www.evenfalladvantage.com/student-portal/index.html?payment=success&course=c-1#training')
  assertEquals(r.cancelUrl, 'https://www.evenfalladvantage.com/student-portal/index.html?payment=canceled&course=c-1#training')
  assertEquals(r.successUrl.includes('courses.html'), false)
})

Deno.test('missing or unknown Origin falls back to the production site', () => {
  for (const origin of [null, 'https://evil.example']) {
    const r = buildCheckoutRedirects({ origin, courseId: 'c-1' })
    assertEquals(r.successUrl.startsWith('https://www.evenfalladvantage.com/student-portal/index.html'), true)
  }
})

Deno.test('keeps allowed local/dev origins', () => {
  const r = buildCheckoutRedirects({ origin: 'http://localhost:3000', courseId: 'c 1' })
  assertEquals(r.successUrl, 'http://localhost:3000/student-portal/index.html?payment=success&course=c%201#training')
})

Deno.test('honours same-site successUrl/cancelUrl (absolute or relative)', () => {
  const r = buildCheckoutRedirects({
    origin: 'https://www.evenfalladvantage.com',
    courseId: 'c-1',
    successUrl: 'https://www.evenfalladvantage.com/student-portal/index.html?paid=1',
    cancelUrl: '/student-portal/index.html#training',
  })
  assertEquals(r.successUrl, 'https://www.evenfalladvantage.com/student-portal/index.html?paid=1')
  assertEquals(r.cancelUrl, 'https://www.evenfalladvantage.com/student-portal/index.html#training')
})

Deno.test('rejects off-site and non-http redirect URLs (no open redirect)', () => {
  const r = buildCheckoutRedirects({
    origin: 'https://www.evenfalladvantage.com',
    courseId: 'c-1',
    successUrl: 'https://evil.example/phish',
    cancelUrl: 'javascript:alert(1)',
  })
  assertEquals(r.successUrl.startsWith('https://www.evenfalladvantage.com/'), true)
  assertEquals(r.cancelUrl.startsWith('https://www.evenfalladvantage.com/'), true)
})
