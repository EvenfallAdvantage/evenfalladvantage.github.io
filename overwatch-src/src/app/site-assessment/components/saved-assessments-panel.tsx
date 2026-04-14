"use client";

import { Plus, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { SiteAssessment } from "@/lib/supabase/db-assessments";

interface SavedAssessmentsPanelProps {
  assessments: SiteAssessment[];
  currentId: string | null;
  onLoad: (assessment: SiteAssessment) => void;
  onNew: () => void;
}

export default function SavedAssessmentsPanel({ assessments, currentId, onLoad, onNew }: SavedAssessmentsPanelProps) {
  const router = useRouter();

  if (assessments.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-300">Saved Assessments</h3>
        <Button size="sm" variant="outline" onClick={onNew}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New
        </Button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {assessments.map((a) => (
          <button
            key={a.id}
            onClick={() => onLoad(a)}
            className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
              currentId === a.id
                ? "bg-emerald-500/20 border border-emerald-500/30"
                : "bg-zinc-800/50 hover:bg-zinc-800 border border-transparent"
            }`}
          >
            <div className="font-medium text-zinc-200">{a.client_name || "Unnamed"}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {a.risk_level && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  a.risk_level === "Critical" ? "bg-red-500/20 text-red-400"
                  : a.risk_level === "High" ? "bg-orange-500/20 text-orange-400"
                  : a.risk_level === "Moderate" ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-green-500/20 text-green-400"
                }`}>
                  {a.risk_level.toUpperCase()}
                </span>
              )}
              <span className="text-zinc-500">{new Date(a.created_at).toLocaleDateString()}</span>
              {!a.event_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/overwatch/admin/events?fromAssessment=${a.id}`);
                  }}
                  className="ml-auto text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  title="Create Operation from this assessment"
                >
                  <Flag className="h-3 w-3" /> Create Op
                </button>
              )}
              {a.event_id && (
                <span className="ml-auto text-[10px] text-blue-400 flex items-center gap-1">
                  <Flag className="h-3 w-3" /> Linked
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
