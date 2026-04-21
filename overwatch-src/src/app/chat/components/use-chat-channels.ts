"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import {
  getChatChannels, createChatChannel, getChatMessages,
  sendChatMessage, deleteChatChannel, toggleReaction,
  updateLastRead, getUnreadCounts, updateChatChannel, uploadChannelAvatar,
} from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import { type Channel, type Message, type ChannelPermissions, DEFAULT_PERMS, getChannelPerms, parseExt } from "./chat-helpers";
import { logger } from "@/lib/logger";

export function useChatChannels() {
  const { user, activeCompanyId } = useAuthStore();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState<string | null>(null);
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [deletingCh, setDeletingCh] = useState<string | null>(null);
  const [showAddExt, setShowAddExt] = useState(false);
  const [extName, setExtName] = useState("");
  const [extPlat, setExtPlat] = useState<"whatsapp" | "signal">("whatsapp");
  const [extUrl, setExtUrl] = useState("");
  const [creatingExt, setCreatingExt] = useState(false);
  const [showPermEditor, setShowPermEditor] = useState(false);
  const [permForm, setPermForm] = useState<ChannelPermissions>(DEFAULT_PERMS);
  const [savingPerms, setSavingPerms] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [emojiPicker, setEmojiPicker] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<ReturnType<typeof createClient> | null>(null);

  const internal = channels.filter((c: Channel) => !parseExt(c.description));
  const external = channels.filter((c: Channel) => parseExt(c.description)).map((c: Channel) => ({ ...c, meta: parseExt(c.description)! }));

  const loadChannels = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      setChannels(await getChatChannels(activeCompanyId));
      try { setUnread(await getUnreadCounts(activeCompanyId)); } catch (e) { logger.swallow("chat:load-unread", e, "debug"); }
    } catch (e) { logger.swallow("chat:load-channels", e, "warn"); } finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Supabase Realtime subscription for new messages
  useEffect(() => {
    if (!selected) return;
    const supabase = createClient();
    realtimeRef.current = supabase;
    const channel = supabase.channel(`chat:${selected.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${selected.id}` },
        async () => {
          try { setMessages(await getChatMessages(selected.id)); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); } catch (e) { logger.swallow("chat:realtime-message", e, "debug"); }
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions", filter: `message_id=in.(${messages.map(m => m.id).join(",")})` },
        async () => {
          try { setMessages(await getChatMessages(selected.id)); } catch (e) { logger.swallow("chat:realtime-reaction", e, "debug"); }
        })
      .on("broadcast", { event: "typing" }, (payload: { payload?: { name?: string } }) => {
        const name = payload?.payload?.name;
        if (name && name !== `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()) {
          setTypingUsers(prev => prev.includes(name) ? prev : [...prev, name]);
          setTimeout(() => setTypingUsers(prev => prev.filter(n => n !== name)), 3000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function selectCh(ch: Channel) {
    setSelected(ch); setReplyTo(null); setSearchQ(""); setShowSearch(false); setEmojiPicker(null);
    try {
      setMessages(await getChatMessages(ch.id));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      updateLastRead(ch.id).then(() => setUnread(prev => { const n = { ...prev }; delete n[ch.id]; return n; })).catch(() => {});
    } catch { setMessages([]); }
  }

  function broadcastTyping() {
    if (!selected || !realtimeRef.current) return;
    const name = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    realtimeRef.current.channel(`chat:${selected.id}`).send({ type: "broadcast", event: "typing", payload: { name } }).catch(() => {});
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {}, 3000);
  }

  async function handleSend() {
    if (!msgText.trim() || !selected) return;
    setSending(true);
    try {
      await sendChatMessage({ channelId: selected.id, content: msgText.trim(), replyToId: replyTo?.id });
      setMsgText(""); setReplyTo(null);
      setMessages(await getChatMessages(selected.id));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      updateLastRead(selected.id).catch(() => {});
    } catch (err) { console.error(err); } finally { setSending(false); }
  }

  async function handleSendLocation() {
    if (!selected) return;
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setSending(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const content = `📍 My location: ${lat}, ${lng}\nhttps://www.google.com/maps?q=${lat},${lng}`;
      await sendChatMessage({ channelId: selected.id, content });
      setMessages(await getChatMessages(selected.id));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      updateLastRead(selected.id).catch(() => {});
    } catch (err) { console.error(err); toast.error("Failed to get location"); }
    finally { setSending(false); }
  }

  async function handleReaction(messageId: string, emoji: string) {
    try {
      await toggleReaction(messageId, emoji);
      setEmojiPicker(null);
      setMessages(await getChatMessages(selected!.id));
    } catch (err) { console.error(err); }
  }

  async function handleCreate() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      const avatarUrl = newAvatarUrl.trim() || undefined;
      const ch = await createChatChannel({ companyId: activeCompanyId, name: newName.trim(), avatarUrl: !newAvatarFile ? avatarUrl : undefined });
      if (newAvatarFile && ch?.id) {
        const uploadedUrl = await uploadChannelAvatar(ch.id, newAvatarFile);
        await updateChatChannel(ch.id, { avatar_url: uploadedUrl });
      }
      setNewName(""); setNewAvatarUrl(""); setNewAvatarFile(null); setShowCreate(false); await loadChannels();
      toast.success("Channel created");
    } catch (err) { console.error(err); toast.error("Failed to create channel"); } finally { setCreating(false); }
  }

  async function handleSaveAvatar(channelId: string) {
    setSavingAvatar(true);
    try {
      if (editAvatarFile) {
        const uploadedUrl = await uploadChannelAvatar(channelId, editAvatarFile);
        await updateChatChannel(channelId, { avatar_url: uploadedUrl });
      } else {
        await updateChatChannel(channelId, { avatar_url: editAvatarUrl.trim() || null });
      }
      setEditingAvatar(null); setEditAvatarUrl(""); setEditAvatarFile(null);
      await loadChannels();
      if (selected?.id === channelId) {
        const updated = (await getChatChannels(activeCompanyId!)).find((c: Channel) => c.id === channelId);
        if (updated) setSelected(updated);
      }
    } catch (err) { console.error(err); } finally { setSavingAvatar(false); }
  }

  async function handleDeleteCh(id: string) {
    if (!confirm("Delete this channel and all messages?")) return;
    setDeletingCh(id);
    try { await deleteChatChannel(id); if (selected?.id === id) { setSelected(null); setMessages([]); } await loadChannels(); toast.success("Channel deleted"); }
    catch (err) { console.error(err); toast.error("Failed to delete channel"); } finally { setDeletingCh(null); }
  }

  async function handleAddExternal() {
    if (!extName.trim() || !extUrl.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreatingExt(true);
    try {
      const desc = JSON.stringify({ external: true, platform: extPlat, url: extUrl.trim() });
      await createChatChannel({ companyId: activeCompanyId, name: extName.trim(), description: desc });
      setExtName(""); setExtUrl(""); setShowAddExt(false); await loadChannels();
    } catch (err) { console.error(err); } finally { setCreatingExt(false); }
  }

  function openPermEditor() {
    if (!selected) return;
    setPermForm(getChannelPerms(selected));
    setShowPermEditor(true);
  }

  function togglePermRole(action: keyof ChannelPermissions, role: string) {
    setPermForm(prev => ({
      ...prev,
      [action]: prev[action].includes(role)
        ? prev[action].filter(r => r !== role)
        : [...prev[action], role],
    }));
  }

  async function handleSavePerms() {
    if (!selected) return;
    setSavingPerms(true);
    try {
      await updateChatChannel(selected.id, { permissions: permForm });
      setShowPermEditor(false);
      await loadChannels();
      if (activeCompanyId) {
        const updated = (await getChatChannels(activeCompanyId)).find((c: Channel) => c.id === selected.id);
        if (updated) setSelected(updated);
      }
      toast.success("Channel permissions updated");
    } catch (err) { console.error(err); toast.error("Failed to save permissions"); }
    finally { setSavingPerms(false); }
  }

  const filteredMsgs = showSearch && searchQ
    ? messages.filter((m: Message) => m.content?.toLowerCase().includes(searchQ.toLowerCase()))
    : messages;

  return {
    user, internal, external, loading,
    selected, filteredMsgs,
    showCreate, setShowCreate, newName, setNewName,
    newAvatarUrl, setNewAvatarUrl, newAvatarFile, setNewAvatarFile,
    creating, handleCreate, selectCh, deletingCh, handleDeleteCh,
    showSearch, setShowSearch, searchQ, setSearchQ,
    replyTo, setReplyTo, msgText, setMsgText,
    sending, handleSend, handleSendLocation, bottomRef,
    unread, emojiPicker, setEmojiPicker, handleReaction,
    typingUsers, broadcastTyping,
    editingAvatar, setEditingAvatar, editAvatarUrl, setEditAvatarUrl,
    editAvatarFile, setEditAvatarFile, savingAvatar, handleSaveAvatar,
    showPermEditor, setShowPermEditor, permForm, togglePermRole,
    savingPerms, handleSavePerms, openPermEditor,
    showAddExt, setShowAddExt, extName, setExtName, extPlat, setExtPlat,
    extUrl, setExtUrl, creatingExt, handleAddExternal, loadChannels,
  };
}
