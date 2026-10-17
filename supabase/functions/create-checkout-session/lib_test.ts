import { assertEquals } from 'jsr:@std/assert@1'
import { amountCents, bearer, checkoutRefusal, isUuid } from './lib.ts'

Deno.test('bearer token parsing', () => {
  assertEquals(bearer('Bearer abc.def'), 'abc.def')
  assertEquals(bearer('bearer x'), 'x')
  assertEquals(bearer(null), null)
  assertEquals(bearer('Basic x'), null)
})

Deno.test('price comes from the course row, in cents', () => {
  assertEquals(amountCents(50), 5000)
  assertEquals(amountCents('75.00'), 7500)
  assertEquals(amountCents(19.999), 2000)
  assertEquals(amountCents(null), 0)
  assertEquals(amountCents('abc'), 0)
})

Deno.test('checkout refusals', () => {
  assertEquals(checkoutRefusal(null, null), { status: 404, error: 'course_not_found' })
  assertEquals(checkoutRefusal({ is_active: false, price: 50 }, null), { status: 409, error: 'course_inactive' })
  assertEquals(checkoutRefusal({ is_active: true, price: 0 }, null), { status: 400, error: 'not_a_paid_course' })
  assertEquals(checkoutRefusal({ is_active: true, price: 0.4 }, null), { status: 400, error: 'not_a_paid_course' })
  assertEquals(checkoutRefusal({ is_active: true, price: 50 }, { id: 'e1' }), { status: 409, error: 'already_enrolled' })
  assertEquals(checkoutRefusal({ is_active: true, price: 50 }, null), null)
})

Deno.test('uuid check', () => {
  assertEquals(isUuid('11111111-1111-4111-8111-111111111111'), true)
  assertEquals(isUuid('nope'), false)
})
