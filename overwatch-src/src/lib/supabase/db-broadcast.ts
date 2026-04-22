/**
 * Broadcast / Emergency Messaging with Acknowledgment Tracking
 *
 * Allows managers to send urgent messages to all on-duty staff
 * with push + SMS fallback and per-user read/ack receipts.
 *
 * Table: broadcasts (must be created via SQL migration)
 *   id, company_id, sender_id, title, body, urgency, target,
 *   acknowledged_by (jsonb array), created_at
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type BroadcastUrgency = "normal" | "urgent" | "critical";
export type BroadcastTarget = "all" | "on_duty" | "managers";

export interface Broadcast {
  id: string;
  companyId: string;
  senderId: string;
  senderName: string;
  title: string;
  body: string;
  urgency: BroadcastUrgency;
  target: BroadcastTarget;
  acknowledgedBy: string[];
  totalRecipients: number;
  createdAt: string;
}

// ─── Send ─────────────────────────────────────────────────

/**
 * Send a broadcast message to company members.
 * Creates the DB record and fires push+SMS via notification dispatcher.
 */
export async function sendBroadcast(
  companyId: string,
  params: {
    title: string;
    body: string;
    urgency?: BroadcastUrgency;
    target?: BroadcastTarget;
  }
): Promise<string | null> {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  const id = crypto.randomUUID();
  const urgency = params.urgency ?? "normal";
  const target = params.target ?? "all";

  // Get target recipients
  let recipientFilter = supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");

  if (target === "managers") {
    recipientFilter = recipientFilter.in("role", ["owner", "admin", "manager"]);
  }

  const { data: recipients } = await recipientFilter;
  const recipientIds = (recipients ?? []).map((r: { user_id: string }) => r.user_id);

  // If targeting on-duty, filter to currently clocked-in staff
  let finalRecipients = recipientIds;
  if (target === "on_duty") {
    const { data: onDuty } = await supabase
      .from("timesheets")
      .select("user_id")
      .eq("company_id", companyId)
      .is("clock_out", null);
    const onDutyIds = new Set((onDuty ?? []).map((t: { user_id: string }) => t.user_id));
    finalRecipients = recipientIds.filter((id: string) => onDutyIds.has(id));
  }

  // Create broadcast record
  const { error } = await supabase
    .from("broadcasts")
    .insert({
      id,
      company_id: companyId,
      sender_id: userId,
      title: params.title,
      body: params.body,
      urgency,
      target,
      acknowledged_by: [],
      total_recipients: finalRecipients.length,
      ...ts(),
    });

  if (error) {
    console.error("[Broadcast] Create failed:", error.message);
    return null;
  }

  // Fire notifications (don't block)
  import("@/lib/services/notification-dispatcher").then(({ dispatchToMany }) => {
    dispatchToMany(
      companyId,
      finalRecipients.map((uid: string) => ({ userId: uid })),
      {
        title: urgency === "critical" ? `🚨 ${params.title}` : params.title,
        body: params.body,
        type: "broadcast",
        actionUrl: `/chat`,
        urgent: urgency !== "normal",
        emailFallback: urgency === "critical",
      }
    ).catch(() => {});
  }).catch(() => {});

  return id;
}

// ─── Acknowledge ──────────────────────────────────────────

/**
 * Acknowledge a broadcast (mark as read by current user).
 */
export async function acknowledgeBroadcast(broadcastId: string): Promise<boolean> {
  const userId = await ensureInternalUser();
  if (!userId) return false;

  const supabase = createClient();

  // Get current acknowledged list
  const { data } = await supabase
    .from("broadcasts")
    .select("acknowledged_by")
    .eq("id", broadcastId)
    .maybeSingle();

  const current = (data?.acknowledged_by as string[]) ?? [];
  if (current.includes(userId)) return true; // Already acknowledged

  const { error } = await supabase
    .from("broadcasts")
    .update({
      acknowledged_by: [...current, userId],
      updated_at: new Date().toISOString(),
    })
    .eq("id", broadcastId);

  return !error;
}

// ─── Queries ──────────────────────────────────────────────

/**
 * Get recent broadcasts for a company.
 */
export async function getCompanyBroadcasts(
  companyId: string,
  limit = 20
): Promise<Broadcast[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("broadcasts")
    .select("*, users!broadcasts_sender_id_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { logDbReadError("broadcasts", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((b: any) => ({
    id: b.id,
    companyId: b.company_id,
    senderId: b.sender_id,
    senderName: b.users ? `${b.users.first_name} ${b.users.last_name}` : "Unknown",
    title: b.title,
    body: b.body,
    urgency: b.urgency,
    target: b.target,
    acknowledgedBy: b.acknowledged_by ?? [],
    totalRecipients: b.total_recipients ?? 0,
    createdAt: b.created_at,
  }));
}
