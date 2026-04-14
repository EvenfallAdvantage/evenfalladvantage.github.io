"use client";

import { useState } from "react";
import {
  Plus, Loader2, Trash2, ExternalLink, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateChatChannel } from "@/lib/supabase/db";
import {
  type Channel, type ExtMeta,
  PLAT, EXT_PLATFORM_OPTIONS,
} from "./chat-helpers";

interface ExternalTabProps {
  isAdmin: boolean;
  external: (Channel & { meta: ExtMeta })[];
  showAddExt: boolean;
  setShowAddExt: (v: boolean) => void;
  extName: string;
  setExtName: (v: string) => void;
  extPlat: "whatsapp" | "signal";
  setExtPlat: (v: "whatsapp" | "signal") => void;
  extUrl: string;
  setExtUrl: (v: string) => void;
  creatingExt: boolean;
  handleAddExternal: () => void;
  handleDeleteCh: (id: string) => void;
  loadChannels: () => void;
}

export function ExternalTab({
  isAdmin, external,
  showAddExt, setShowAddExt,
  extName, setExtName, extPlat, setExtPlat, extUrl, setExtUrl,
  creatingExt, handleAddExternal,
  handleDeleteCh, loadChannels,
}: ExternalTabProps) {
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
