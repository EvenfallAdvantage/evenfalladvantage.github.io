"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Radio, Plus, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ChatSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { getChatChannels, createChatChannel, getChatMessages, sendChatMessage, deleteChatChannel } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Channel = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Message = any;

export default function ChatPage() {
  const { user, activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgText, setMsgText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setChannels(await getChatChannels(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  async function selectChannel(ch: Channel) {
    setSelected(ch);
    try {
      const msgs = await getChatMessages(ch.id);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { setMessages([]); }
  }

  async function handleSend() {
    if (!msgText.trim() || !selected) return;
    setSending(true);
    try {
      await sendChatMessage({ channelId: selected.id, content: msgText.trim() });
      setMsgText("");
      const msgs = await getChatMessages(selected.id);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) { console.error("Send failed:", err); }
    finally { setSending(false); }
  }

  // Auto-refresh messages every 5 seconds when a channel is selected
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(async () => {
      try {
        const msgs = await getChatMessages(selected.id);
        setMessages(msgs);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [selected]);

  async function handleDeleteChannel(chId: string) {
    if (!confirm("Delete this channel and all messages?")) return;
    setDeletingChannel(chId);
    try {
      await deleteChatChannel(chId);
      if (selected?.id === chId) { setSelected(null); setMessages([]); }
      await loadChannels();
    } catch (err) { console.error(err); }
    finally { setDeletingChannel(null); }
  }

  async function handleCreate() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createChatChannel({ companyId: activeCompanyId, name: newName.trim() });
      setNewName(""); setShowCreate(false); await loadChannels();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono uppercase flex items-center gap-2"><Radio className="h-5 w-5 sm:h-6 sm:w-6" /> Comms</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Secure channels and team communications</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> New Channel
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Channel name..." value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <ChatSkeleton />
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Radio className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No channels yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Create a channel to start team communications." : "Your organization hasn't set up any channels yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]" style={{ minHeight: "60vh" }}>
            <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
              {channels.map((ch: Channel) => (
                <div key={ch.id} onClick={() => selectChannel(ch)}
                  className={`group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${selected?.id === ch.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                    {ch.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate font-medium">{ch.name}</span>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChannel(ch.id); }} disabled={deletingChannel === ch.id}
                      className="ml-auto rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete channel">
                      {deletingChannel === ch.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selected ? (
              <div className="flex flex-col rounded-xl border border-border/50 bg-card">
                <div className="border-b border-border/50 px-4 py-3">
                  <h2 className="font-semibold text-sm">{selected.name}</h2>
                  {selected.description && <p className="text-xs text-muted-foreground">{selected.description}</p>}
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[50vh]">
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                  ) : messages.map((msg: Message) => {
                    const author = msg.users;
                    const isMe = author?.id === user?.id;
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                          {(author?.first_name?.[0] ?? "")}{(author?.last_name?.[0] ?? "")}
                        </div>
                        <div className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {!isMe && <p className="text-[10px] font-semibold mb-0.5">{author?.first_name} {author?.last_name}</p>}
                          <p>{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-border/50 p-3">
                  <div className="flex gap-2">
                    <Input placeholder="Type a message..." value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      className="flex-1" />
                    <Button size="sm" onClick={handleSend} disabled={!msgText.trim() || sending}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <Radio className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">Select a channel</p>
                <p className="mt-1 text-xs text-muted-foreground">Choose a channel to start messaging</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
