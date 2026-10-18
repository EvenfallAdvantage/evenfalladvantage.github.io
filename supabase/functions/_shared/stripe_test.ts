import { assert, assertEquals } from "jsr:@std/assert@1";
import { formEncode, hmacSha256Hex, parseSignatureHeader, timingSafeEqualHex, verifyStripeSignature } from "./stripe.ts";

const SECRET = "whsec_unit_test_only";
const BODY = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

async function header(t: number, body = BODY, secret = SECRET) {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${body}`)}`;
}

Deno.test("formEncode nests objects and arrays like Stripe expects", () => {
  const s = formEncode({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 5000, product_data: { name: "A & B" } } }],
    metadata: { payment_id: "p1" },
    skip: undefined,
    none: null,
  });
  assertEquals(
    s,
    "mode=payment&line_items%5B0%5D%5Bquantity%5D=1&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd" +
      "&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=5000&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=A%20%26%20B" +
      "&metadata%5Bpayment_id%5D=p1",
  );
});

Deno.test("valid signature passes", async () => {
  const now = 1_760_000_000;
  const r = await verifyStripeSignature(BODY, await header(now), SECRET, now);
  assertEquals(r, { ok: true, timestamp: now });
});

Deno.test("any one of several v1 signatures may match (secret rotation)", async () => {
  const now = 1_760_000_000;
  const good = (await header(now)).split(",")[1];
  const r = await verifyStripeSignature(BODY, `t=${now},v1=${"0".repeat(64)},${good}`, SECRET, now);
  assert(r.ok);
});

Deno.test("tampered body fails", async () => {
  const now = 1_760_000_000;
  const r = await verifyStripeSignature(BODY.replace("evt_1", "evt_2"), await header(now), SECRET, now);
  assertEquals(r, { ok: false, reason: "no_matching_signature" });
});

Deno.test("wrong secret fails", async () => {
  const now = 1_760_000_000;
  const r = await verifyStripeSignature(BODY, await header(now, BODY, "whsec_other"), SECRET, now);
  assertEquals(r, { ok: false, reason: "no_matching_signature" });
});

Deno.test("old or future timestamps are rejected (replay)", async () => {
  const now = 1_760_000_000;
  assertEquals((await verifyStripeSignature(BODY, await header(now - 301), SECRET, now)), { ok: false, reason: "timestamp_out_of_tolerance" });
  assertEquals((await verifyStripeSignature(BODY, await header(now + 301), SECRET, now)), { ok: false, reason: "timestamp_out_of_tolerance" });
  assert((await verifyStripeSignature(BODY, await header(now - 299), SECRET, now)).ok);
});

Deno.test("missing secret / header / malformed header", async () => {
  const now = 1_760_000_000;
  assertEquals(await verifyStripeSignature(BODY, await header(now), "", now), { ok: false, reason: "missing_secret" });
  assertEquals(await verifyStripeSignature(BODY, null, SECRET, now), { ok: false, reason: "bad_header" });
  assertEquals(await verifyStripeSignature(BODY, "t=abc,v1=zz", SECRET, now), { ok: false, reason: "bad_header" });
  assertEquals(parseSignatureHeader(`t=${now},v0=${"a".repeat(64)}`), null);
});

Deno.test("timingSafeEqualHex", () => {
  assert(timingSafeEqualHex("abcd", "abcd"));
  assert(!timingSafeEqualHex("abcd", "abce"));
  assert(!timingSafeEqualHex("abcd", "abc"));
});
