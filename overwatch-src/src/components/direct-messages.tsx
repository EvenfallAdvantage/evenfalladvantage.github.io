"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Loader2, Check, CheckCheck, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import {
  getDMConversations, getDMMessages, sendDM, markDMsAsRead,
  subscribeDMs, type DMConversation, type DirectMessage,
} from "@/lib/supabase/db-messages";
import { getCompanyMembers } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface DirectMessagesProps {
  companyId: string;
  /** Auto-select a conversation with this user (e.g. from map staff pin popup) */
  initialUserId?: string | null;
}

export function DirectMessages({ companyId, initialUserId }: DirectMessagesProps) {
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId ?? null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [members, setMembers] = useState<any[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const convs = await getDMConversations(companyId);
    setConversations(convs);
    setLoading(false);
  }, [companyId]);

  const loadMessages = useCallback(async (otherUserId: string) => {
    const msgs = await getDMMessages(companyId, otherUserId);
    setMessages(msgs);
    await markDMsAsRead(companyId, otherUserId);
    loadConversations(); // Refresh unread counts
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [companyId, loadConversations]);

  // Load conversations on mount
  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Subscribe to new DMs
  useEffect(() => {
    if (!user?.id) return;
    const unsub = subscribeDMs(companyId, user.id, () => {
      loadConversations();
      if (selectedUserId) loadMessages(selectedUserId);
    });
    return unsub;
  }, [companyId, user?.id, loadConversations, selectedUserId, loadMessages]);

  async function handleSend() {
    if (!msgText.trim() || !selectedUserId) return;
    setSending(true);
    await sendDM(companyId, selectedUserId, msgText.trim());
    setMsgText("");
    await loadMessages(selectedUserId);
    setSending(false);
  }

  async function handleSendLocation() {
    if (!selectedUserId) return;
    if (!navigator.geolocation) return;
    setSending(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
      );
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      await sendDM(companyId, selectedUserId, `📍 My location: ${lat}, ${lng}\nhttps://www.google.com/maps?q=${lat},${lng}`);
      await loadMessages(selectedUserId);
    } catch (e) { logger.swallow("direct-messages:share-location", e, "warn"); }
    finally { setSending(false); }
  }

  async function handleSelectConversation(userId: string) {
    setSelectedUserId(userId);
    setShowNewDM(false);
    await loadMessages(userId);
  }

  async function handleNewDM() {
    setShowNewDM(true);
    setSelectedUserId(null);
    setMessages([]);
    // Load company members for the picker
    try {
      const rawMembers = await getCompanyMembers(companyId);
      // Flatten nested users object for rendering
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMembers((rawMembers ?? []).map((member: any) => ({
        user_id: member.users?.id ?? "",
        first_name: member.users?.first_name ?? "",
        last_name: member.users?.last_name ?? "",
        avatar_url: member.users?.avatar_url ?? null,
        role: member.role,
      })).filter((m: { user_id: string }) => m.user_id && m.user_id !== user?.id));
    } catch (e) { logger.swallow("direct-messages:load-members", e, "warn"); }
  }

  async function handleSelectNewRecipient(userId: string) {
    setShowNewDM(false);
    setSelectedUserId(userId);
    await loadMessages(userId);
  }

  const selectedConv = conversations.find(c => c.userId === selectedUserId);
  const selectedName = selectedConv ? `${selectedConv.firstName} ${selectedConv.lastName}`.trim() : "";

  const filteredMembers = members.filter((m: { first_name?: string; last_name?: string; avatar_url?: string | null }) => {
    if (!searchQ) return true;
    const name = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
    return name.includes(searchQ.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[400px] border border-border/30 rounded-xl overflow-hidden">
      {/* Conversation list */}
      <div className="w-72 border-r border-border/30 flex flex-col">
        <div className="p-3 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Messages</h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleNewDM}>+ New</Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No conversations yet<br />
              <button onClick={handleNewDM} className="mt-1 text-primary hover:underline">Start one</button>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.userId}
                onClick={() => handleSelectConversation(conv.userId)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                  selectedUserId === conv.userId ? "bg-muted" : ""
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={conv.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {conv.firstName[0]}{conv.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium truncate">{conv.firstName} {conv.lastName}</span>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{conv.lastMessage}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col">
        {showNewDM ? (
          /* New DM picker */
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-border/30">
              <h3 className="text-sm font-medium mb-2">New Message</h3>
              <Input
                placeholder="Search staff..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredMembers.map((m: { user_id: string; first_name?: string; last_name?: string; role?: string }) => (
                <button
                  key={m.user_id}
                  onClick={() => handleSelectNewRecipient(m.user_id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={(m as { avatar_url?: string | null }).avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px]">
                      {(m.first_name ?? "?")[0]}{(m.last_name ?? "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-xs font-medium">{m.first_name} {m.last_name}</span>
                    {m.role && <span className="text-[10px] text-muted-foreground ml-1.5">{m.role}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : selectedUserId ? (
          /* Conversation view */
          <>
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-border/30 flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={selectedConv?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[9px]">
                  {selectedConv?.firstName[0]}{selectedConv?.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{selectedName}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.map(msg => {
                const isMe = msg.fromUserId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}>
                      <p className="break-words">{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                        <span className="text-[9px] opacity-50">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isMe && (
                          msg.readAt
                            ? <CheckCheck className="h-3 w-3 opacity-50" />
                            : <Check className="h-3 w-3 opacity-30" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/30">
              <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <Input
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Type a message..."
                  className="h-9 text-sm"
                  disabled={sending}
                />
                <Button type="button" size="sm" variant="ghost" className="h-9 px-2" disabled={sending} onClick={handleSendLocation} title="Send my location">
                  <MapPin className="h-3.5 w-3.5" />
                </Button>
                <Button type="submit" size="sm" className="h-9 px-3" disabled={sending || !msgText.trim()}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a conversation or start a new one
          </div>
        )}
      </div>
    </div>
  );
}
