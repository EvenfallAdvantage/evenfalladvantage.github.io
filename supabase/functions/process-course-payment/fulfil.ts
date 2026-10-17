// Pure fulfilment decision for checkout.session.completed (unit-tested).

export type PaymentRow = {
  id: string
  student_id: string | null
  course_id: string | null
  amount: number | string | null
  status: string
}

export type SessionLike = {
  id: string
  payment_status?: string | null
  amount_total?: number | null
  currency?: string | null
  client_reference_id?: string | null
  metadata?: Record<string, string> | null
}

export type Decision =
  | { action: 'skip'; reason: string }
  | { action: 'reject'; reason: string }
  | { action: 'fulfil'; paymentId: string; studentId: string; courseId: string; amount: number }

/**
 * Enrol only when: Stripe says the session is PAID, it maps to OUR pending
 * payment row (client_reference_id / metadata.payment_id), student + course
 * match that row, and the amount charged equals the row's amount. A row that is
 * already completed is skipped (Stripe retries webhooks; this keeps it
 * idempotent).
 */
export function decideFulfilment(session: SessionLike, row: PaymentRow | null): Decision {
  if (session.payment_status !== 'paid') return { action: 'skip', reason: `payment_status=${session.payment_status ?? 'unknown'}` }
  const md = session.metadata ?? {}
  const paymentId = md.payment_id || session.client_reference_id || ''
  if (!paymentId || !row || row.id !== paymentId) return { action: 'reject', reason: 'unknown_payment' }
  if (row.status === 'completed') return { action: 'skip', reason: 'already_completed' }
  if (!row.student_id || !row.course_id || md.student_id !== row.student_id || md.course_id !== row.course_id) {
    return { action: 'reject', reason: 'metadata_mismatch' }
  }
  const expected = Math.round(Number(row.amount) * 100)
  if (!Number.isFinite(expected) || session.amount_total !== expected) return { action: 'reject', reason: 'amount_mismatch' }
  if ((session.currency ?? '').toLowerCase() !== 'usd') return { action: 'reject', reason: 'currency_mismatch' }
  return { action: 'fulfil', paymentId: row.id, studentId: row.student_id, courseId: row.course_id, amount: expected / 100 }
}
