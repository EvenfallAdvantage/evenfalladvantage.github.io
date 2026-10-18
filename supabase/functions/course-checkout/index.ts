/**
 * course-checkout — start a Stripe Checkout session for a paid Overwatch course.
 *
 *   POST /functions/v1/course-checkout   Authorization: Bearer <user access token>
 *   body: { courseId: uuid }
 *   200 { url }  -> the browser goes to Stripe-hosted checkout
 *
 * OverwatchDB (nneueuvyeohwnspbwfub) only. Replaces the EADB
 * create-checkout-session function (PR #70 / EADB v4), which trusted a
 * client-supplied studentId and price.
 *
 * - Deploy with verify_jwt = false (browser preflight has no JWT); the caller's
 *   session is verified here with auth.getUser().
 * - The price, product name and company come from public.courses; the client
 *   sends only the course id.
 * - A payment_transactions row (pending -> processing) is written with the
 *   service role before redirecting; the course-payment-webhook function
 *   completes it and creates the paid enrollment. Nothing is granted here.
 * - Secrets: STRIPE_SECRET_KEY (set by the owner; test mode first).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { stripeFetch, type StripeResponse } from "../_shared/stripe.ts";
import { checkoutRefusal, checkoutSessionParams, courseDisplayName, isStripeCheckoutUrl, isUuid, type CourseRow } from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Small per-isolate rate limit: 10 checkout starts / 10 min / user.
const RATE: Map<string, number[]> = new Map();
function rateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (RATE.get(uid) ?? []).filter((t) => now - t < 600_000);
  recent.push(now);
  RATE.set(uid, recent);
  return recent.length > 10;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // ── who is calling ──
  const authHeader = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+/i.test(authHeader)) return json(401, { error: "Sign in to buy a course" });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json(401, { error: "Sign in to buy a course" });
  if (rateLimited(user.id)) return json(429, { error: "Too many checkout attempts; try again in a few minutes" });

  let courseId: unknown;
  try { courseId = (await req.json())?.courseId; } catch { /* fallthrough */ }
  if (!isUuid(courseId)) return json(400, { error: "courseId is required" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: course, error: courseErr } = await admin
    .from("courses")
    .select("id, company_id, title, course_name, price, is_active")
    .eq("id", courseId)
    .maybeSingle<CourseRow>();
  if (courseErr) {
    console.error("[course-checkout] course lookup", courseErr.message);
    return json(500, { error: "Could not load the course" });
  }

  const { data: profile } = await admin.from("users").select("id").eq("supabase_id", user.id).maybeSingle<{ id: string }>();
  const publicUserId = profile?.id ?? null;

  let isMember = false;
  let enrollmentStatus: string | null = null;
  if (course?.company_id && publicUserId) {
    const { data: m } = await admin
      .from("company_memberships")
      .select("id")
      .eq("company_id", course.company_id)
      .eq("user_id", publicUserId)
      .eq("status", "active")
      .limit(1);
    isMember = (m?.length ?? 0) > 0;
    const { data: e } = await admin
      .from("course_enrollments")
      .select("status")
      .eq("course_id", course.id)
      .eq("user_id", publicUserId)
      .maybeSingle<{ status: string }>();
    enrollmentStatus = e?.status ?? null;
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const refusal = checkoutRefusal({ course, isMember, existingEnrollmentStatus: enrollmentStatus, hasStripeKey: !!stripeKey });
  if (refusal) return json(refusal.status, { error: refusal.error });

  // ── reuse a still-open session instead of opening a second one (prevents double charges) ──
  const { data: open } = await admin
    .from("payment_transactions")
    .select("id, stripe_checkout_session_id, created_at")
    .eq("user_id", user.id)
    .eq("course_id", course!.id)
    .eq("status", "processing")
    .gte("created_at", new Date(Date.now() - 23 * 3600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const prev = open?.[0];
  if (prev?.stripe_checkout_session_id) {
    const s = await stripeFetch<{ status?: string; url?: string }>(stripeKey, `/checkout/sessions/${encodeURIComponent(prev.stripe_checkout_session_id)}`);
    if (s.ok && s.body?.status === "open" && isStripeCheckoutUrl(s.body.url)) return json(200, { url: s.body.url, reused: true });
    if (s.ok && s.body?.status === "complete") {
      return json(409, { error: "Your payment for this course is being processed; refresh in a minute" });
    }
  }

  // ── record intent, then create the session ──
  const { data: payment, error: payErr } = await admin
    .from("payment_transactions")
    .insert({
      user_id: user.id,
      company_id: course!.company_id,
      course_id: course!.id,
      amount: course!.price,
      currency: "usd",
      status: "pending",
      description: `Course: ${courseDisplayName(course!)}`,
      metadata: { public_user_id: publicUserId, source: "overwatch-course-checkout" },
    })
    .select("id")
    .single<{ id: string }>();
  if (payErr || !payment) {
    console.error("[course-checkout] payment insert", payErr?.message);
    return json(500, { error: "Could not start checkout" });
  }

  const params = checkoutSessionParams({
    paymentId: payment.id,
    course: course!,
    authUserId: user.id,
    publicUserId,
    email: user.email ?? null,
    origin,
  });
  type SessionBody = { id?: string; url?: string; error?: { message?: string } };
  const session: StripeResponse<SessionBody> = await stripeFetch<SessionBody>(stripeKey, "/checkout/sessions", {
    form: params,
    idempotencyKey: `course-checkout-${payment.id}`,
  }).catch((e) => ({ ok: false, status: 0, body: { error: { message: String(e) } } }));
  const sessionId = session.body?.id;
  const sessionUrl = session.body?.url;

  if (!session.ok || !sessionId || !isStripeCheckoutUrl(sessionUrl)) {
    const msg = session.body?.error?.message ?? `Stripe returned ${session.status}`;
    console.error("[course-checkout] stripe session", session.status, msg);
    await admin.from("payment_transactions")
      .update({ status: "failed", error_message: msg.slice(0, 500), updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    return json(502, { error: "Could not reach the payment provider; please try again" });
  }

  const { error: updErr } = await admin.from("payment_transactions")
    .update({ status: "processing", stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq("id", payment.id);
  if (updErr) {
    // Without the session id the webhook can't match this payment; don't send the buyer to pay.
    console.error("[course-checkout] payment update", updErr.message);
    await stripeFetch(stripeKey, `/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, { method: "POST", form: {} }).catch(() => {});
    return json(500, { error: "Could not start checkout" });
  }

  return json(200, { url: sessionUrl });
});
