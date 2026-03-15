import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { courseId, userId, companyId } = session.metadata || {};

    if (userId && courseId) {
      try {
        const supabase = getServiceClient();

        // Record payment transaction
        await supabase.from("payment_transactions").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          company_id: companyId || null,
          course_id: courseId,
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_customer_id: session.customer as string,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "usd",
          status: "completed",
          description: "Course purchase",
          metadata: { session_id: session.id },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Auto-enroll user in course
        await supabase.from("course_enrollments").insert({
          id: crypto.randomUUID(),
          course_id: courseId,
          user_id: userId,
          status: "enrolled",
          progress: 0,
          assigned_at: new Date().toISOString(),
        });

        console.log(`Payment completed: user=${userId} course=${courseId}`);
      } catch (err) {
        console.error("Webhook DB error:", err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
