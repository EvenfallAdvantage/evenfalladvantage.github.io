import { createClient } from "@/lib/supabase/client";
import { ensureInternalUser } from "./db-helpers";

export interface IntakeShare {
  id: string;
  event_id: string;
  company_id: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  submitted_at: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Create a share link for a client to fill out the intake form.
 */
export async function createIntakeShare(
  eventId: string,
  companyId: string
): Promise<IntakeShare> {
  const supabase = createClient();
  const userId = await ensureInternalUser();

  const { data, error } = await supabase
    .from("intake_shares")
    .insert({
      event_id: eventId,
      company_id: companyId,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as IntakeShare;
}

/**
 * Get all share links for an event.
 */
export async function getEventShares(eventId: string): Promise<IntakeShare[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("intake_shares")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as IntakeShare[];
}

/**
 * Look up a share by token — used by the public intake page.
 * Returns the share + event + company info for branding.
 */
export async function lookupIntakeShare(token: string): Promise<{
  share: IntakeShare;
  event: { id: string; name: string; location: string | null; start_date: string | null };
  company: { id: string; name: string; logo_url: string | null; brand_color: string };
} | null> {
  const supabase = createClient();

  const { data: share, error } = await supabase
    .from("intake_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !share) return null;

  // Get event info
  const { data: event } = await supabase
    .from("events")
    .select("id, name, location, start_date")
    .eq("id", share.event_id)
    .maybeSingle();

  // Get company info for branding
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, logo_url, brand_color")
    .eq("id", share.company_id)
    .maybeSingle();

  if (!event || !company) return null;

  return {
    share: share as IntakeShare,
    event: event as { id: string; name: string; location: string | null; start_date: string | null },
    company: company as { id: string; name: string; logo_url: string | null; brand_color: string },
  };
}

/**
 * Mark a share as submitted by the client.
 */
export async function markShareSubmitted(
  token: string,
  clientName: string,
  clientEmail: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("intake_shares")
    .update({
      client_name: clientName,
      client_email: clientEmail,
      submitted_at: new Date().toISOString(),
    })
    .eq("token", token);
  if (error) throw error;
}

/**
 * Delete a share link.
 */
export async function deleteIntakeShare(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("intake_shares")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
