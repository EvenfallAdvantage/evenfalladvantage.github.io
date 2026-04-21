"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WorkHistoryEntry } from "./apply-types";

interface ApplyExperienceSectionProps {
  workHistory: WorkHistoryEntry[];
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof WorkHistoryEntry, value: string) => void;
  onRemove: (idx: number) => void;
}

export function ApplyExperienceSection({ workHistory, onAdd, onUpdate, onRemove }: ApplyExperienceSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">4</span>
        Experience
      </h2>
      <p className="text-xs text-zinc-500">Optional. Add your work history.</p>

      {workHistory.map((job, idx) => (
        <div key={idx} className="relative rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            aria-label="Remove experience entry"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`apply-employer-${idx}`} className="text-xs text-zinc-400 mb-1 block">Employer</label>
              <Input
                id={`apply-employer-${idx}`}
                value={job.employer}
                onChange={(e) => onUpdate(idx, "employer", e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Company Name"
              />
            </div>
            <div>
              <label htmlFor={`apply-job-title-${idx}`} className="text-xs text-zinc-400 mb-1 block">Job Title</label>
              <Input
                id={`apply-job-title-${idx}`}
                value={job.title}
                onChange={(e) => onUpdate(idx, "title", e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Security Officer, etc."
              />
            </div>
            <div>
              <label htmlFor={`apply-start-date-${idx}`} className="text-xs text-zinc-400 mb-1 block">Start Date</label>
              <Input
                id={`apply-start-date-${idx}`}
                value={job.startDate}
                onChange={(e) => onUpdate(idx, "startDate", e.target.value)}
                type="month"
                className="bg-zinc-800 border-zinc-600 text-white"
              />
            </div>
            <div>
              <label htmlFor={`apply-end-date-${idx}`} className="text-xs text-zinc-400 mb-1 block">End Date</label>
              <div className="space-y-1.5">
                <Input
                  id={`apply-end-date-${idx}`}
                  value={job.endDate === "Present" ? "" : job.endDate}
                  onChange={(e) => onUpdate(idx, "endDate", e.target.value)}
                  type="month"
                  disabled={job.endDate === "Present"}
                  className="bg-zinc-800 border-zinc-600 text-white disabled:opacity-50"
                />
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={job.endDate === "Present"}
                    onChange={(e) => onUpdate(idx, "endDate", e.target.checked ? "Present" : "")}
                    className="rounded border-zinc-600 bg-zinc-800 text-primary focus:ring-primary"
                  />
                  Currently work here
                </label>
              </div>
            </div>
          </div>
          <div>
            <label htmlFor={`apply-job-description-${idx}`} className="text-xs text-zinc-400 mb-1 block">Description</label>
            <textarea
              id={`apply-job-description-${idx}`}
              value={job.description}
              onChange={(e) => onUpdate(idx, "description", e.target.value)}
              rows={2}
              className="w-full rounded-md border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Describe your responsibilities and achievements..."
            />
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={onAdd}
        className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
        <Plus className="h-3.5 w-3.5" /> Add Experience
      </Button>
    </div>
  );
}
