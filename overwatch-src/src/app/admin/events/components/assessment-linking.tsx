"use client";

import { useState } from "react";
import { X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getAssessmentsByEventId,
  getUnlinkedAssessments,
  linkAssessmentToEvent,
  unlinkAssessment,
  type SiteAssessment,
} from "@/lib/supabase/db-assessments";

interface AssessmentLinkingProps {
  eventId: string;
  activeCompanyId: string;
  linkedAssessment: SiteAssessment | null;
  onLinkedAssessmentChange: (assessment: SiteAssessment | null) => void;
}

export function AssessmentBadge({
  eventId,
  activeCompanyId,
  linkedAssessment,
  onLinkedAssessmentChange,
}: AssessmentLinkingProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [unlinkedAssessments, setUnlinkedAssessments] = useState<SiteAssessment[]>([]);

  const handleLink = async (assessmentId: string) => {
    await linkAssessmentToEvent(assessmentId, eventId);
    const assessments = await getAssessmentsByEventId(eventId);
    if (assessments.length > 0) onLinkedAssessmentChange(assessments[0]);
    setShowPicker(false);
    toast.success("Assessment linked to operation");
  };

  const handleUnlink = async () => {
    if (!linkedAssessment) return;
    await unlinkAssessment(linkedAssessment.id);
    onLinkedAssessmentChange(null);
    toast.success("Assessment unlinked");
  };

  const openPicker = async () => {
    if (!activeCompanyId) return;
    const unlinked = await getUnlinkedAssessments(activeCompanyId);
    setUnlinkedAssessments(unlinked);
    setShowPicker(true);
  };

  return (
    <>
      {/* Badge / Button in action bar */}
      {linkedAssessment ? (
        <div className="flex items-center gap-1">
          <a
            href={`/overwatch/site-assessment?id=${linkedAssessment.id}`}
            onClick={(e) => e.stopPropagation()}
            className={`h-7 px-2 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors ${
              linkedAssessment.risk_level === "Critical" ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" :
              linkedAssessment.risk_level === "High" ? "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" :
              linkedAssessment.risk_level === "Moderate" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20" :
              "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
            }`}
            title="View linked assessment"
          >
            <ClipboardCheck className="h-3.5 w-3.5" /> Assessment: {linkedAssessment.risk_level || "N/A"}
          </a>
          <button
            onClick={handleUnlink}
            className="h-7 w-7 rounded-md border border-border/40 flex items-center justify-center text-muted-foreground/50 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
            title="Unlink assessment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openPicker}>
          <ClipboardCheck className="h-3.5 w-3.5" /> Link Assessment
        </Button>
      )}

      {/* Picker panel (rendered outside action bar via portal-style) */}
      {showPicker && (
        <AssessmentPicker
          unlinkedAssessments={unlinkedAssessments}
          onLink={handleLink}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

/* ── Picker sub-component ── */

interface AssessmentPickerProps {
  unlinkedAssessments: SiteAssessment[];
  onLink: (id: string) => void;
  onClose: () => void;
}

export function AssessmentPicker({ unlinkedAssessments, onLink, onClose }: AssessmentPickerProps) {
  return (
    <div className="px-3 sm:px-4 py-3 border-b border-border/20">
      <div className="border border-zinc-800 rounded-lg p-3 bg-zinc-900/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-300">Link Assessment</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
        </div>
        {unlinkedAssessments.length === 0 ? (
          <p className="text-xs text-zinc-500">No unlinked assessments available</p>
        ) : (
          unlinkedAssessments.map(a => (
            <button key={a.id} onClick={() => onLink(a.id)}
              className="w-full text-left px-3 py-2 rounded bg-zinc-800/50 hover:bg-zinc-800 text-xs">
              <span className="text-zinc-200">{a.client_name || "Unnamed"}</span>
              {a.risk_level && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  a.risk_level === "Critical" ? "bg-red-500/20 text-red-400" :
                  a.risk_level === "High" ? "bg-orange-500/20 text-orange-400" :
                  a.risk_level === "Moderate" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-green-500/20 text-green-400"
                }`}>{a.risk_level}</span>
              )}
              {a.address && <span className="ml-2 text-zinc-500">{a.address}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
