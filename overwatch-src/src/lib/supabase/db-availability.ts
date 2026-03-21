import { createClient } from "@/lib/supabase/client";

export type AvailabilityStatus = "available" | "unavailable" | "tentative" | "pending";

export interface OperationAvailability {
  id: string;
  event_id: string;
  user_id: string;
  status: AvailabilityStatus;
  notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  users?: { id: string; first_name: string; last_name: string; avatar_url?: string };
}

/** Get all availability responses for an event */
export async function getEventAvailability(eventId: string): Promise<OperationAvailability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_availability")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("event_id", eventId)
    .order("responded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OperationAvailability[];
}

/** Get current user's availability for an event */
export async function getMyAvailability(eventId: string, userId: string): Promise<OperationAvailability | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_availability")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as OperationAvailability | null;
}

/** Set or update availability for current user */
export async function setAvailability(params: {
  eventId: string;
  userId: string;
  status: AvailabilityStatus;
  notes?: string;
}): Promise<OperationAvailability> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_availability")
    .upsert(
      {
        event_id: params.eventId,
        user_id: params.userId,
        status: params.status,
        notes: params.notes ?? null,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as OperationAvailability;
}

/** Get available user IDs for an event (for shift assignment filtering) */
export async function getAvailableUserIds(eventId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("operation_availability")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("status", "available");
  if (error) throw error;
  return (data ?? []).map((r: { user_id: string }) => r.user_id);
}
