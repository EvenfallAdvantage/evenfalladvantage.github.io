"use client";

import { type RefObject } from "react";
import {
  Radio, Plus, Send, Loader2, Trash2, Search, ExternalLink,
  Reply, X, Hash, MessageSquare, MapPin,
  Smile, Paperclip, Upload, Pencil, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChatSkeleton } from "@/components/loading-skeleton";
import {
  type Channel, type Message, type ExtMeta, type ChannelPermissions,
  QUICK_EMOJIS, ALL_ROLES, PLAT, getChannelPerms, timeAgo,
} from "./chat-helpers";

interface ChannelsTabProps {
  loading: boolean;
  internal: Channel[];
  external: (Channel & { meta: ExtMeta })[];
  selected: Channel | null;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newAvatarUrl: string;
  setNewAvatarUrl: (v: string) => void;
  newAvatarFile: File | null;
  setNewAvatarFile: (v: File | null) => void;
  creating: boolean;
  handleCreate: () => void;
  selectCh: (ch: Channel) => void;
  deletingCh: string | null;
  handleDeleteCh: (id: string) => void;
  isAdmin: boolean;
  showSearch: boolean;
  setShowSearch: (v: boolean) => void;
  searchQ: string;
  setSearchQ: (v: string) => void;
  filteredMsgs: Message[];
  user: { id?: string; firstName?: string; lastName?: string } | null;
  replyTo: Message | null;
  setReplyTo: (v: Message | null) => void;
  msgText: string;
  setMsgText: (v: string) => void;
  sending: boolean;
  handleSend: () => void;
  handleSendLocation: () => void;
  bottomRef: RefObject<HTMLDivElement | null>;
  unread: Record<string, number>;
  emojiPicker: string | null;
  setEmojiPicker: (v: string | null) => void;
  handleReaction: (messageId: string, emoji: string) => void;
  typingUsers: string[];
  broadcastTyping: () => void;
  editingAvatar: string | null;
  setEditingAvatar: (v: string | null) => void;
  editAvatarUrl: string;
  setEditAvatarUrl: (v: string) => void;
  editAvatarFile: File | null;
  setEditAvatarFile: (v: File | null) => void;
  savingAvatar: boolean;
  handleSaveAvatar: (channelId: string) => void;
  userRole: string;
  showPermEditor: boolean;
  setShowPermEditor: (v: boolean) => void;
  permForm: ChannelPermissions;
  togglePermRole: (action: keyof ChannelPermissions, role: string) => void;
  savingPerms: boolean;
  handleSavePerms: () => void;
  openPermEditor: () => void;
}

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

export function ChannelsTab({
  loading, internal, external, selected,
  showCreate, setShowCreate, newName, setNewName,
  newAvatarUrl, setNewAvatarUrl, newAvatarFile, setNewAvatarFile,
  creating, handleCreate, selectCh, deletingCh, handleDeleteCh,
  isAdmin, showSearch, setShowSearch,
  searchQ, setSearchQ, filteredMsgs, user,
  replyTo, setReplyTo, msgText, setMsgText,
  sending, handleSend, handleSendLocation, bottomRef,
  unread, emojiPicker, setEmojiPicker, handleReaction,
  typingUsers, broadcastTyping,
  editingAvatar, setEditingAvatar, editAvatarUrl, setEditAvatarUrl,
  editAvatarFile, setEditAvatarFile, savingAvatar, handleSaveAvatar,
  userRole, showPermEditor, setShowPermEditor,
  permForm, togglePermRole, savingPerms, handleSavePerms, openPermEditor,
}: ChannelsTabProps) {
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
                                className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] border transition-colors ${user?.id && r.userIds.includes(user.id) ? "border-primary/40 bg-primary/10" : "border-border/40 bg-muted/30 hover:bg-muted/50"}`}>
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
