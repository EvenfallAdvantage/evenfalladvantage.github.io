/**
 * Direct Messages — 1:1 private messaging between staff members.
 */

import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

export interface DirectMessage {
  id: string;
  companyId: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  fileUrl: string | null;
  readAt: string | null;
  createdAt: string;
  // Joined fields
  fromUser?: { firstName: string; lastName: string; avatarUrl: string | null };
  toUser?: { firstName: string; lastName: string; avatarUrl: string | null };
}

export interface DMConversation {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

/**
 * Get all DM conversations for the current user in a company.
 * Returns a list of unique conversation partners with last message preview.
 */
export async function getDMConversations(companyId: string): Promise<DMConversation[]> {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("direct_messages")
    .select("*, from_user:users!direct_messages_from_user_id_fkey(id, first_name, last_name, avatar_url), to_user:users!direct_messages_to_user_id_fkey(id, first_name, last_name, avatar_url)")
    .eq("company_id", companyId)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) { console.error("[DM] Fetch conversations failed:", error); return []; }

  // Group by conversation partner
  const convMap = new Map<string, DMConversation>();
  for (const msg of data ?? []) {
    const isSender = msg.from_user_id === userId;
    const partner = isSender ? msg.to_user : msg.from_user;
    const partnerId = isSender ? msg.to_user_id : msg.from_user_id;

    if (!convMap.has(partnerId)) {
      convMap.set(partnerId, {
        userId: partnerId,
        firstName: partner?.first_name ?? "",
        lastName: partner?.last_name ?? "",
        avatarUrl: partner?.avatar_url ?? null,
        lastMessage: msg.content,
        lastMessageAt: msg.created_at,
        unreadCount: 0,
      });
    }

    // Count unread messages TO the current user
    if (!isSender && !msg.read_at) {
      const conv = convMap.get(partnerId)!;
      conv.unreadCount++;
    }
  }

  return [...convMap.values()].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/**
 * Get messages in a conversation with a specific user.
 */
export async function getDMMessages(
  companyId: string,
  otherUserId: string,
  limit = 50
): Promise<DirectMessage[]> {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();

  const { data, error } = await supabase
    .from("direct_messages")
    .select("*, from_user:users!direct_messages_from_user_id_fkey(first_name, last_name, avatar_url), to_user:users!direct_messages_to_user_id_fkey(first_name, last_name, avatar_url)")
    .eq("company_id", companyId)
    .or(`and(from_user_id.eq.${userId},to_user_id.eq.${otherUserId}),and(from_user_id.eq.${otherUserId},to_user_id.eq.${userId})`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) { console.error("[DM] Fetch messages failed:", error); return []; }

  return (data ?? []).map((m: Record<string, unknown> & { from_user?: Record<string, string>; to_user?: Record<string, string> }) => ({
    id: m.id as string,
    companyId: m.company_id as string,
    fromUserId: m.from_user_id as string,
    toUserId: m.to_user_id as string,
    content: m.content as string,
    fileUrl: m.file_url as string | null,
    readAt: m.read_at as string | null,
    createdAt: m.created_at as string,
    fromUser: m.from_user ? { firstName: m.from_user.first_name ?? "", lastName: m.from_user.last_name ?? "", avatarUrl: m.from_user.avatar_url ?? null } : undefined,
    toUser: m.to_user ? { firstName: m.to_user.first_name ?? "", lastName: m.to_user.last_name ?? "", avatarUrl: m.to_user.avatar_url ?? null } : undefined,
  }));
}

/**
 * Send a direct message to another user.
 */
export async function sendDM(
  companyId: string,
  toUserId: string,
  content: string,
  fileUrl?: string
): Promise<DirectMessage | null> {
  const userId = await ensureInternalUser();
  if (!userId) return null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      company_id: companyId,
      from_user_id: userId,
      to_user_id: toUserId,
      content,
      file_url: fileUrl ?? null,
    })
    .select()
    .single();

  if (error) { console.error("[DM] Send failed:", error); return null; }

  return {
    id: data.id,
    companyId: data.company_id,
    fromUserId: data.from_user_id,
    toUserId: data.to_user_id,
    content: data.content,
    fileUrl: data.file_url,
    readAt: data.read_at,
    createdAt: data.created_at,
  };
}

/**
 * Mark all messages from a specific user as read.
 */
export async function markDMsAsRead(companyId: string, fromUserId: string): Promise<void> {
  const userId = await ensureInternalUser();
  if (!userId) return;
  const supabase = createClient();

  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("from_user_id", fromUserId)
    .eq("to_user_id", userId)
    .is("read_at", null);
}

/**
 * Get total unread DM count for the current user.
 */
export async function getUnreadDMCount(companyId: string): Promise<number> {
  const userId = await ensureInternalUser();
  if (!userId) return 0;
  const supabase = createClient();

  const { count, error } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("to_user_id", userId)
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Subscribe to new DMs in real-time.
 */
export function subscribeDMs(companyId: string, userId: string, onNew: () => void): () => void {
  const supabase = createClient();
  const channel = supabase
    .channel(`dm-${companyId}-${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "direct_messages",
      filter: `to_user_id=eq.${userId}`,
    }, () => onNew())
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
