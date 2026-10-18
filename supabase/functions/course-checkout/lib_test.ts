import { assert, assertEquals } from "jsr:@std/assert@1";
import { checkoutRefusal, checkoutSessionParams, isStripeCheckoutUrl, isUuid, priceToCents, redirectUrls, type CourseRow } from "./lib.ts";

const course: CourseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  company_id: "0f03bc15-aa8d-4bd3-956f-90bdd7904091",
  title: "Crowd Surge",
  course_name: null,
  price: "300.00",
  is_active: true,
};
const ok = { course, isMember: true, existingEnrollmentStatus: null, hasStripeKey: true };

Deno.test("priceToCents uses dollars from courses.price", () => {
  assertEquals(priceToCents("300.00"), 30000);
  assertEquals(priceToCents(49.99), 4999);
  assertEquals(priceToCents(0.1 + 0.2), 30);
  assertEquals(priceToCents(null), null);
  assertEquals(priceToCents(-1), null);
  assertEquals(priceToCents("abc"), null);
});

Deno.test("refusals", () => {
  assertEquals(checkoutRefusal(ok), null);
  assertEquals(checkoutRefusal({ ...ok, course: null })?.status, 404);
  assertEquals(checkoutRefusal({ ...ok, isMember: false })?.status, 403);
  assertEquals(checkoutRefusal({ ...ok, course: { ...course, is_active: false } })?.status, 409);
  assertEquals(checkoutRefusal({ ...ok, course: { ...course, price: 0 } })?.status, 400);
  assertEquals(checkoutRefusal({ ...ok, course: { ...course, price: 0.3 } })?.status, 400);
  assertEquals(checkoutRefusal({ ...ok, existingEnrollmentStatus: "active" })?.status, 409);
  assertEquals(checkoutRefusal({ ...ok, existingEnrollmentStatus: "completed" })?.status, 409);
  assertEquals(checkoutRefusal({ ...ok, existingEnrollmentStatus: "cancelled" }), null);
  assertEquals(checkoutRefusal({ ...ok, hasStripeKey: false })?.status, 503);
});

Deno.test("non-members learn nothing about inactive/free status", () => {
  assertEquals(checkoutRefusal({ ...ok, isMember: false, course: { ...course, is_active: false } })?.status, 403);
});

Deno.test("redirects are allowlisted (no open redirect)", () => {
  const r = redirectUrls("https://evil.example", course.id);
  assert(r.success.startsWith("https://www.evenfalladvantage.com/overwatch/courses/?checkout=success"));
  assert(r.success.endsWith("&session_id={CHECKOUT_SESSION_ID}"));
  assertEquals(redirectUrls("http://localhost:3000", course.id).cancel,
    `http://localhost:3000/overwatch/courses/?checkout=cancelled&course=${course.id}`);
  assert(redirectUrls(null, course.id).cancel.startsWith("https://www.evenfalladvantage.com/"));
});

Deno.test("session params: server price, metadata on session and payment intent", () => {
  const p = checkoutSessionParams({ paymentId: "pay-1", course, authUserId: "auth-1", publicUserId: "pub-1", email: "a@b.c", origin: null });
  assertEquals(p.mode, "payment");
  assertEquals(p.client_reference_id, "pay-1");
  assertEquals(p.line_items[0].price_data.unit_amount, 30000);
  assertEquals(p.line_items[0].price_data.currency, "usd");
  assertEquals(p.metadata.payment_id, "pay-1");
  assertEquals(p.payment_intent_data.metadata.payment_id, "pay-1");
  assertEquals(p.customer_email, "a@b.c");
});

Deno.test("isStripeCheckoutUrl / isUuid", () => {
  assert(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123"));
  assert(!isStripeCheckoutUrl("http://checkout.stripe.com/c/pay"));
  assert(!isStripeCheckoutUrl("https://checkout.stripe.com.evil.example/x"));
  assert(!isStripeCheckoutUrl(null));
  assert(isUuid(course.id));
  assert(!isUuid("1 OR 1=1"));
});
