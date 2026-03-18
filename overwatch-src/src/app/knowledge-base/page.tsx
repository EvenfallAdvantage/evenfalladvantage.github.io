"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  BookOpen, FolderOpen, FileText, Plus, Loader2, Trash2,
  Upload, X, Download, CheckCircle2, Circle, Image as ImageIcon,
  File, Users, ChevronUp, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";
import {
  getKBFolders, getKBDocuments, createKBFolder, createKBDocument,
  deleteKBFolder, deleteKBDocument, uploadKBFile, updateKBDocumentRequired,
  markDocumentRead, unmarkDocumentRead, getUserDocumentReads,
  getDocumentReadStatus, getCompanyMembers, updateKBFolderOrder,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Folder = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReadEntry = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

function isViewableType(mime: string | null | undefined): "pdf" | "image" | "text" | null {
  if (!mime) return null;
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml") return "text";
  return null;
}

function fileIcon(mime: string | null | undefined) {
  if (!mime) return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 shrink-0 text-red-500" />;
  if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 shrink-0 text-emerald-500" />;
  return <File className="h-4 w-4 shrink-0 text-blue-500" />;
}

function formatSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

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
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [newDocRequired, setNewDocRequired] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Viewer modal
  const [viewDoc, setViewDoc] = useState<Doc | null>(null);

  // Read tracking
  const [readDocIds, setReadDocIds] = useState<Set<string>>(new Set());
  const [markingRead, setMarkingRead] = useState<string | null>(null);

  // Admin read status
  const [readStatusDoc, setReadStatusDoc] = useState<Doc | null>(null);
  const [readEntries, setReadEntries] = useState<ReadEntry[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loadingReadStatus, setLoadingReadStatus] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setFolders(await getKBFolders(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  async function selectFolder(f: Folder) {
    setSelectedFolder(f);
    setShowCreateDoc(false);
    try {
      const [d, reads] = await Promise.all([
        getKBDocuments(f.id),
        getUserDocumentReads(f.id),
      ]);
      setDocs(d);
      setReadDocIds(new Set(reads));
    } catch { setDocs([]); setReadDocIds(new Set()); }
  }

  async function handleCreateFolder() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createKBFolder({ companyId: activeCompanyId, name: newName.trim() });
      setNewName(""); setShowCreateFolder(false); await loadFolders();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function handleDeleteFolder(folderId: string) {
    if (!confirm("Delete this folder and all its documents?")) return;
    setDeletingFolder(folderId);
    try {
      await deleteKBFolder(folderId);
      if (selectedFolder?.id === folderId) { setSelectedFolder(null); setDocs([]); }
      await loadFolders();
    } catch (err) { console.error(err); }
    finally { setDeletingFolder(null); }
  }

  async function moveFolder(idx: number, direction: -1 | 1) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= folders.length) return;
    const updated = [...folders];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setFolders(updated);
    try {
      await updateKBFolderOrder(updated.map((f: Folder, i: number) => ({ id: f.id, sort_order: i })));
    } catch (err) { console.error("Reorder failed:", err); await loadFolders(); }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("Delete this document?")) return;
    setDeletingDoc(docId);
    try {
      await deleteKBDocument(docId);
      if (selectedFolder) {
        setDocs(await getKBDocuments(selectedFolder.id));
      }
    } catch (err) { console.error(err); }
    finally { setDeletingDoc(null); }
  }

  async function handleCreateDoc() {
    if (!newDocTitle.trim() || !selectedFolder || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;
      let mimeType: string | undefined;
      let docType = "page";

      if (newDocFile) {
        fileUrl = await uploadKBFile(newDocFile, activeCompanyId);
        fileName = newDocFile.name;
        fileSize = newDocFile.size;
        mimeType = newDocFile.type || "application/octet-stream";
        docType = "file";
      }

      await createKBDocument({
        folderId: selectedFolder.id,
        title: newDocTitle.trim(),
        content: newDocContent || undefined,
        fileUrl,
        type: docType,
        fileName,
        fileSize,
        mimeType,
        required: newDocRequired,
      });
      setNewDocTitle(""); setNewDocContent(""); setNewDocFile(null); setNewDocRequired(false);
      setShowCreateDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDocs(await getKBDocuments(selectedFolder.id));
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function handleToggleRead(docId: string) {
    setMarkingRead(docId);
    try {
      if (readDocIds.has(docId)) {
        await unmarkDocumentRead(docId);
        setReadDocIds((prev) => { const n = new Set(prev); n.delete(docId); return n; });
      } else {
        await markDocumentRead(docId);
        setReadDocIds((prev) => new Set(prev).add(docId));
      }
    } catch (err) { console.error(err); }
    finally { setMarkingRead(null); }
  }

  async function handleToggleRequired(d: Doc) {
    try {
      await updateKBDocumentRequired(d.id, !d.required);
      setDocs((prev: Doc[]) => prev.map((doc: Doc) => doc.id === d.id ? { ...doc, required: !d.required } : doc));
      if (viewDoc?.id === d.id) setViewDoc({ ...viewDoc, required: !d.required });
    } catch (err) { console.error(err); }
  }

  async function openReadStatus(d: Doc) {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    setReadStatusDoc(d);
    setLoadingReadStatus(true);
    try {
      const [reads, members] = await Promise.all([
        getDocumentReadStatus(d.id),
        getCompanyMembers(activeCompanyId),
      ]);
      setReadEntries(reads);
      setAllMembers(members);
    } catch (err) { console.error(err); }
    finally { setLoadingReadStatus(false); }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono uppercase flex items-center gap-2"><BookOpen className="h-5 w-5 sm:h-6 sm:w-6" /> Field Manual</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">SOPs, protocols, and training materials</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreateFolder(true)}>
              <Plus className="h-4 w-4" /> New Folder
            </Button>
          )}
        </div>

        {showCreateFolder && (
          <div className="flex gap-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Folder name..." value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()} className="flex-1" />
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
            {/* Folder sidebar */}
            <div className="space-y-1 rounded-xl border border-border/50 bg-card p-3">
              {folders.map((f: Folder, idx: number) => (
                <div key={f.id} onClick={() => selectFolder(f)}
                  className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${selectedFolder?.id === f.id ? "bg-primary/10 text-primary" : "hover:bg-accent"}`}>
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {isAdmin && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); moveFolder(idx, -1); }} disabled={idx === 0}
                        className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed" title="Move up">
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveFolder(idx, 1); }} disabled={idx === folders.length - 1}
                        className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground hover:bg-accent disabled:opacity-20 disabled:cursor-not-allowed" title="Move down">
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }} disabled={deletingFolder === f.id}
                        className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10" title="Delete folder">
                        {deletingFolder === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Document list */}
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

                  {/* Create document form */}
                  {showCreateDoc && (
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
                      <Input placeholder="Document title..." value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} />
                      <textarea placeholder="Content (optional — or attach a file below)..." value={newDocContent} onChange={(e) => setNewDocContent(e.target.value)}
                        className="w-full resize-none rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm outline-none min-h-[80px]" />

                      {/* File upload */}
                      <div className="space-y-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setNewDocFile(f);
                              if (!newDocTitle.trim()) setNewDocTitle(f.name.replace(/\.[^.]+$/, ""));
                            }
                          }}
                        />
                        {newDocFile ? (
                          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                            {fileIcon(newDocFile.type)}
                            <span className="text-xs font-medium truncate flex-1">{newDocFile.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatSize(newDocFile.size)}</span>
                            <button onClick={() => { setNewDocFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                              className="text-muted-foreground/50 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-3.5 w-3.5" /> Attach File
                          </Button>
                        )}
                      </div>

                      {isAdmin && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={newDocRequired} onChange={(e) => setNewDocRequired(e.target.checked)}
                            className="rounded border-border/50" />
                          <span className="text-xs text-muted-foreground">Required reading</span>
                        </label>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateDoc} disabled={!newDocTitle.trim() || creating}>
                          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setShowCreateDoc(false); setNewDocFile(null); setNewDocTitle(""); setNewDocContent(""); setNewDocRequired(false); }}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {/* Document list */}
                  {docs.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No documents in this folder yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map((d: Doc) => {
                        const isRead = readDocIds.has(d.id);
                        return (
                          <div key={d.id} className={`rounded-lg border bg-card p-3 cursor-pointer transition-colors hover:border-primary/30 ${isRead ? "border-green-500/20" : "border-border/50"}`}
                            onClick={() => setViewDoc(d)}>
                            <div className="flex items-center gap-3">
                              {fileIcon(d.mime_type)}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{d.title}</p>
                                  {d.required && <Badge className="text-[9px] shrink-0 bg-amber-500/15 text-amber-600 border-0">Required</Badge>}
                                  {d.file_name && <Badge variant="outline" className="text-[9px] shrink-0">{d.file_name.split(".").pop()?.toUpperCase()}</Badge>}
                                  {d.file_size && <span className="text-[10px] text-muted-foreground shrink-0">{formatSize(d.file_size)}</span>}
                                </div>
                                {d.content && !d.file_url && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{d.content}</p>}
                              </div>

                              {/* Read status indicator */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleToggleRead(d.id); }}
                                disabled={markingRead === d.id}
                                className={`shrink-0 rounded-full p-1 transition-colors ${isRead ? "text-green-500 hover:text-green-600" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
                                title={isRead ? "Mark as unread" : "Mark as read"}
                              >
                                {markingRead === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isRead ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                              </button>

                              {/* Admin actions */}
                              {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); handleToggleRequired(d); }}
                                  className={`shrink-0 rounded p-1 transition-colors ${d.required ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10"}`}
                                  title={d.required ? "Remove required" : "Mark as required"}>
                                  <BookOpen className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); openReadStatus(d); }}
                                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-primary hover:bg-primary/10" title="View read status">
                                  <Users className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteDoc(d.id); }} disabled={deletingDoc === d.id}
                                  className="shrink-0 rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete document">
                                  {deletingDoc === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
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

      {/* ── Document Viewer Modal ── */}
      {viewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setViewDoc(null)}>
          <div className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center gap-3 border-b border-border/40 px-6 py-4 shrink-0">
              {fileIcon(viewDoc.mime_type)}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold truncate">{viewDoc.title}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {viewDoc.file_name && <span className="text-[10px] text-muted-foreground">{viewDoc.file_name}</span>}
                  {viewDoc.file_size && <span className="text-[10px] text-muted-foreground">· {formatSize(viewDoc.file_size)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {viewDoc.file_url && (
                  <a href={viewDoc.file_url} download={viewDoc.file_name || viewDoc.title} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </a>
                )}
                <Button size="sm" variant={readDocIds.has(viewDoc.id) ? "default" : "outline"}
                  className={`gap-1.5 text-xs h-8 ${readDocIds.has(viewDoc.id) ? "bg-green-600 hover:bg-green-700" : ""}`}
                  disabled={markingRead === viewDoc.id}
                  onClick={() => handleToggleRead(viewDoc.id)}>
                  {markingRead === viewDoc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : readDocIds.has(viewDoc.id) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                  {readDocIds.has(viewDoc.id) ? "Read" : "Mark as Read"}
                </Button>
                <button onClick={() => setViewDoc(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-auto">
              {(() => {
                const viewable = isViewableType(viewDoc.mime_type);
                if (viewDoc.file_url && viewable === "pdf") {
                  return <iframe src={viewDoc.file_url} className="w-full h-full min-h-[70vh]" title={viewDoc.title} />;
                }
                if (viewDoc.file_url && viewable === "image") {
                  return (
                    <div className="flex items-center justify-center p-8 bg-muted/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={viewDoc.file_url} alt={viewDoc.title} className="max-w-full max-h-[70vh] rounded-lg object-contain" />
                    </div>
                  );
                }
                if (viewDoc.content) {
                  return (
                    <div className="p-6">
                      <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                        {viewDoc.content}
                      </div>
                    </div>
                  );
                }
                if (viewDoc.file_url) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <File className="h-16 w-16 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">This file type cannot be previewed in the browser.</p>
                      <a href={viewDoc.file_url} download={viewDoc.file_name || viewDoc.title} target="_blank" rel="noopener noreferrer">
                        <Button className="gap-2"><Download className="h-4 w-4" /> Download File</Button>
                      </a>
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col items-center justify-center py-16">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No content available.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Read Status Modal (Admin) ── */}
      {readStatusDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setReadStatusDoc(null)}>
          <div className="relative w-full max-w-md max-h-[80vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-sm font-bold">Read Status</h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{readStatusDoc.title}</p>
              </div>
              <button onClick={() => setReadStatusDoc(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-1">
              {loadingReadStatus ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (() => {
                const readUserIds = new Set(readEntries.map((r: ReadEntry) => r.user_id));
                const readMap = new Map(readEntries.map((r: ReadEntry) => [r.user_id, r]));
                // Build full list: read users at top, then unread
                const allUsers = allMembers.map((m: Member) => {
                  const u = Array.isArray(m.users) ? m.users[0] : m.users;
                  if (!u) return null;
                  return { ...u, memberRole: m.role, hasRead: readUserIds.has(u.id), readAt: readMap.get(u.id)?.read_at };
                }).filter(Boolean);
                const sorted = allUsers.sort((a: { hasRead: boolean }, b: { hasRead: boolean }) => (a.hasRead === b.hasRead ? 0 : a.hasRead ? -1 : 1));
                const readCount = sorted.filter((u: { hasRead: boolean }) => u.hasRead).length;

                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs">
                        {readCount} / {sorted.length} read
                      </Badge>
                      <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${sorted.length > 0 ? (readCount / sorted.length) * 100 : 0}%` }} />
                      </div>
                    </div>
                    {sorted.map((u: { id: string; first_name?: string; last_name?: string; avatar_url?: string; hasRead: boolean; readAt?: string }) => (
                      <div key={u.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/30">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={u.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                            {(u.first_name?.[0] ?? "")}{(u.last_name?.[0] ?? "")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
                          {u.hasRead && u.readAt && (
                            <p className="text-[10px] text-muted-foreground">
                              Read {new Date(u.readAt).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(u.readAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                        {u.hasRead ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                        )}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
