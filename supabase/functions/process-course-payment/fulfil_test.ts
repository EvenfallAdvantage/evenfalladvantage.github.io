import { assertEquals } from 'jsr:@std/assert@1'
import { decideFulfilment, type PaymentRow, type SessionLike } from './fulfil.ts'

const row: PaymentRow = { id: 'p1', student_id: 's1', course_id: 'c1', amount: '50.00', status: 'processing' }
const paid: SessionLike = {
  id: 'cs_test_1', payment_status: 'paid', amount_total: 5000, currency: 'usd', client_reference_id: 'p1',
  metadata: { payment_id: 'p1', student_id: 's1', course_id: 'c1' },
}

Deno.test('paid session matching our row is fulfilled', () => {
  assertEquals(decideFulfilment(paid, row), { action: 'fulfil', paymentId: 'p1', studentId: 's1', courseId: 'c1', amount: 50 })
})
Deno.test('unpaid / async sessions are not fulfilled yet', () => {
  assertEquals(decideFulfilment({ ...paid, payment_status: 'unpaid' }, row).action, 'skip')
})
Deno.test('webhook retries are idempotent', () => {
  assertEquals(decideFulfilment(paid, { ...row, status: 'completed' }), { action: 'skip', reason: 'already_completed' })
})
Deno.test('unknown or missing payment row is rejected', () => {
  assertEquals(decideFulfilment(paid, null).action, 'reject')
  assertEquals(decideFulfilment({ ...paid, metadata: { ...paid.metadata!, payment_id: 'other' }, client_reference_id: 'other' }, row).action, 'reject')
})
Deno.test('student/course swapped in metadata is rejected', () => {
  assertEquals(decideFulfilment({ ...paid, metadata: { ...paid.metadata!, course_id: 'c2' } }, row), { action: 'reject', reason: 'metadata_mismatch' })
})
Deno.test('amount or currency mismatch is rejected', () => {
  assertEquals(decideFulfilment({ ...paid, amount_total: 100 }, row), { action: 'reject', reason: 'amount_mismatch' })
  assertEquals(decideFulfilment({ ...paid, currency: 'eur' }, row), { action: 'reject', reason: 'currency_mismatch' })
})
