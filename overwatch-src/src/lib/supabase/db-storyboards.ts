import { createClient } from "./client";
import { ts } from "./db-helpers";

// ─── Storyboards ─────────────────────────────────────

export async function loadStoryboard(eventId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("storyboards")
    .select("*")
    .eq("event_id", eventId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveStoryboard(
  companyId: string,
  eventId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pins: any[],
  storyboardId?: string,
  createdByUserId?: string | null,
) {
  const supabase = createClient();
  const userId = createdByUserId ?? null;

  // If no storyboardId provided, try to find an existing one for this event
  let resolvedId = storyboardId;
  if (!resolvedId) {
    const { data: existing } = await supabase
      .from("storyboards")
      .select("id")
      .eq("event_id", eventId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) resolvedId = existing.id;
  }

  if (resolvedId) {
    // Update existing
    const { data, error } = await supabase
      .from("storyboards")
      .update({ pins, updated_at: new Date().toISOString() })
      .eq("id", resolvedId)
      .select()
      .single();
    if (error) {
      console.error("Storyboard update error:", error);
      throw error;
    }
    return data;
  } else {
    // Create new (only if no storyboard exists for this event)
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from("storyboards")
      .insert({
        id: newId,
        company_id: companyId,
        event_id: eventId,
        pins,
        created_by: userId,
        ...ts(),
      })
      .select()
      .single();
    if (error) {
      console.error("Storyboard insert error:", error);
      throw error;
    }
    if (!data) {
      throw new Error("Storyboard insert returned no data — possible RLS policy issue");
    }
    return data;
  }
}
