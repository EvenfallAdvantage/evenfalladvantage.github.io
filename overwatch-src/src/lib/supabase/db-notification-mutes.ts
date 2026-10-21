/**
 * Per-officer alert mutes (public.notification_mutes, own row only via RLS).
 * A mute stops phone push / email / SMS for that category; the in-app
 * notification still appears. Safety alerts (SOS, overdue patrols) can't be muted.
 */
import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

export const MUTE_OPTIONS = [
  { key: "dm", label: "Direct messages" },
  { key: "swap", label: "Shift swaps" },
  { key: "task", label: "Task assignments" },
  { key: "schedule", label: "Schedule changes" },
  { key: "guard_card", label: "Guard card reminders" },
] as const;
export type MuteKey = typeof MUTE_OPTIONS[number]["key"];
const KEYS = new Set<string>(MUTE_OPTIONS.map((o) => o.key));

export function normalizeMutes(v: unknown): MuteKey[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is MuteKey => typeof x === "string" && KEYS.has(x)))] : [];
}

export async function getMyMutes(): Promise<MuteKey[]> {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const { data, error } = await createClient().from("notification_mutes").select("muted_types").eq("user_id", userId).maybeSingle();
  if (error) return [];
  return normalizeMutes((data as { muted_types?: unknown } | null)?.muted_types);
}

export async function setMyMutes(mutes: MuteKey[]): Promise<void> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not signed in");
  const { error } = await createClient().from("notification_mutes")
    .upsert({ user_id: userId, muted_types: normalizeMutes(mutes), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
