import { createClient } from "./client";

export async function getEventUserCertifications(eventId: string) {
  const supabase = createClient();
  const { data: shifts, error: shiftErr } = await supabase
    .from("shifts")
    .select("assigned_user_id")
    .eq("event_id", eventId)
    .is("assigned_user_id", null)
    .neq("assigned_user_id", null);
  if (shiftErr) { return {}; }
  
  const userIds = Array.from(new Set(shifts.map((s: { assigned_user_id: string }) => s.assigned_user_id)));
  if (userIds.length === 0) return {};
  
  const { data: certs, error: certErr } = await supabase
    .from("certifications")
    .select("*")
    .in("user_id", userIds);
  if (certErr) { return {}; }
  
  const result: Record<string, { hasAbcCert: boolean; abcState: string | null }> = {};
  for (const c of certs ?? []) {
    const userId = c.user_id;
    if (!result[userId]) {
      result[userId] = { hasAbcCert: false, abcState: null };
    }
    if (c.cert_type?.toLowerCase().includes("abc") || c.cert_type?.toLowerCase().includes("abc certification")) {
      result[userId].hasAbcCert = true;
      result[userId].abcState = c.state_issued ?? null;
    }
  }
  return result;
}
