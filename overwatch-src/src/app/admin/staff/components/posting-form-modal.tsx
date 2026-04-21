"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createJobPosting, updateJobPosting,
  type JobPosting,
} from "@/lib/supabase/db-postings";
import { logger } from "@/lib/logger";

interface PostingFormModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  posting?: any;
  activeCompanyId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PostingFormModal({ posting, activeCompanyId, onClose, onSaved }: PostingFormModalProps) {
  const [postingForm, setPostingForm] = useState({
    title: posting?.title ?? "",
    department: posting?.department ?? "",
    location: posting?.location ?? "",
    employment_type: posting?.employment_type ?? "full-time",
    description_html: posting?.description_html ?? "",
    requirements: posting?.requirements ?? "",
    compensation_range: posting?.compensation_range ?? "",
    show_compensation: posting?.show_compensation ?? false,
  });
  const [savingPosting, setSavingPosting] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 shrink-0">
          <span className="text-sm font-semibold">{posting ? "Edit Posting" : "New Job Posting"}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Title *</label>
            <Input placeholder="e.g., Security Officer" value={postingForm.title} onChange={(e) => setPostingForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Input placeholder="e.g., Operations" value={postingForm.department} onChange={(e) => setPostingForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Location</label>
              <Input placeholder="e.g., Chicago, IL" value={postingForm.location} onChange={(e) => setPostingForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Employment Type</label>
            <select value={postingForm.employment_type} onChange={(e) => setPostingForm((f) => ({ ...f, employment_type: e.target.value }))} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
              <option value="full-time">Full-Time</option>
              <option value="part-time">Part-Time</option>
              <option value="contract">Contract</option>
              <option value="temporary">Temporary</option>
              <option value="internship">Internship</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Job Description *</label>
            <textarea className="mt-1 w-full min-h-[120px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y" placeholder="Describe the role, responsibilities, and qualifications..." value={postingForm.description_html} onChange={(e) => setPostingForm((f) => ({ ...f, description_html: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Requirements</label>
            <textarea className="mt-1 w-full min-h-[60px] rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y" placeholder="Required qualifications, certifications, experience..." value={postingForm.requirements} onChange={(e) => setPostingForm((f) => ({ ...f, requirements: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Compensation Range</label>
              <Input placeholder="e.g., $18-22/hr" value={postingForm.compensation_range} onChange={(e) => setPostingForm((f) => ({ ...f, compensation_range: e.target.value }))} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={postingForm.show_compensation} onChange={(e) => setPostingForm((f) => ({ ...f, show_compensation: e.target.checked }))} className="rounded" />
                Show on careers page
              </label>
            </div>
          </div>
        </div>
        <div className="border-t border-border/40 px-5 py-3 flex justify-end gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!postingForm.title.trim() || !postingForm.description_html.trim() || savingPosting} onClick={async () => {
            if (!activeCompanyId) return;
            setSavingPosting(true);
            try {
              if (posting) {
                await updateJobPosting(posting.id, postingForm as Partial<JobPosting>);
              } else {
                await createJobPosting(activeCompanyId, postingForm as Parameters<typeof createJobPosting>[1]);
              }
              onSaved();
            } catch (e) { logger.swallow("posting-form:save", e, "warn"); }
            setSavingPosting(false);
          }}>
            {savingPosting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            {posting ? "Save Changes" : "Create Posting"}
          </Button>
        </div>
      </div>
    </div>
  );
}
