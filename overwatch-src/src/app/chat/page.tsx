"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  Radio, Radar, Plus, Send, Loader2, Trash2, Search, ExternalLink,
  Reply, X, Hash, MessageSquare, Mail, MapPin,
  Smile, Paperclip, Upload, Pencil, Settings2,
} from "lucide-react";
import { DirectMessages } from "@/components/direct-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChatSkeleton } from "@/components/loading-skeleton";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import {
  getChatChannels, createChatChannel, getChatMessages,
  sendChatMessage, deleteChatChannel, toggleReaction,
  updateLastRead, getUnreadCounts, updateChatChannel, uploadChannelAvatar,
} from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import { usePageHeader } from "@/stores/page-header-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Channel = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = any;
type Tab = "channels" | "external" | "messages";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🔥", "👀", "✅"];

const ALL_ROLES = ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"] as const;
type ChannelPermissions = { can_post: string[]; can_react: string[]; can_pin: string[] };
const DEFAULT_PERMS: ChannelPermissions = {
  can_post: ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"],
  can_react: ["owner", "admin", "instructor", "manager", "lead", "breaker", "staff"],
  can_pin: ["owner", "admin", "manager"],
};

function getChannelPerms(channel: Channel): ChannelPermissions {
  if (channel?.permissions && typeof channel.permissions === "object") return { ...DEFAULT_PERMS, ...channel.permissions };
  return DEFAULT_PERMS;
}

/* ── helpers ────────────────────────────────────── */

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

type ExtMeta = { external: true; platform: string; url: string };

function parseExt(desc: string | null): ExtMeta | null {
  if (!desc) return null;
  try { const m = JSON.parse(desc); if (m?.external && m?.url) return m; } catch {}
  return null;
}

const PLAT: Record<string, { color: string; bg: string; label: string; logo: string }> = {
  whatsapp: { color: "text-green-500", bg: "bg-green-500/10", label: "WhatsApp", logo: "/overwatch/images/integrations/whatsapp.svg" },
  signal: { color: "text-blue-400", bg: "bg-blue-400/10", label: "Signal", logo: "/overwatch/images/integrations/signal.svg" },
  discord: { color: "text-indigo-400", bg: "bg-indigo-400/10", label: "Discord", logo: "/overwatch/images/integrations/discord.svg" },
  telegram: { color: "text-sky-400", bg: "bg-sky-400/10", label: "Telegram", logo: "/overwatch/images/integrations/telegram.svg" },
  slack: { color: "text-purple-500", bg: "bg-purple-500/10", label: "Slack", logo: "/overwatch/images/integrations/slack.svg" },
  other: { color: "text-muted-foreground", bg: "bg-muted/50", label: "Other", logo: "" },
};

const EXT_PLATFORM_OPTIONS = ["whatsapp", "signal", "discord", "telegram", "slack", "other"] as const;

export default function ChatPage() {
  const { user, activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const searchParams = useSearchParams();

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const dmUserId = searchParams.get("dm");
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    dmUserId ? "messages" :
    tabParam === "messages" ? "messages" :
    tabParam === "external" ? "external" :
    "channels"
  );

  useEffect(() => {
    setHeader("COMMS", "Team channels, direct messages, and external groups",
      tab === "external" ? <ExternalLink className="h-5 w-5" /> : tab === "messages" ? <Mail className="h-5 w-5" /> : <Hash className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader, tab]);
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
      try { setUnread(await getUnreadCounts(activeCompanyId)); } catch {}
    } catch {} finally { setLoading(false); }
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
          try { setMessages(await getChatMessages(selected.id)); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100); } catch {}
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_reactions", filter: `message_id=in.(${messages.map(m => m.id).join(",")})` },
        async () => {
          try { setMessages(await getChatMessages(selected.id)); } catch {}
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
    } catch (err) {
      console.error(err);
      toast.error("Failed to get location");
    } finally { setSending(false); }
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
      // Create channel first (with URL avatar if provided, or without)
      const ch = await createChatChannel({ companyId: activeCompanyId, name: newName.trim(), avatarUrl: !newAvatarFile ? avatarUrl : undefined });
      // If file was uploaded, upload it and update the channel
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
      // Update selected channel in place
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

  /* ── RENDER ── */
  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
        <Link href="/updates"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
          Briefing
        </Link>
        <button onClick={() => setTab("channels")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "channels" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
          {tab === "channels" && <Hash className="h-3.5 w-3.5 text-primary" />}
          Channels
          {internal.length > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{internal.length}</Badge>}
        </button>
        <button onClick={() => setTab("messages")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "messages" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
          {tab === "messages" && <Mail className="h-3.5 w-3.5 text-primary" />}
          Messages
        </button>
        <button onClick={() => setTab("external")}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "external" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
          {tab === "external" && <ExternalLink className="h-3.5 w-3.5 text-primary" />}
          External Groups
          {external.length > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{external.length}</Badge>}
        </button>
      </div>

      {/* ────────── CHANNELS TAB ────────── */}
      {tab === "channels" && (<ChannelsTab
        loading={loading} internal={internal} external={external} selected={selected}
        showCreate={showCreate} setShowCreate={setShowCreate} newName={newName} setNewName={setNewName}
        newAvatarUrl={newAvatarUrl} setNewAvatarUrl={setNewAvatarUrl}
        newAvatarFile={newAvatarFile} setNewAvatarFile={setNewAvatarFile}
        creating={creating} handleCreate={handleCreate} selectCh={selectCh} deletingCh={deletingCh}
        handleDeleteCh={handleDeleteCh} isAdmin={isAdmin} showSearch={showSearch} setShowSearch={setShowSearch}
        searchQ={searchQ} setSearchQ={setSearchQ} filteredMsgs={filteredMsgs} user={user}
        replyTo={replyTo} setReplyTo={setReplyTo} msgText={msgText} setMsgText={setMsgText}
        sending={sending} handleSend={handleSend} handleSendLocation={handleSendLocation} bottomRef={bottomRef}
        unread={unread} emojiPicker={emojiPicker} setEmojiPicker={setEmojiPicker}
        handleReaction={handleReaction} typingUsers={typingUsers} broadcastTyping={broadcastTyping}
        editingAvatar={editingAvatar} setEditingAvatar={setEditingAvatar}
        editAvatarUrl={editAvatarUrl} setEditAvatarUrl={setEditAvatarUrl}
        editAvatarFile={editAvatarFile} setEditAvatarFile={setEditAvatarFile}
        savingAvatar={savingAvatar} handleSaveAvatar={handleSaveAvatar}
        userRole={(activeCompany?.role ?? "staff")}
        showPermEditor={showPermEditor} setShowPermEditor={setShowPermEditor}
        permForm={permForm} togglePermRole={togglePermRole}
        savingPerms={savingPerms} handleSavePerms={handleSavePerms}
        openPermEditor={openPermEditor}
      />)}

      {/* ────────── MESSAGES (DM) TAB ────────── */}
      {tab === "messages" && activeCompanyId && activeCompanyId !== "pending" && (
        <DirectMessages companyId={activeCompanyId} initialUserId={dmUserId} />
      )}

      {/* ────────── EXTERNAL GROUPS TAB ────────── */}
      {tab === "external" && (<ExternalTab
        isAdmin={isAdmin} external={external} showAddExt={showAddExt} setShowAddExt={setShowAddExt}
        extName={extName} setExtName={setExtName} extPlat={extPlat} setExtPlat={setExtPlat}
        extUrl={extUrl} setExtUrl={setExtUrl} creatingExt={creatingExt} handleAddExternal={handleAddExternal}
        handleDeleteCh={handleDeleteCh} loadChannels={loadChannels}
      />)}

    </div>
  );
}

/* ══════════════════════════════════════════════════
   SUB-COMPONENTS (keep file organized)
   ══════════════════════════════════════════════════ */

function ChannelsTab({ loading, internal, external, selected, showCreate, setShowCreate, newName, setNewName,
  newAvatarUrl, setNewAvatarUrl, newAvatarFile, setNewAvatarFile,
  creating, handleCreate, selectCh, deletingCh, handleDeleteCh, isAdmin, showSearch, setShowSearch,
  searchQ, setSearchQ, filteredMsgs, user, replyTo, setReplyTo, msgText, setMsgText, sending, handleSend, handleSendLocation, bottomRef,
  unread, emojiPicker, setEmojiPicker, handleReaction, typingUsers, broadcastTyping,
  editingAvatar, setEditingAvatar, editAvatarUrl, setEditAvatarUrl, editAvatarFile, setEditAvatarFile,
  savingAvatar, handleSaveAvatar,
  userRole, showPermEditor, setShowPermEditor, permForm, togglePermRole, savingPerms, handleSavePerms, openPermEditor,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) {

  // Group reactions by emoji for a message
  function groupReactions(reactions: { id: string; emoji: string; user_id: string; users: { first_name: string; last_name: string } }[] | null) {
    if (!reactions?.length) return [];
    const map: Record<string, { emoji: string; count: number; userIds: string[]; names: string[] }> = {};
    for (const r of reactions) {
      if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], names: [] };
      map[r.emoji].count++;
      map[r.emoji].userIds.push(r.user_id);
      map[r.emoji].names.push(`${r.users?.first_name ?? ""} ${r.users?.last_name ?? ""}`.trim());
    }
    return Object.values(map);
  }

  return (
    <>
      {showCreate && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
          <div className="flex gap-2">
            <Input placeholder="Channel name..." value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} className="flex-1"
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleCreate(); }} />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewAvatarUrl(""); setNewAvatarFile(null); }}>Cancel</Button>
          </div>
          <div className="flex gap-2 items-center">
            <Input placeholder="Avatar image URL (optional)" value={newAvatarUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewAvatarUrl(e.target.value); setNewAvatarFile(null); }} className="text-xs flex-1" disabled={!!newAvatarFile} />
            <span className="text-[10px] text-muted-foreground">or</span>
            <label className="flex items-center gap-1.5 rounded-md border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 cursor-pointer transition-colors">
              <Upload className="h-3.5 w-3.5" /> Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNewAvatarFile(f); setNewAvatarUrl(""); } }} />
            </label>
          </div>
          {(newAvatarUrl.trim() || newAvatarFile) && (
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full overflow-hidden border border-border/50 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={newAvatarFile ? URL.createObjectURL(newAvatarFile) : newAvatarUrl.trim()} alt="Preview" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              </div>
              <span className="text-[10px] text-muted-foreground">{newAvatarFile ? newAvatarFile.name : "Avatar preview"}</span>
              {newAvatarFile && <button onClick={() => setNewAvatarFile(null)} className="text-muted-foreground hover:text-red-500"><X className="h-3 w-3" /></button>}
            </div>
          )}
        </div>
      )}

      {loading ? <ChatSkeleton /> : internal.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <Radio className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No channels yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {isAdmin ? "Create a channel to start team communications." : "Your organization hasn't set up any channels yet."}
          </p>
          {isAdmin && <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Channel</Button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]" style={{ minHeight: "60vh" }}>
          {/* Sidebar */}
          <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3 overflow-y-auto max-h-[70vh]">
            {isAdmin && (
              <button onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors mb-1">
                <Plus className="h-3.5 w-3.5" /> New Channel
              </button>
            )}
            {internal.map((ch: Channel) => {
              const unreadCount = unread[ch.id] ?? 0;
              return (
                <div key={ch.id} onClick={() => selectCh(ch)}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${selected?.id === ch.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 relative overflow-hidden">
                    {ch.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ch.avatar_url} alt={ch.name} className="h-full w-full object-cover" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-primary" />
                    )}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className={`truncate flex-1 ${unreadCount > 0 ? "font-bold" : "font-medium"}`}>{ch.name}</span>
                  {isAdmin && (
                    <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeleteCh(ch.id); }} disabled={deletingCh === ch.id}
                      className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deletingCh === ch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              );
            })}
            {external.length > 0 && (
              <>
                <div className="mt-3 mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">External Groups</div>
                {external.map((g: Channel & { meta: ExtMeta }) => {
                  const p = PLAT[g.meta.platform] ?? PLAT.whatsapp;
                  return (
                    <a key={g.id} href={g.meta.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.bg} overflow-hidden`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.logo} alt={p.label} className="h-5 w-5 object-contain" />
                      </div>
                      <span className="truncate font-medium flex-1">{g.name}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/40" />
                    </a>
                  );
                })}
              </>
            )}
          </div>

          {/* Chat area */}
          {selected ? (
            <div className="flex flex-col rounded-xl border border-border/50 bg-card">
              <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
                <div className="relative shrink-0 group/avatar">
                  <div className="h-7 w-7 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center">
                    {selected.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.avatar_url} alt="Channel avatar" className="h-full w-full object-cover" />
                    ) : (
                      <Hash className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  {isAdmin && (
                    <button onClick={() => { setEditingAvatar(editingAvatar === selected.id ? null : selected.id); setEditAvatarUrl(selected.avatar_url ?? ""); setEditAvatarFile(null); }}
                      className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background border border-border/50 p-0.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                      title="Change avatar">
                      <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <h2 className="font-semibold text-sm flex-1 min-w-0">{selected.name}</h2>
                {isAdmin && (
                  <button onClick={openPermEditor}
                    className={`rounded p-1.5 transition-colors ${showPermEditor ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                    title="Channel permissions" aria-label="Channel permissions">
                    <Settings2 className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => { setShowSearch(!showSearch); setSearchQ(""); }}
                  className={`rounded p-1.5 transition-colors ${showSearch ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}>
                  <Search className="h-4 w-4" />
                </button>
              </div>
              {editingAvatar === selected.id && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2 bg-muted/30">
                  <Input placeholder="Avatar URL..." value={editAvatarUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEditAvatarUrl(e.target.value); setEditAvatarFile(null); }}
                    className="h-7 text-xs flex-1 min-w-[140px]" disabled={!!editAvatarFile} />
                  <label className="flex items-center gap-1 rounded-md border border-border/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 cursor-pointer transition-colors">
                    <Upload className="h-3 w-3" /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setEditAvatarFile(f); setEditAvatarUrl(""); } }} />
                  </label>
                  {editAvatarFile && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {editAvatarFile.name.slice(0, 20)}
                      <button onClick={() => setEditAvatarFile(null)} className="text-muted-foreground hover:text-red-500"><X className="h-2.5 w-2.5" /></button>
                    </span>
                  )}
                  <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleSaveAvatar(selected.id)} disabled={savingAvatar || (!editAvatarUrl.trim() && !editAvatarFile)}>
                    {savingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <button onClick={() => { setEditingAvatar(null); setEditAvatarUrl(""); setEditAvatarFile(null); }} className="text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              {showPermEditor && (
                <div className="border-b border-border/50 px-4 py-3 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Channel Permissions</p>
                    <button onClick={() => setShowPermEditor(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {(["can_post", "can_react", "can_pin"] as const).map(action => (
                    <div key={action}>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1 capitalize">{action.replace("can_", "Can ")}</p>
                      <div className="flex flex-wrap gap-1">
                        {ALL_ROLES.map(role => (
                          <button key={role} onClick={() => togglePermRole(action, role)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors capitalize ${
                              permForm[action].includes(role) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:text-foreground"
                            }`}>
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button size="sm" className="h-6 text-[10px] px-3 gap-1" onClick={handleSavePerms} disabled={savingPerms}>
                    {savingPerms ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save Permissions"}
                  </Button>
                </div>
              )}
              {showSearch && (
                <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input placeholder="Search messages..." value={searchQ} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQ(e.target.value)}
                    className="h-7 text-xs flex-1" autoFocus />
                  {searchQ && <span className="text-[10px] text-muted-foreground shrink-0">{filteredMsgs.length} found</span>}
                  <button onClick={() => { setShowSearch(false); setSearchQ(""); }} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[50vh]">
                {filteredMsgs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">{showSearch ? "No messages match your search." : "No messages yet. Start the conversation!"}</p>
                ) : filteredMsgs.map((msg: Message) => {
                  const author = msg.users;
                  const isMe = author?.id === user?.id;
                  const replyData = msg.reply;
                  const reactions = groupReactions(msg.chat_reactions);
                  return (
                    <div key={msg.id} className={`group flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-7 w-7 shrink-0 mt-1">
                        <AvatarImage src={author?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">
                          {(author?.first_name?.[0] ?? "")}{(author?.last_name?.[0] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className={`flex items-center gap-2 mb-0.5 ${isMe ? "flex-row-reverse" : ""}`}>
                          {!isMe && <span className="text-[10px] font-semibold text-muted-foreground">{author?.first_name} {author?.last_name}</span>}
                          <span className="text-[9px] text-muted-foreground/50">{timeAgo(msg.created_at)}</span>
                        </div>
                        {replyData && (
                          <div className={`rounded-lg px-2.5 py-1 mb-1 text-[10px] border-l-2 border-primary/40 max-w-full ${isMe ? "bg-primary/20" : "bg-muted/70"}`}>
                            <span className="font-semibold">{replyData.users?.first_name} {replyData.users?.last_name}</span>
                            <p className="truncate text-muted-foreground">{(replyData.content ?? "").slice(0, 80)}</p>
                          </div>
                        )}
                        {msg.file_url && (
                          <div className="mb-1">
                            {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_url) ? (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                                <img src={msg.file_url} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-border/50" />
                              </a>
                            ) : (
                              <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-primary hover:underline">
                                <Paperclip className="h-3 w-3" /> Attachment
                              </a>
                            )}
                          </div>
                        )}
                        <div className={`rounded-xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        {/* Reactions display */}
                        {reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {reactions.map(r => (
                              <button key={r.emoji} onClick={() => handleReaction(msg.id, r.emoji)}
                                title={r.names.join(", ")}
                                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] border transition-colors ${r.userIds.includes(user?.id) ? "border-primary/40 bg-primary/10" : "border-border/40 bg-muted/30 hover:bg-muted/50"}`}>
                                <span>{r.emoji}</span>
                                <span className="font-medium">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Action bar */}
                        <div className="flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setReplyTo(msg)}
                            className="flex items-center gap-1 text-[9px] text-muted-foreground/40 hover:text-muted-foreground rounded px-1 py-0.5 hover:bg-accent">
                            <Reply className="h-3 w-3" /> Reply
                          </button>
                          <div className="relative">
                            <button onClick={() => setEmojiPicker(emojiPicker === msg.id ? null : msg.id)}
                              className="flex items-center gap-1 text-[9px] text-muted-foreground/40 hover:text-muted-foreground rounded px-1 py-0.5 hover:bg-accent">
                              <Smile className="h-3 w-3" /> React
                            </button>
                            {emojiPicker === msg.id && (
                              <div className={`absolute z-10 top-full mt-1 flex gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg ${isMe ? "right-0" : "left-0"}`}>
                                {QUICK_EMOJIS.map(e => (
                                  <button key={e} onClick={() => handleReaction(msg.id, e)}
                                    className="rounded px-1.5 py-1 text-sm hover:bg-accent transition-colors">{e}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="px-4 py-1 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground animate-pulse">
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                  </p>
                </div>
              )}
              {replyTo && (
                <div className="flex items-center gap-2 border-t border-border/50 bg-muted/30 px-4 py-2">
                  <Reply className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold">{replyTo.users?.first_name} {replyTo.users?.last_name}</span>
                    <p className="text-[10px] text-muted-foreground truncate">{(replyTo.content ?? "").slice(0, 80)}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Close"><X className="h-3.5 w-3.5" /></button>
                </div>
              )}
              <div className="border-t border-border/50 p-3">
                {getChannelPerms(selected).can_post.includes(userRole) ? (
                  <div className="flex gap-2">
                    <Input placeholder={replyTo ? "Type your reply..." : "Type a message..."} value={msgText}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setMsgText(e.target.value); broadcastTyping(); }}
                      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="flex-1" />
                    <Button size="sm" variant="ghost" onClick={handleSendLocation} disabled={sending} title="Send my location" aria-label="Send location">
                      <MapPin className="h-4 w-4" />
                    </Button>
                    <Button size="sm" onClick={handleSend} disabled={!msgText.trim() || sending} aria-label="Send message">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-1">You don&apos;t have permission to post in this channel.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Select a channel</p>
              <p className="mt-1 text-xs text-muted-foreground">Choose a channel from the sidebar to start messaging</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ExternalTab({ isAdmin, external, showAddExt, setShowAddExt, extName, setExtName, extPlat, setExtPlat, extUrl, setExtUrl, creatingExt, handleAddExternal, handleDeleteCh, loadChannels }: any) {
  const [editingExternal, setEditingExternal] = useState<string | null>(null);
  const [extEditForm, setExtEditForm] = useState({ name: "", url: "", platform: "" });
  const [savingExtEdit, setSavingExtEdit] = useState(false);

  async function handleSaveExtEdit(channelId: string) {
    if (!extEditForm.name.trim() || !extEditForm.url.trim()) return;
    setSavingExtEdit(true);
    try {
      const desc = JSON.stringify({ external: true, platform: extEditForm.platform, url: extEditForm.url.trim() });
      await updateChatChannel(channelId, { name: extEditForm.name.trim(), description: desc });
      setEditingExternal(null);
      await loadChannels();
      toast.success("External group updated");
    } catch (err) { console.error("External group update failed:", err); toast.error("Failed to update group"); }
    finally { setSavingExtEdit(false); }
  }

  return (
    <div className="space-y-4">
      {isAdmin && !showAddExt && (
        <Button size="sm" className="gap-1.5" onClick={() => setShowAddExt(true)}>
          <Plus className="h-4 w-4" /> Add External Group
        </Button>
      )}
      {showAddExt && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
          <p className="text-sm font-medium">Link an External Group</p>
          <p className="text-xs text-muted-foreground">Add a WhatsApp or Signal group link so your team can jump in with one tap.</p>
          <div className="flex gap-2">
            <button onClick={() => setExtPlat("whatsapp")}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${extPlat === "whatsapp" ? "border-green-500 bg-green-500/10 text-green-500" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PLAT.whatsapp.logo} alt="WhatsApp" className="h-5 w-5" /> WhatsApp
            </button>
            <button onClick={() => setExtPlat("signal")}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${extPlat === "signal" ? "border-blue-400 bg-blue-400/10 text-blue-400" : "border-border/40 text-muted-foreground hover:text-foreground"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PLAT.signal.logo} alt="Signal" className="h-5 w-5" /> Signal
            </button>
          </div>
          <Input placeholder="Group name (e.g. Ops Chat, Night Shift)" value={extName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtName(e.target.value)} />
          <Input placeholder={extPlat === "whatsapp" ? "https://chat.whatsapp.com/..." : "https://signal.group/..."} value={extUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtUrl(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddExternal} disabled={!extName.trim() || !extUrl.trim() || creatingExt}>
              {creatingExt ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Group"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddExt(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {external.length === 0 && !showAddExt ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <ExternalLink className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No external groups linked</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {isAdmin ? "Link your WhatsApp or Signal groups so your team can jump in with one tap." : "No external messaging groups have been configured yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {external.map((g: Channel & { meta: ExtMeta }) => {
            const p = PLAT[g.meta.platform] ?? PLAT.whatsapp;
            const isEditing = editingExternal === g.id;
            return (
              <div key={g.id} className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input placeholder="Group name" value={extEditForm.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtEditForm(f => ({ ...f, name: e.target.value }))} className="h-8 text-sm" />
                    <Input placeholder="Group URL" value={extEditForm.url} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtEditForm(f => ({ ...f, url: e.target.value }))} className="h-8 text-sm" />
                    <select value={extEditForm.platform} onChange={(e) => setExtEditForm(f => ({ ...f, platform: e.target.value }))}
                      className="w-full h-8 rounded-md border border-border/40 bg-background px-2 text-xs">
                      {EXT_PLATFORM_OPTIONS.map(opt => <option key={opt} value={opt}>{PLAT[opt]?.label ?? opt}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => handleSaveExtEdit(g.id)} disabled={savingExtEdit || !extEditForm.name.trim() || !extEditForm.url.trim()}>
                        {savingExtEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingExternal(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${p.bg} overflow-hidden`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.logo} alt={p.label} className="h-6 w-6 object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{g.name}</p>
                        <p className={`text-xs ${p.color}`}>{p.label} Group</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a href={g.meta.url} target="_blank" rel="noopener noreferrer"
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg ${p.bg} ${p.color} px-3 py-2 text-xs font-medium hover:opacity-80 transition-opacity`}>
                        <ExternalLink className="h-3.5 w-3.5" /> Open in {p.label}
                      </a>
                      {isAdmin && (
                        <button onClick={() => { setEditingExternal(g.id); setExtEditForm({ name: g.name, url: g.meta.url, platform: g.meta.platform }); }}
                          className="rounded-lg border border-border/40 px-2.5 text-muted-foreground/40 hover:text-primary hover:border-primary/30 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDeleteCh(g.id)}
                          className="rounded-lg border border-border/40 px-2.5 text-muted-foreground/40 hover:text-red-500 hover:border-red-500/30 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

