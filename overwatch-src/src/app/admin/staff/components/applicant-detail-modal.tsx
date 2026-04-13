"use client";

import { useState } from "react";
import {
  X, Shield, BookOpen, FileText, ArrowRight, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateApplicantStatus } from "@/lib/supabase/db";
import { getSignedFileUrl } from "@/lib/supabase/db-helpers";

const STATUS_COLORS: Record<string, string> = {
  applied: "bg-blue-500/15 text-blue-500",
  reviewing: "bg-amber-500/15 text-amber-600",
  interviewing: "bg-violet-500/15 text-violet-500",
  offered: "bg-cyan-500/15 text-cyan-500",
  hired: "bg-green-500/15 text-green-600",
  rejected: "bg-red-500/15 text-red-500",
  withdrawn: "bg-zinc-500/15 text-zinc-400",
};

interface ApplicantDetailModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applicant: any;
  canManage: boolean;
  updatingApp: string | null;
  activeCompanyId: string;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
}

export function ApplicantDetailModal({
  applicant: a,
  canManage,
  updatingApp,
  activeCompanyId,
  onClose,
  onStatusChange,
}: ApplicantDetailModalProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [localApplicant, setLocalApplicant] = useState<any>(a);

  // Keep in sync if parent updates the applicant prop
  // (simple: we use localApplicant for notes edits only)
  const display = { ...a, ...localApplicant };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4 shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sm font-bold text-blue-500">
            {(display.first_name?.[0] ?? "")}{(display.last_name?.[0] ?? "")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{display.first_name} {display.last_name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`text-[9px] capitalize ${STATUS_COLORS[display.status] ?? "bg-muted text-muted-foreground"}`}>{display.status}</Badge>
              {display.source && display.source !== "overwatch" && (
                <Badge variant="outline" className="text-[9px]">{display.source}</Badge>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
          {/* Personal Information */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personal Information</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-muted-foreground text-[10px]">Email</span>
                <p className="text-xs font-medium">{display.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Phone</span>
                <p className="text-xs font-medium">{display.phone || "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground text-[10px]">Address</span>
                <p className="text-xs font-medium">{display.address || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Applied</span>
                <p className="text-xs font-medium">{new Date(display.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/30" />

          {/* Credentials */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Shield className="h-3 w-3" /> Credentials</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <span className="text-muted-foreground text-[10px]">Guard Card Number</span>
                <p className="text-xs font-medium">{display.guard_card_number || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[10px]">Guard Card Expiry</span>
                <p className="text-xs font-medium">{display.guard_card_expiry ? new Date(display.guard_card_expiry).toLocaleDateString() : "—"}</p>
              </div>
            </div>
          </div>

          {/* Education */}
          {display.education?.length > 0 && (
            <>
              <hr className="border-border/30" />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><BookOpen className="h-3 w-3" /> Education</h3>
                <div className="space-y-1.5">
                  {display.education.map((edu: { institution: string; degree: string; startYear: string; endYear: string }, idx: number) => (
                    <div key={idx} className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                      <p className="text-xs font-medium">{edu.institution}{edu.degree ? ` — ${edu.degree}` : ""}</p>
                      {(edu.startYear || edu.endYear) && (
                        <p className="text-[10px] text-muted-foreground">{edu.startYear || "?"} - {edu.endYear || "Present"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Work History / Experience */}
          {display.work_history?.length > 0 && (
            <>
              <hr className="border-border/30" />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Experience</h3>
                <div className="space-y-2">
                  {display.work_history.map((wh: { employer: string; title: string; startDate: string; endDate: string; description: string }, idx: number) => (
                    <div key={idx} className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                      <p className="text-xs font-medium">{wh.title}{wh.employer ? ` at ${wh.employer}` : ""}</p>
                      {(wh.startDate || wh.endDate) && (
                        <p className="text-[10px] text-muted-foreground">{wh.startDate || "?"} - {wh.endDate || "Present"}</p>
                      )}
                      {wh.description && <p className="text-[10px] text-muted-foreground/80 mt-1">{wh.description}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Documents */}
          {display.documents?.length > 0 && (
            <>
              <hr className="border-border/30" />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Documents</h3>
                <div className="space-y-1.5">
                  {display.documents.map((doc: { name: string; type: string; fileUrl: string }, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs font-medium truncate flex-1">{doc.name}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0">{doc.type}</Badge>
                      {doc.fileUrl && (
                        <button
                          className="text-[10px] text-primary hover:underline shrink-0"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const url = await getSignedFileUrl(doc.fileUrl);
                            window.open(url, "_blank", "noopener,noreferrer");
                          }}>View</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          <hr className="border-border/30" />
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</h3>
            <textarea
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-xs min-h-[60px] resize-y"
              placeholder="Add internal notes about this applicant..."
              defaultValue={display.notes ?? ""}
              onBlur={async (e) => {
                const newNotes = e.target.value;
                if (newNotes !== (display.notes ?? "")) {
                  try {
                    await updateApplicantStatus(display.id, display.status, newNotes);
                    setLocalApplicant((prev: typeof display) => ({ ...prev, notes: newNotes }));
                  } catch (err) { console.error(err); toast.error("Failed to save notes"); }
                }
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        {canManage && display.status !== "hired" && display.status !== "rejected" && display.status !== "withdrawn" && (
          <div className="border-t border-border/40 px-5 py-3 shrink-0">
            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {display.status === "applied" && (
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1"
                  onClick={() => onStatusChange(display.id, "reviewing")}
                  disabled={updatingApp === display.id}>
                  {updatingApp === display.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Review"}
                </Button>
              )}
              {display.status === "reviewing" && (
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1"
                  onClick={() => onStatusChange(display.id, "interviewing")}
                  disabled={updatingApp === display.id}>
                  {updatingApp === display.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Interview"}
                </Button>
              )}
              {display.status === "interviewing" && (
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1"
                  onClick={() => onStatusChange(display.id, "offered")}
                  disabled={updatingApp === display.id}>
                  {updatingApp === display.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Offer"}
                </Button>
              )}
              {(display.status === "offered" || display.status === "interviewing") && (
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                  onClick={() => onStatusChange(display.id, "hired")}
                  disabled={updatingApp === display.id}>
                  {updatingApp === display.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowRight className="h-3 w-3" /> Hire</>}
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-8 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                onClick={() => onStatusChange(display.id, "rejected")}
                disabled={updatingApp === display.id}>
                <XCircle className="h-3 w-3" /> Reject
              </Button>
            </div>
          </div>
        )}

        {/* Close button for terminal statuses */}
        {(display.status === "hired" || display.status === "rejected" || display.status === "withdrawn" || !canManage) && (
          <div className="border-t border-border/40 px-5 py-3 shrink-0">
            <Button size="sm" variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}
