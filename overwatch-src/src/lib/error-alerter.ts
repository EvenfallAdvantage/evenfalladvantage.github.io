import { createClient } from "@/lib/supabase/client";

const LAST_CHECK_KEY = "ea_error_alert_last_check";

/**
 * Check for new errors since last check and create a Briefing alert if found.
 * Called once per admin session (on dashboard load).
 * Only triggers for admin/owner roles.
 */
export async function checkErrorsAndAlert(companyId: string, userId: string) {
  if (!companyId || companyId === "pending") return;

  const supabase = createClient();

  // Get last check timestamp
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY) ?? new Date(Date.now() - 86400000).toISOString();

  // Count new errors since last check
  const { count, error } = await supabase
    .from("error_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", lastCheck);

  if (error || !count || count === 0) {
    // No new errors or query failed — update timestamp and return
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    return;
  }

  // Check if we already posted an alert today (avoid duplicates)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existingAlert } = await supabase
    .from("posts")
    .select("id")
    .eq("company_id", companyId)
    .eq("post_type", "alert")
    .gte("created_at", todayStart.toISOString())
    .ilike("content", "%System Error Alert%")
    .limit(1)
    .maybeSingle();

  if (existingAlert) {
    // Already posted today
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
    return;
  }

  // Get a sample of the errors for the alert body
  const { data: recentErrors } = await supabase
    .from("error_logs")
    .select("message, level, created_at")
    .eq("company_id", companyId)
    .gte("created_at", lastCheck)
    .order("created_at", { ascending: false })
    .limit(5);

  const errorSummary = (recentErrors ?? [])
    .map((e: { message: string; level: string; created_at: string }) =>
      `• [${e.level.toUpperCase()}] ${e.message.slice(0, 100)}`)
    .join("\n");

  // Post a Briefing alert
  try {
    await supabase.from("posts").insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      user_id: userId,
      content: `**System Error Alert** — ${count} new error${count > 1 ? "s" : ""} detected since last review.\n\n${errorSummary}\n\nReview in HQ Config > System Logs.`,
      post_type: "alert",
      is_pinned: false,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silently fail — don't cause errors from the alerter
  }

  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
}
