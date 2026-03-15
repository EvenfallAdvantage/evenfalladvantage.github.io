import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, courseTitle, priceInCents, userId, companyId } = body;

    if (!courseTitle || !priceInCents) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: courseTitle,
              description: "Overwatch Training Course",
            },
            unit_amount: Math.round(priceInCents),
          },
          quantity: 1,
        },
      ],
      metadata: {
        courseId: courseId || "",
        userId: userId || "",
        companyId: companyId || "",
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/courses?status=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
