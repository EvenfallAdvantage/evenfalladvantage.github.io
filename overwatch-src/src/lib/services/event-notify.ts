/**
 * Phone alerts for everyday events: direct messages, shift swaps and task
 * assignments. Each goes through the normal dispatcher (in-app row + Web
 * Push via notify-send). Never throws: a failed alert must not fail the
 * action that triggered it.
 */
import { logger } from "@/lib/logger";
import type { NotifyRef } from "./notify-client";

/** Don't push more than one DM alert per recipient per 2 minutes from this device. */
export const DM_PUSH_COOLDOWN_MS = 2 * 60_000;
const lastDmPush = new Map<string, number>();

export function shouldPushDm(toUserId: string, now = Date.now()): boolean {
  const last = lastDmPush.get(toUserId);
  if (last !== undefined && now - last < DM_PUSH_COOLDOWN_MS) return false;
  lastDmPush.set(toUserId, now);
  return true;
}

export function previewText(s: string, max = 120): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export async function notifyEvent(p: {
  companyId: string;
  userId: string;
  title: string;
  body?: string;
  type: "dm" | "shift_swap" | "task";
  actionUrl: string;
  ref?: NotifyRef;
}): Promise<void> {
  try {
    const { dispatch } = await import("./notification-dispatcher");
    await dispatch({ companyId: p.companyId, userId: p.userId, title: p.title, body: p.body, type: p.type, actionUrl: p.actionUrl, ref: p.ref });
  } catch (e) {
    logger.swallow(`event-notify:${p.type}`, e, "warn");
  }
}

/** First name + last initial of the signed-in user (for "Message from …"). */
export async function myShortName(): Promise<string> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const { ensureInternalUser } = await import("@/lib/supabase/db-helpers");
    const id = await ensureInternalUser();
    if (!id) return "A teammate";
    const { data } = await createClient().from("users").select("first_name, last_name").eq("id", id).maybeSingle();
    const f = (data as { first_name?: string } | null)?.first_name ?? "";
    const l = (data as { last_name?: string } | null)?.last_name ?? "";
    return `${f} ${l ? l[0] + "." : ""}`.trim() || "A teammate";
  } catch { return "A teammate"; }
}
