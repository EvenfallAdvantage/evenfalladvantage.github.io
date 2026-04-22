"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Copy, Globe, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getCompanyPostings, publishPosting, closePosting, deletePosting, getPostingApplicantCounts,
  type JobPosting,
} from "@/lib/supabase/db-postings";
import { PostingFormModal } from "./posting-form-modal";
import { logger } from "@/lib/logger";

interface PostingsTabProps {
  activeCompanyId: string;
  canManage: boolean;
  companyName: string;
}

export function PostingsTab({ activeCompanyId, canManage: _canManage, companyName: _companyName }: PostingsTabProps) {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [postingCounts, setPostingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showNewPosting, setShowNewPosting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingPosting, setEditingPosting] = useState<any>(null);

  // Derive joinCode from companyName — not ideal, but postings tab needs it for the careers link
  // We receive it indirectly. The parent passes companyName; we also need joinCode for the careers link.
  // We'll accept it via an extended approach — but for simplicity, we compute the careers URL from activeCompanyId.

  const loadData = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [p, c] = await Promise.all([
        getCompanyPostings(activeCompanyId),
        getPostingApplicantCounts(activeCompanyId),
      ]);
      setPostings(p);
      setPostingCounts(c);
    } catch (e) { logger.swallow("postings:load", e, "warn"); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleReload() {
    if (!activeCompanyId) return;
    setPostings(await getCompanyPostings(activeCompanyId));
    setPostingCounts(await getPostingApplicantCounts(activeCompanyId));
    setShowNewPosting(false);
    setEditingPosting(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Job Postings</p>
          <p className="text-xs text-muted-foreground">Create and manage job listings for your careers page</p>
        </div>
        <Button size="sm" onClick={() => { setShowNewPosting(true); setEditingPosting(null); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Posting
        </Button>
      </div>

      {/* Posting list */}
      {postings.length === 0 && !loading ? (
        <div className="text-center py-8 text-muted-foreground">
          <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No job postings yet</p>
          <p className="text-xs mt-1">Create your first posting to start attracting talent</p>
        </div>
      ) : (
        <div className="space-y-2">
          {postings.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {p.department && `${p.department} · `}{p.location && `${p.location} · `}{p.employment_type}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                p.status === "active" ? "bg-green-500/15 text-green-600" :
                p.status === "paused" ? "bg-amber-500/15 text-amber-600" :
                p.status === "closed" ? "bg-red-500/15 text-red-500" :
                "bg-muted text-muted-foreground"
              }`}>{p.status.toUpperCase()}</span>
              {(postingCounts[p.id] ?? 0) > 0 && (
                <span className="text-[10px] text-muted-foreground">{postingCounts[p.id]} applicant{postingCounts[p.id] !== 1 ? "s" : ""}</span>
              )}
              <div className="flex gap-1 shrink-0">
                {p.status === "draft" && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                    await publishPosting(p.id);
                    if (activeCompanyId) setPostings(await getCompanyPostings(activeCompanyId));
                  }}>Publish</Button>
                )}
                {p.status === "active" && (
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={async () => {
                    await closePosting(p.id);
                    if (activeCompanyId) setPostings(await getCompanyPostings(activeCompanyId));
                  }}>Close</Button>
                )}
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => {
                  setEditingPosting(p);
                  setShowNewPosting(true);
                }}><Pencil className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="text-xs h-7 text-red-500" onClick={async () => {
                  if (!confirm("Delete this posting?")) return;
                  await deletePosting(p.id);
                  if (activeCompanyId) setPostings(await getCompanyPostings(activeCompanyId));
                }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Careers page link */}
      {activeCompanyId && (
        <div className="rounded-lg border border-border/30 p-3 bg-muted/30">
          <p className="text-xs font-semibold mb-1 flex items-center gap-1.5"><Globe className="h-3 w-3" /> Public Careers Page</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[10px] font-mono text-muted-foreground bg-background rounded px-2 py-1 truncate">
              {typeof window !== "undefined" ? `${window.location.origin}/overwatch/careers?company=${activeCompanyId}` : ""}
            </code>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1 shrink-0" onClick={() => {
              const url = `${window.location.origin}/overwatch/careers?company=${activeCompanyId}`;
              navigator.clipboard.writeText(url);
            }}><Copy className="h-3 w-3" /> Copy</Button>
          </div>
        </div>
      )}

      {/* New/Edit Posting Modal */}
      {showNewPosting && (
        <PostingFormModal
          posting={editingPosting}
          activeCompanyId={activeCompanyId}
          onClose={() => { setShowNewPosting(false); setEditingPosting(null); }}
          onSaved={handleReload}
        />
      )}
    </div>
  );
}
