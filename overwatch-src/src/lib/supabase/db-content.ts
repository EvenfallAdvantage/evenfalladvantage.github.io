import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";

// ─── Posts (Briefing) ───────────────────────────────────

export async function getPosts(companyId: string, limit = 20) {
  const supabase = createClient();
  const { data } = await supabase
    .from("posts")
    .select(
      `
      id, type, title, content, image_url, link_url, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .eq("company_id", companyId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function createPost(data: {
  companyId: string;
  content: string;
  title?: string;
  type?: string;
  imageUrl?: string;
  linkUrl?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      id: crypto.randomUUID(),
      company_id: data.companyId,
      user_id: userId,
      content: data.content,
      title: data.title ?? null,
      type: data.type ?? "update",
      image_url: data.imageUrl ?? null,
      link_url: data.linkUrl ?? null,
      ...ts(),
    })
    .select(
      `
      id, type, title, content, image_url, link_url, is_pinned, created_at,
      users (id, first_name, last_name, avatar_url)
    `
    )
    .maybeSingle();

  if (error) throw error;
  return post;
}

export async function togglePinPost(postId: string, pinned: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deletePost(postId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

// ─── Post Comments ──────────────────────────────────────

export async function getPostComments(postId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("post_comments")
    .select("*, users(id, first_name, last_name, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addPostComment(postId: string, content: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      id: crypto.randomUUID(),
      post_id: postId,
      user_id: userId,
      content,
      created_at: new Date().toISOString(),
    })
    .select("*, users(id, first_name, last_name, avatar_url)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deletePostComment(commentId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

// ─── Post Reactions ─────────────────────────────────────

export async function getPostReactions(postId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("post_reactions")
    .select("*, users(id, first_name, last_name)")
    .eq("post_id", postId);
  return data ?? [];
}

export async function togglePostReaction(postId: string, type: string = "like") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("post_reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    // Remove reaction
    await supabase.from("post_reactions").delete().eq("id", existing.id);
    return { action: "removed" };
  } else {
    // Add reaction
    await supabase.from("post_reactions").insert({
      id: crypto.randomUUID(),
      post_id: postId,
      user_id: userId,
      type,
      created_at: new Date().toISOString(),
    });
    return { action: "added" };
  }
}

// ─── Knowledge Base (Field Manual) ─────────────────────

export async function getKBFolders(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_folders")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function getKBDocuments(folderId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("kb_documents")
    .select("*, users(first_name, last_name)")
    .eq("folder_id", folderId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createKBFolder(params: {
  companyId: string;
  name: string;
  parentId?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_folders")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      parent_id: params.parentId ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createKBDocument(params: {
  folderId: string;
  title: string;
  content?: string;
  fileUrl?: string;
  type?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kb_documents")
    .insert({
      id: crypto.randomUUID(),
      folder_id: params.folderId,
      title: params.title,
      content: params.content ?? null,
      file_url: params.fileUrl ?? null,
      type: params.type ?? "page",
      created_by_id: userId,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteKBFolder(folderId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kb_folders").delete().eq("id", folderId);
  if (error) throw error;
}

export async function deleteKBDocument(docId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("kb_documents").delete().eq("id", docId);
  if (error) throw error;
}

// ─── Chat Channels (Comms) ─────────────────────────────

export async function getChatChannels(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_channels")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createChatChannel(params: {
  companyId: string;
  name: string;
  description?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chat_channels")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      description: params.description ?? null,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChatMessages(channelId: string, limit = 50) {
  const supabase = createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("*, users(id, first_name, last_name, avatar_url), reply:chat_messages!reply_to_id(id, content, users(first_name, last_name)), chat_reactions(id, emoji, user_id, users(first_name, last_name))")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

export async function sendChatMessage(params: {
  channelId: string;
  content: string;
  replyToId?: string;
  fileUrl?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  // Ensure user is a member of this channel
  await supabase.from("chat_members").upsert(
    { id: crypto.randomUUID(), channel_id: params.channelId, user_id: userId, role: "member", joined_at: new Date().toISOString() },
    { onConflict: "channel_id,user_id" }
  );
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      id: crypto.randomUUID(),
      channel_id: params.channelId,
      user_id: userId,
      content: params.content,
      reply_to_id: params.replyToId ?? null,
      file_url: params.fileUrl ?? null,
      created_at: new Date().toISOString(),
    })
    .select("*, users(id, first_name, last_name, avatar_url)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteChatChannel(channelId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("chat_channels").delete().eq("id", channelId);
  if (error) throw error;
}

// ─── Chat Reactions ─────────────────────────────────────

export async function toggleReaction(messageId: string, emoji: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  // Check if reaction already exists
  const { data: existing } = await supabase
    .from("chat_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("chat_reactions").delete().eq("id", existing.id);
    return { action: "removed" as const };
  } else {
    await supabase.from("chat_reactions").insert({
      id: crypto.randomUUID(),
      message_id: messageId,
      user_id: userId,
      emoji,
    });
    return { action: "added" as const };
  }
}

// ─── Read Receipts ──────────────────────────────────────

export async function updateLastRead(channelId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return;
  const supabase = createClient();
  await supabase.from("chat_members").upsert(
    { id: crypto.randomUUID(), channel_id: channelId, user_id: userId, last_read_at: new Date().toISOString(), role: "member", joined_at: new Date().toISOString() },
    { onConflict: "channel_id,user_id" }
  );
}

export async function getUnreadCounts(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return {};
  const supabase = createClient();
  // Get all channels for the company
  const { data: channels } = await supabase
    .from("chat_channels")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_archived", false);
  if (!channels?.length) return {};
  const counts: Record<string, number> = {};
  for (const ch of channels) {
    // Get member's last_read_at
    const { data: member } = await supabase
      .from("chat_members")
      .select("last_read_at")
      .eq("channel_id", ch.id)
      .eq("user_id", userId)
      .maybeSingle();
    const lastRead = member?.last_read_at;
    let query = supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", ch.id)
      .neq("user_id", userId);
    if (lastRead) query = query.gt("created_at", lastRead);
    const { count } = await query;
    if (count && count > 0) counts[ch.id] = count;
  }
  return counts;
}

// ─── WhatsApp Business API Config ───────────────────────

export async function getWaConfig(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("wa_config")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  return data;
}

export async function saveWaConfig(companyId: string, config: {
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  businessPhone: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wa_config")
    .upsert({
      company_id: companyId,
      waba_id: config.wabaId,
      phone_number_id: config.phoneNumberId,
      access_token: config.accessToken,
      business_phone: config.businessPhone,
      updated_at: new Date().toISOString(),
    }, { onConflict: "company_id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Notifications ──────────────────────────────────

export async function getNotifications(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function getUnreadNotificationCount(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return 0;
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("read", false);
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string) {
  const supabase = createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
}

export async function markAllNotificationsRead(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return;
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("read", false);
}

export async function createNotification(params: {
  userId: string;
  companyId: string;
  title: string;
  body?: string;
  type: string;
  actionUrl?: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("notifications").insert({
    id: crypto.randomUUID(),
    user_id: params.userId,
    company_id: params.companyId,
    title: params.title,
    body: params.body ?? null,
    type: params.type,
    action_url: params.actionUrl ?? null,
    read: false,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}
