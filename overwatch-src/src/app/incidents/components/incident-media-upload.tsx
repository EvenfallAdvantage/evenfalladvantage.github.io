"use client";

import { useState, useRef } from "react";
import { Camera, Video, Mic, FileText, Trash2, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadIncidentMedia, getIncidentMedia, deleteIncidentMedia, type IncidentMedia } from "@/lib/supabase/db";
import { getSignedFileUrl } from "@/lib/supabase/db-helpers";

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

const TYPE_ICONS = {
  photo: Camera,
  video: Video,
  audio: Mic,
  document: FileText,
};

export function IncidentMediaUpload({ incidentId, companyId, readOnly }: IncidentMediaUploadProps) {
  const [media, setMedia] = useState<IncidentMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load media on first render
  useState(() => {
    getIncidentMedia(incidentId).then((m) => { setMedia(m); setLoading(false); });
  });

  async function handleUpload(files: FileList) {
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const fileType = detectFileType(file.type);
      const result = await uploadIncidentMedia(incidentId, companyId, file, fileType);
      if (result) {
        setMedia((prev) => [...prev, result]);
        count++;
      } else {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (count > 0) toast.success(`${count} file${count > 1 ? "s" : ""} uploaded`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(mediaId: string) {
    setDeleting(mediaId);
    const ok = await deleteIncidentMedia(mediaId);
    if (ok) {
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      toast.success("File removed");
    } else {
      toast.error("Failed to remove file");
    }
    setDeleting(null);
  }

  async function handleView(m: IncidentMedia) {
    try {
      const url = await getSignedFileUrl(m.fileUrl);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to open file");
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3 w-3" /> Evidence ({media.length})
        </p>
        {!readOnly && (
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              className="sr-only"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
              disabled={uploading}
            />
            <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none" tabIndex={-1}>
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              {uploading ? "Uploading..." : "Add Evidence"}
            </Button>
          </label>
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
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <button onClick={() => handleView(m)} className="flex-1 min-w-0 text-left hover:underline">
                  <p className="text-xs font-medium truncate">{m.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(m.fileSize)} &middot; {m.uploaderName} &middot; {new Date(m.createdAt).toLocaleString()}
                  </p>
                </button>
                {m.hash && (
                  <span className="text-[8px] font-mono text-muted-foreground/40 hidden sm:inline" title={`SHA-256: ${m.hash}`}>
                    #{m.hash.slice(0, 8)}
                  </span>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deleting === m.id}
                    className="text-muted-foreground/40 hover:text-red-500 transition-colors"
                  >
                    {deleting === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
