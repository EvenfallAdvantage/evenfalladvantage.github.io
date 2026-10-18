/**
 * course-payment-webhook — Stripe -> OverwatchDB fulfilment for course purchases.
 *
 *   POST /functions/v1/course-payment-webhook   (called by Stripe only)
 *
 * OverwatchDB (nneueuvyeohwnspbwfub) only. Replaces the EADB
 * process-course-payment function (EADB v3), whose synchronous
 * stripe.webhooks.constructEvent() throws under Deno.
 *
 * - Deploy with verify_jwt = false (Stripe can't send a Supabase JWT).
 *   Every request must carry a valid Stripe-Signature for
 *   STRIPE_WEBHOOK_SECRET (HMAC-SHA256, 5-minute tolerance) or gets 400.
 * - Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *   checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.
 * - All writes go through service-role-only SQL functions
 *   (record_course_purchase / record_course_payment_status / record_course_refund),
 *   which re-check session id, amount and currency against the pending payment
 *   row and are idempotent, so Stripe retries are safe.
 * - Returns 500 on database errors so Stripe retries; 200 otherwise.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { verifyStripeSignature } from "../_shared/stripe.ts";
import { ALERT_RESULTS, decideWebhookAction } from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_BODY_BYTES = 512 * 1024;

const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[course-payment-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return reply(503, { error: "Webhook not configured" });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, { error: "Payload too large" });

  const sig = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret);
  if (!sig.ok) {
    console.warn("[course-payment-webhook] rejected signature:", sig.reason);
    return reply(400, { error: "Invalid signature" });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(raw); } catch { return reply(400, { error: "Invalid JSON" }); }

  const action = decideWebhookAction(event);
  const evtId = String(event.id ?? "");
  if (action.kind === "ignore") {
    console.log("[course-payment-webhook]", evtId, event.type, "ignored:", action.reason);
    return reply(200, { received: true, ignored: action.reason });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  let rpc;
  if (action.kind === "purchase") {
    rpc = await admin.rpc("record_course_purchase", {
      p_payment_id: action.paymentId,
      p_session_id: action.sessionId,
      p_payment_intent: action.paymentIntent,
      p_amount_cents: action.amountCents,
      p_currency: action.currency,
    });
  } else if (action.kind === "status") {
    rpc = await admin.rpc("record_course_payment_status", {
      p_payment_id: action.paymentId,
      p_session_id: action.sessionId,
      p_status: action.status,
      p_error: action.error,
    });
  } else {
    rpc = await admin.rpc("record_course_refund", {
      p_payment_intent: action.paymentIntent,
      p_refunded_cents: action.refundedCents,
      p_full: action.full,
    });
  }

  if (rpc.error) {
    console.error("[course-payment-webhook]", evtId, event.type, "db error:", rpc.error.message);
    return reply(500, { error: "Database error; Stripe will retry" });
  }
  const result = String(rpc.data);
  // Refunds of non-course charges come back unknown_payment; that's expected, not an alert.
  if (ALERT_RESULTS.has(result) && !(action.kind === "refund" && result === "unknown_payment")) {
    console.error("[course-payment-webhook] NEEDS REVIEW", evtId, event.type, action.kind, result);
  } else {
    console.log("[course-payment-webhook]", evtId, event.type, action.kind, result);
  }
  return reply(200, { received: true, result });
});
