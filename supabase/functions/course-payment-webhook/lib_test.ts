import { assertEquals } from "jsr:@std/assert@1";
import { decideWebhookAction } from "./lib.ts";

const PAY = "22222222-2222-4222-8222-222222222222";
const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_1",
  object: "checkout.session",
  mode: "payment",
  payment_status: "paid",
  amount_total: 5000,
  currency: "usd",
  payment_intent: "pi_1",
  client_reference_id: PAY,
  metadata: { source: "overwatch-course-checkout", payment_id: PAY },
  ...over,
});
const ev = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } });

Deno.test("completed + paid -> purchase", () => {
  assertEquals(decideWebhookAction(ev("checkout.session.completed", session())), {
    kind: "purchase", paymentId: PAY, sessionId: "cs_test_1", paymentIntent: "pi_1", amountCents: 5000, currency: "usd",
  });
});

Deno.test("completed + unpaid (delayed method) waits for async success", () => {
  assertEquals(decideWebhookAction(ev("checkout.session.completed", session({ payment_status: "unpaid" }))).kind, "ignore");
  assertEquals(decideWebhookAction(ev("checkout.session.async_payment_succeeded", session({ payment_status: "paid" }))).kind, "purchase");
});

Deno.test("expanded payment_intent object is accepted", () => {
  const a = decideWebhookAction(ev("checkout.session.completed", session({ payment_intent: { id: "pi_x" } })));
  assertEquals(a.kind === "purchase" && a.paymentIntent, "pi_x");
});

Deno.test("failed / expired", () => {
  assertEquals(decideWebhookAction(ev("checkout.session.async_payment_failed", session())).kind, "status");
  const e = decideWebhookAction(ev("checkout.session.expired", session({ payment_status: "unpaid" })));
  assertEquals(e.kind === "status" && e.status, "expired");
});

Deno.test("sessions from other products / EADB are ignored", () => {
  assertEquals(decideWebhookAction(ev("checkout.session.completed", session({ metadata: { studentId: "x", courseId: "y" } }))).kind, "ignore");
  assertEquals(decideWebhookAction(ev("checkout.session.completed", session({ metadata: { source: "overwatch-course-checkout", payment_id: "nope" }, client_reference_id: null }))).kind, "ignore");
  assertEquals(decideWebhookAction(ev("checkout.session.completed", session({ mode: "subscription" }))).kind, "ignore");
  assertEquals(decideWebhookAction(ev("invoice.paid", {})).kind, "ignore");
});

Deno.test("charge.refunded full vs partial", () => {
  assertEquals(decideWebhookAction(ev("charge.refunded", { payment_intent: "pi_1", amount: 5000, amount_refunded: 5000, refunded: true })),
    { kind: "refund", paymentIntent: "pi_1", refundedCents: 5000, full: true });
  assertEquals(decideWebhookAction(ev("charge.refunded", { payment_intent: "pi_1", amount: 5000, amount_refunded: 1000, refunded: false })),
    { kind: "refund", paymentIntent: "pi_1", refundedCents: 1000, full: false });
  assertEquals(decideWebhookAction(ev("charge.refunded", { amount: 5000, amount_refunded: 5000 })).kind, "ignore");
});
