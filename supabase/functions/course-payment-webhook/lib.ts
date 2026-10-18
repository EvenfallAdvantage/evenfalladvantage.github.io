/** Pure event -> action mapping for course-payment-webhook (unit-tested in lib_test.ts). */

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
] as const;

export const OUR_SOURCE = "overwatch-course-checkout";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WebhookAction =
  | { kind: "purchase"; paymentId: string; sessionId: string; paymentIntent: string | null; amountCents: number; currency: string }
  | { kind: "status"; paymentId: string; sessionId: string; status: "failed" | "expired"; error: string | null }
  | { kind: "refund"; paymentIntent: string; refundedCents: number; full: boolean }
  | { kind: "ignore"; reason: string };

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>;

function idOf(v: unknown): string | null {
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && typeof (v as Obj).id === "string") return (v as Obj).id;
  return null;
}

/** Only sessions created by course-checkout (other products may share the Stripe account). */
function ourPaymentId(session: Obj): string | null {
  const md = (session?.metadata ?? {}) as Obj;
  if (md.source !== OUR_SOURCE) return null;
  const id = md.payment_id ?? session?.client_reference_id;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

export function decideWebhookAction(event: Obj): WebhookAction {
  const type = String(event?.type ?? "");
  const obj = (event?.data?.object ?? {}) as Obj;
  if (!(HANDLED_EVENTS as readonly string[]).includes(type)) return { kind: "ignore", reason: `unhandled event ${type}` };

  if (type === "charge.refunded") {
    const pi = idOf(obj.payment_intent);
    if (!pi) return { kind: "ignore", reason: "refund without payment_intent" };
    const refunded = Number(obj.amount_refunded ?? 0);
    const amount = Number(obj.amount ?? 0);
    return { kind: "refund", paymentIntent: pi, refundedCents: refunded, full: obj.refunded === true || (amount > 0 && refunded >= amount) };
  }

  if (obj.object !== "checkout.session" || obj.mode !== "payment") return { kind: "ignore", reason: "not a payment checkout session" };
  const paymentId = ourPaymentId(obj);
  if (!paymentId) return { kind: "ignore", reason: "not an Overwatch course session" };
  const sessionId = String(obj.id ?? "");
  if (!sessionId) return { kind: "ignore", reason: "session without id" };

  switch (type) {
    case "checkout.session.completed":
      // Delayed methods (e.g. ACH) complete as "unpaid"; fulfil on async_payment_succeeded.
      if (obj.payment_status !== "paid") return { kind: "ignore", reason: `payment_status ${obj.payment_status}` };
    // falls through
    case "checkout.session.async_payment_succeeded":
      return {
        kind: "purchase",
        paymentId,
        sessionId,
        paymentIntent: idOf(obj.payment_intent),
        amountCents: Number(obj.amount_total ?? -1),
        currency: String(obj.currency ?? ""),
      };
    case "checkout.session.async_payment_failed":
      return { kind: "status", paymentId, sessionId, status: "failed", error: "async payment failed" };
    case "checkout.session.expired":
      return { kind: "status", paymentId, sessionId, status: "expired", error: null };
  }
  return { kind: "ignore", reason: "unreachable" };
}

/** RPC results that mean "something is wrong, a human should look" (logged loudly; Stripe still gets 200). */
export const ALERT_RESULTS = new Set(["amount_mismatch", "currency_mismatch", "session_mismatch", "no_user_or_course", "unknown_payment"]);
