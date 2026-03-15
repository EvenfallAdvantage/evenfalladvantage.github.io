"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, FolderOpen, FileText, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getKBFolders, getKBDocuments, createKBFolder, createKBDocument } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Folder = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

export default function KnowledgeBasePage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocContent, setNewDocContent] = useState("");
  const [creating, setCreating] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setFolders(await getKBFolders(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  async function selectFolder(f: Folder) {
    setSelectedFolder(f);
    try { setDocs(await getKBDocuments(f.id)); } catch { setDocs([]); }
  }

  async function handleCreateFolder() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createKBFolder({ companyId: activeCompanyId, name: newName.trim() });
      setNewName(""); setShowCreateFolder(false); await loadFolders();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function handleCreateDoc() {
    if (!newDocTitle.trim() || !selectedFolder) return;
    setCreating(true);
    try {
      await createKBDocument({ folderId: selectedFolder.id, title: newDocTitle.trim(), content: newDocContent || undefined });
      setNewDocTitle(""); setNewDocContent(""); setShowCreateDoc(false);
      setDocs(await getKBDocuments(selectedFolder.id));
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">Field Manual</h1>
            <p className="text-sm text-muted-foreground">SOPs, protocols, and training materials</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreateFolder(true)}>
              <Plus className="h-4 w-4" /> New Folder
            </Button>
          )}
        </div>

        {showCreateFolder && (
          <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Folder name..." value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={handleCreateFolder} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreateFolder(false)}>Cancel</Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No documents yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Create a folder to start organizing SOPs and training materials." : "Your organization hasn't uploaded any documents yet."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
              {folders.map((f: Folder) => (
                <div key={f.id} onClick={() => selectFolder(f)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${selectedFolder?.id === f.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </div>
              ))}
            </div>

            <div>
              {selectedFolder ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{selectedFolder.name}</h2>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCreateDoc(true)}>
                        <Plus className="h-3.5 w-3.5" /> Add Document
                      </Button>
                    )}
                  </div>
                  {showCreateDoc && (
                    <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
                      <Input placeholder="Document title..." value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} />
                      <textarea placeholder="Content (optional)..." value={newDocContent} onChange={(e) => setNewDocContent(e.target.value)}
                        className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none min-h-[80px]" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateDoc} disabled={!newDocTitle.trim() || creating}>
                          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowCreateDoc(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                  {docs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No documents in this folder yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((d: Doc) => (
                        <div key={d.id} className="rounded-lg border border-border/50 bg-card p-3 cursor-pointer hover:border-primary/30">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{d.title}</p>
                              {d.content && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{d.content}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                  <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium">Select a folder</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose a folder from the sidebar to view documents</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
