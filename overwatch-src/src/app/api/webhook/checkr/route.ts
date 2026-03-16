/**
 * Checkr Webhook Receiver
 *
 * Receives background check status updates from Checkr and
 * updates the corresponding applicant record in Overwatch.
 *
 * Checkr webhook events:
 *   - report.completed — background check finished
 *   - report.upgraded — report was upgraded
 *   - candidate.created — candidate record created
 *   - invitation.completed — candidate completed the invitation flow
 *
 * NOTE: This route works in Next.js dev and on proper hosting.
 * For GitHub Pages static export, deploy as a Supabase Edge Function.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type as string | undefined;

    if (!type) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    const data = body.data?.object || body.data || {};
    const candidateId = data.candidate_id || data.id;
    const status = data.status;

    console.info(`[Checkr Webhook] Event: ${type}, candidate: ${candidateId}, status: ${status}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Map Checkr status to our internal status
    if (type === "report.completed") {
      const reportStatus = status; // "clear", "consider", "suspended", "dispute"
      const bgCheckStatus = reportStatus === "clear" ? "passed" : reportStatus === "consider" ? "review" : "flagged";

      // Find the applicant by looking for checkr_candidate_id in metadata
      // or by matching the candidate email
      const candidateEmail = data.candidate_email || data.email;

      if (candidateEmail) {
        const { data: applicants } = await supabase
          .from("applicants")
          .select("id, metadata")
          .eq("email", candidateEmail)
          .order("created_at", { ascending: false })
          .limit(1);

        if (applicants && applicants.length > 0) {
          const applicant = applicants[0];
          const metadata = (applicant.metadata || {}) as Record<string, unknown>;

          await supabase
            .from("applicants")
            .update({
              metadata: {
                ...metadata,
                checkr_candidate_id: candidateId,
                checkr_report_status: reportStatus,
                checkr_bg_check_status: bgCheckStatus,
                checkr_report_id: data.id,
                checkr_completed_at: new Date().toISOString(),
              },
            })
            .eq("id", applicant.id);

          console.info(`[Checkr Webhook] Updated applicant ${applicant.id}: bg_check=${bgCheckStatus}`);
        }
      }
    }

    if (type === "invitation.completed") {
      // Candidate has completed the Checkr invitation (provided SSN, consent, etc.)
      const candidateEmail = data.candidate_email || data.email;
      if (candidateEmail) {
        const { data: applicants } = await supabase
          .from("applicants")
          .select("id, metadata")
          .eq("email", candidateEmail)
          .limit(1);

        if (applicants && applicants.length > 0) {
          const applicant = applicants[0];
          const metadata = (applicant.metadata || {}) as Record<string, unknown>;
          await supabase
            .from("applicants")
            .update({
              metadata: {
                ...metadata,
                checkr_invitation_completed: true,
                checkr_invitation_completed_at: new Date().toISOString(),
              },
            })
            .eq("id", applicant.id);
        }
      }
    }

    return NextResponse.json({ received: true, type });
  } catch (err) {
    console.error("[Checkr Webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
