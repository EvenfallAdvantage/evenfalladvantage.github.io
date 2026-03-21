"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Check, Clock, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEventDocuments } from "@/lib/supabase/db";
import type { OperationDocument } from "@/types/operations";

const DOC_META: Record<string, { label: string; color: string; icon: string }> = {
  intake: { label: "Intake", color: "text-blue-500 bg-blue-500/10 border-blue-500/30", icon: "📋" },
  warno: { label: "WARNO", color: "text-primary bg-primary/10 border-primary/30", icon: "⚠️" },
  opord: { label: "OPORD", color: "text-green-600 bg-green-500/10 border-green-500/30", icon: "📄" },
  frago: { label: "FRAGO", color: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: "🔄" },
  gotwa: { label: "GOTWA", color: "text-violet-500 bg-violet-500/10 border-violet-500/30", icon: "🎯" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground", icon: <Clock className="h-2.5 w-2.5" /> },
  issued: { label: "Issued", cls: "bg-green-500/15 text-green-600", icon: <Check className="h-2.5 w-2.5" /> },
  superseded: { label: "Superseded", cls: "bg-amber-500/15 text-amber-600", icon: <AlertTriangle className="h-2.5 w-2.5" /> },
};

interface DocHubProps {
  eventId: string;
  onOpenDoc?: (docType: string) => void;
  onClose: () => void;
}

export default function DocHub({ eventId, onOpenDoc, onClose }: DocHubProps) {
  const [docs, setDocs] = useState<OperationDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await getEventDocuments(eventId);
        setDocs(d);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  if (loading) {
    return (
      <div className="px-3 sm:px-4 py-6 flex justify-center border-b border-border/20 bg-muted/20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group by type
  const grouped: Record<string, OperationDocument[]> = {};
  for (const d of docs) {
    if (!grouped[d.doc_type]) grouped[d.doc_type] = [];
    grouped[d.doc_type].push(d);
  }

  const docOrder = ["intake", "warno", "opord", "frago", "gotwa"];
  const sortedTypes = docOrder.filter(t => grouped[t]);
  const missingTypes = docOrder.filter(t => !grouped[t]);

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider">Document Hub</span>
          <span className="text-[10px] text-muted-foreground font-mono">({docs.length} doc{docs.length !== 1 ? "s" : ""})</span>
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Existing docs */}
      {sortedTypes.length > 0 ? (
        <div className="space-y-1.5">
          {sortedTypes.map(type => {
            const meta = DOC_META[type] || { label: type, color: "text-muted-foreground bg-muted border-border", icon: "📝" };
            const typeDocs = grouped[type];
            return (
              <div key={type}>
                {typeDocs.map((d, idx) => {
                  const status = STATUS_BADGE[d.status] || STATUS_BADGE.draft;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onOpenDoc?.(type)}
                      className="w-full flex items-center gap-2 rounded-lg border border-border/30 bg-background/50 px-3 py-2 hover:bg-muted/30 transition-colors text-left mb-1"
                    >
                      <span className="text-base">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold">{meta.label}</span>
                          {type === "frago" && typeDocs.length > 1 && (
                            <span className="text-[9px] text-muted-foreground font-mono">#{idx + 1}</span>
                          )}
                          <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold ${status.cls}`}>
                            {status.icon} {status.label}
                          </span>
                          {d.version > 1 && <span className="text-[8px] text-muted-foreground font-mono">v{d.version}</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {d.status === "issued" ? `Issued ${new Date(d.issued_at || d.updated_at).toLocaleDateString()}` : `Last updated ${new Date(d.updated_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">No documents created yet. Use the buttons above to create WARNO, OPORD, FRAGO, or GOTWA documents.</p>
      )}

      {/* Missing doc types */}
      {missingTypes.length > 0 && (
        <div className="pt-2 border-t border-border/20">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Not yet created</p>
          <div className="flex flex-wrap gap-1.5">
            {missingTypes.map(type => {
              const meta = DOC_META[type] || { label: type, color: "text-muted-foreground bg-muted border-border", icon: "📝" };
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onOpenDoc?.(type)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors hover:opacity-80 ${meta.color}`}
                >
                  <span>{meta.icon}</span> {meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
