"use client";

import { useEffect, useState } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Hash, ExternalLink, Mail } from "lucide-react";
import { DirectMessages } from "@/components/direct-messages";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { useChatChannels } from "./components/use-chat-channels";
import { ChannelsTab } from "./components/channels-tab";
import { ExternalTab } from "./components/external-tab";
import { BroadcastPanel } from "./components/broadcast-panel";

type Tab = "channels" | "external" | "messages";

export default function ChatPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const searchParams = useSearchParams();

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

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

  const ch = useChatChannels();

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
          {ch.internal.length > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{ch.internal.length}</Badge>}
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
          {ch.external.length > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-primary/20 text-primary">{ch.external.length}</Badge>}
        </button>
      </div>

      {/* ────────── CHANNELS TAB ────────── */}
      {tab === "channels" && (
        <ChannelsTab
          loading={ch.loading} internal={ch.internal} external={ch.external} selected={ch.selected}
          showCreate={ch.showCreate} setShowCreate={ch.setShowCreate} newName={ch.newName} setNewName={ch.setNewName}
          newAvatarUrl={ch.newAvatarUrl} setNewAvatarUrl={ch.setNewAvatarUrl}
          newAvatarFile={ch.newAvatarFile} setNewAvatarFile={ch.setNewAvatarFile}
          creating={ch.creating} handleCreate={ch.handleCreate} selectCh={ch.selectCh} deletingCh={ch.deletingCh}
          handleDeleteCh={ch.handleDeleteCh} isAdmin={isAdmin} showSearch={ch.showSearch} setShowSearch={ch.setShowSearch}
          searchQ={ch.searchQ} setSearchQ={ch.setSearchQ} filteredMsgs={ch.filteredMsgs} user={ch.user}
          replyTo={ch.replyTo} setReplyTo={ch.setReplyTo} msgText={ch.msgText} setMsgText={ch.setMsgText}
          sending={ch.sending} handleSend={ch.handleSend} handleSendLocation={ch.handleSendLocation} bottomRef={ch.bottomRef}
          unread={ch.unread} emojiPicker={ch.emojiPicker} setEmojiPicker={ch.setEmojiPicker}
          handleReaction={ch.handleReaction} typingUsers={ch.typingUsers} broadcastTyping={ch.broadcastTyping}
          editingAvatar={ch.editingAvatar} setEditingAvatar={ch.setEditingAvatar}
          editAvatarUrl={ch.editAvatarUrl} setEditAvatarUrl={ch.setEditAvatarUrl}
          editAvatarFile={ch.editAvatarFile} setEditAvatarFile={ch.setEditAvatarFile}
          savingAvatar={ch.savingAvatar} handleSaveAvatar={ch.handleSaveAvatar}
          userRole={(activeCompany?.role ?? "staff")}
          showPermEditor={ch.showPermEditor} setShowPermEditor={ch.setShowPermEditor}
          permForm={ch.permForm} togglePermRole={ch.togglePermRole}
          savingPerms={ch.savingPerms} handleSavePerms={ch.handleSavePerms}
          openPermEditor={ch.openPermEditor}
        />
      )}

      {/* ────────── MESSAGES (DM) TAB ────────── */}
      {tab === "messages" && activeCompanyId && (
        <DirectMessages companyId={activeCompanyId} initialUserId={dmUserId} />
      )}

      {/* ────────── BROADCAST PANEL (managers only, all tabs) ────────── */}
      {isAdmin && activeCompanyId && (
        <BroadcastPanel activeCompanyId={activeCompanyId} />
      )}

      {/* ────────── EXTERNAL GROUPS TAB ────────── */}
      {tab === "external" && (
        <ExternalTab
          isAdmin={isAdmin} external={ch.external} showAddExt={ch.showAddExt} setShowAddExt={ch.setShowAddExt}
          extName={ch.extName} setExtName={ch.setExtName} extPlat={ch.extPlat} setExtPlat={ch.setExtPlat}
          extUrl={ch.extUrl} setExtUrl={ch.setExtUrl} creatingExt={ch.creatingExt} handleAddExternal={ch.handleAddExternal}
          handleDeleteCh={ch.handleDeleteCh} loadChannels={ch.loadChannels}
        />
      )}
    </div>
  );
}
