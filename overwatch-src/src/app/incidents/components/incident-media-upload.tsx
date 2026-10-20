"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, Video, Mic, FileText, Trash2, Loader2, Paperclip, ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, MapPin, Clock, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  uploadIncidentMedia, getIncidentMedia, deleteIncidentMedia, getCustodyLog, logEvidenceEvent, verifyIncidentMedia,
  type IncidentMedia, type CustodyEvent,
} from "@/lib/supabase/db";
import { getSignedFileUrl } from "@/lib/supabase/db-helpers";
import { captureMetaFor, quickFix, shortHash, CUSTODY_LABEL, type CaptureSource } from "@/lib/evidence/integrity";

interface IncidentMediaUploadProps {
  incidentId: string;
  companyId: string;
  readOnly?: boolean;
}

const TYPE_MAP: Record<string, "photo" | "video" | "audio" | "document"> = {
  "image/": "photo",
  "video/": "video",
  "audio/": "audio",
};

function detectFileType(mimeType: string): "photo" | "video" | "audio" | "document" {
  for (const [prefix, type] of Object.entries(TYPE_MAP)) {
    if (mimeType.startsWith(prefix)) return type;
  }
  return "document";
}

const TYPE_ICONS = { photo: Camera, video: Video, audio: Mic, document: FileText };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

type Verify = { state: "checking" } | { state: "ok"; at: string } | { state: "fail"; computed: string | null };

export function IncidentMediaUpload({ incidentId, companyId, readOnly }: IncidentMediaUploadProps) {
  const [media, setMedia] = useState<IncidentMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [custody, setCustody] = useState<Record<string, CustodyEvent[] | null>>({});
  const [verify, setVerify] = useState<Record<string, Verify>>({});
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    getIncidentMedia(incidentId).then((m) => { if (live) { setMedia(m); setLoading(false); } });
    return () => { live = false; };
  }, [incidentId]);

  async function handleUpload(files: FileList, source: CaptureSource) {
    setUploading(true);
    // One GPS fix per batch, taken at capture time (camera only).
    const fix = source === "camera" ? await quickFix() : null;
    let count = 0;
    for (const file of Array.from(files)) {
      const result = await uploadIncidentMedia(incidentId, companyId, file, detectFileType(file.type), captureMetaFor(file, source, fix));
      if (result) { setMedia((prev) => [...prev, result]); count++; }
      else toast.error(`Failed to upload ${file.name}`);
    }
    if (count > 0) toast.success(`${count} file${count > 1 ? "s" : ""} uploaded and fingerprinted`);
    setUploading(false);
    if (camRef.current) camRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(mediaId: string) {
    if (!window.confirm("Delete this evidence file? The custody log keeps a permanent record of the deletion.")) return;
    setDeleting(mediaId);
    const ok = await deleteIncidentMedia(mediaId);
    if (ok) { setMedia((prev) => prev.filter((m) => m.id !== mediaId)); toast.success("File removed"); }
    else toast.error("Failed to remove file");
    setDeleting(null);
  }

  async function handleView(m: IncidentMedia) {
    try {
      const url = await getSignedFileUrl(m.fileUrl);
      void logEvidenceEvent(m.id, "viewed");
      window.open(url, "_blank");
    } catch { toast.error("Failed to open file"); }
  }

  async function toggle(m: IncidentMedia) {
    if (open === m.id) { setOpen(null); return; }
    setOpen(m.id);
    const log = await getCustodyLog(m.id);
    setCustody((c) => ({ ...c, [m.id]: log }));
  }

  async function handleVerify(m: IncidentMedia) {
    setVerify((v) => ({ ...v, [m.id]: { state: "checking" } }));
    const r = await verifyIncidentMedia(m);
    setVerify((v) => ({ ...v, [m.id]: r.ok ? { state: "ok", at: new Date().toISOString() } : { state: "fail", computed: r.computed } }));
    if (r.ok) toast.success("Integrity verified: file is unchanged since upload");
    else toast.error(r.computed ? "File does NOT match its upload fingerprint" : "Couldn't download the file to verify");
    const log = await getCustodyLog(m.id);
    setCustody((c) => ({ ...c, [m.id]: log }));
  }

  return (
    <div className="space-y-2" data-testid="evidence">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" /> Evidence ({media.length})
        </p>
        {!readOnly && (
          <div className="flex gap-1.5">
            <input ref={camRef} type="file" accept="image/*,video/*" capture="environment" className="sr-only" aria-label="Take photo or video"
              onChange={(e) => e.target.files?.length && handleUpload(e.target.files, "camera")} disabled={uploading} />
            <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" className="sr-only" aria-label="Attach file"
              onChange={(e) => e.target.files?.length && handleUpload(e.target.files, "library")} disabled={uploading} />
            <button type="button" onClick={() => camRef.current?.click()} disabled={uploading} style={{ minHeight: 44 }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{uploading ? "Uploading…" : "Camera"}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ minHeight: 44 }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium">
              <ImagePlus className="h-4 w-4" />Attach
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : media.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/60 py-2">No evidence files attached.</p>
      ) : (
        <div className="space-y-1.5">
          {media.map((m) => {
            const Icon = TYPE_ICONS[m.fileType as keyof typeof TYPE_ICONS] ?? FileText;
            const v = verify[m.id];
            const log = custody[m.id];
            return (
              <div key={m.id} className="rounded-lg border border-border/30 bg-background/50" data-testid="evidence-item">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <button type="button" onClick={() => handleView(m)} className="flex-1 min-w-0 text-left hover:underline">
                    <p className="text-xs font-medium truncate">{m.fileName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatSize(m.fileSize)} &middot; {m.uploaderName || "You"} &middot; {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </button>
                  {v?.state === "ok" && <ShieldCheck className="h-4 w-4 text-green-500" aria-label="Verified" />}
                  {v?.state === "fail" && <ShieldAlert className="h-4 w-4 text-red-500" aria-label="Verification failed" />}
                  <button type="button" onClick={() => toggle(m)} aria-expanded={open === m.id} aria-label="Integrity and custody details"
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                    {open === m.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {!readOnly && (
                    <button type="button" onClick={() => handleDelete(m.id)} disabled={deleting === m.id} aria-label="Delete file"
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground/50 hover:text-red-500">
                      {deleting === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
                {open === m.id && (
                  <div className="space-y-2 border-t border-border/30 px-3 py-2 text-[11px]" data-testid="evidence-details">
                    <div className="grid gap-1 text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />
                        {m.capturedAt ? `Captured ${new Date(m.capturedAt).toLocaleString()}${m.captureSource ? ` (${m.captureSource})` : ""}` : "Capture time not recorded"}
                      </span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />
                        {m.captureLat != null && m.captureLng != null ? `${m.captureLat.toFixed(5)}, ${m.captureLng.toFixed(5)}${m.captureAccuracy != null ? ` ±${Math.round(m.captureAccuracy)} m` : ""}` : "No capture GPS"}
                      </span>
                      <span className="break-all font-mono text-[10px]" title={m.hash ?? ""}>SHA-256 {m.hash ?? "not recorded"}</span>
                    </div>
                    <button type="button" onClick={() => handleVerify(m)} disabled={!m.hash || v?.state === "checking"} style={{ minHeight: 44 }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-xs font-semibold disabled:opacity-50">
                      {v?.state === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Verify integrity
                    </button>
                    {v?.state === "ok" && <p className="text-green-500">Matches the fingerprint taken at upload. Logged.</p>}
                    {v?.state === "fail" && <p className="text-red-400">{v.computed ? `Mismatch: now ${shortHash(v.computed)}. Logged as a failed check.` : "Couldn't download the file to check."}</p>}
                    <div>
                      <p className="mb-1 font-semibold text-muted-foreground">Chain of custody</p>
                      {log === undefined ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : log === null ? (
                        <p className="text-muted-foreground/70">Custody log not available yet.</p>
                      ) : log.length === 0 ? (
                        <p className="text-muted-foreground/70">No events yet.</p>
                      ) : (
                        <ol className="space-y-1" data-testid="custody-log">
                          {log.map((e) => (
                            <li key={e.id} className="flex justify-between gap-2">
                              <span className={e.action === "verify_failed" || e.action === "deleted" ? "text-red-400" : ""}>{CUSTODY_LABEL[e.action] ?? e.action} · {e.actorName}</span>
                              <span className="shrink-0 text-muted-foreground">{new Date(e.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
