import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type AckStatus = { shift_id: string; user_id: string; acked_at: string; is_current: boolean };

/** My shifts with the operation details the "My Post" card needs. */
export async function getMyPostShifts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data, error } = await createClient()
    .from("shifts")
    .select("*, events!inner(id, name, location, location_lat, location_lng, site_map_url, post_orders, timezone, company_id)")
    .eq("assigned_user_id", userId)
    .eq("events.company_id", companyId)
    .gte("end_time", since)
    .order("start_time", { ascending: true })
    .limit(20);
  if (error) { logDbReadError("my post", error); return []; }
  return data ?? [];
}

/** null = feature not available yet (migration not applied). */
export async function getPostOrderAckStatus(shiftIds: string[]): Promise<Map<string, AckStatus> | null> {
  if (!shiftIds.length) return new Map();
  const { data, error } = await createClient().rpc("post_order_ack_status", { p_shift_ids: shiftIds });
  if (error) { if (error.code !== "PGRST202" && error.code !== "42883") logDbReadError("post-order acks", error); return null; }
  return new Map(((data ?? []) as AckStatus[]).map((r) => [r.shift_id, r]));
}

export async function ackPostOrders(shiftId: string) {
  const { data, error } = await createClient().rpc("ack_post_orders", { p_shift_id: shiftId });
  if (error) throw error;
  return data;
}
