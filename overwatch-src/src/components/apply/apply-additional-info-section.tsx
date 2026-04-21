"use client";

import { Input } from "@/components/ui/input";

interface ApplyAdditionalInfoSectionProps {
  availability: string;
  coverLetter: string;
  onChange: (field: string, value: string) => void;
}

export function ApplyAdditionalInfoSection({ availability, coverLetter, onChange }: ApplyAdditionalInfoSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">6</span>
        Additional Info
      </h2>
      <div>
        <label htmlFor="apply-availability" className="text-xs text-zinc-400 mb-1 block">Availability</label>
        <Input id="apply-availability" value={availability} onChange={(e) => onChange("availability", e.target.value)}
          className="bg-zinc-900 border-zinc-700 text-white" placeholder="Weekdays, Weekends, Nights, etc." />
      </div>
      <div>
        <label htmlFor="apply-cover-letter" className="text-xs text-zinc-400 mb-1 block">Why do you want to work with us?</label>
        <textarea id="apply-cover-letter" value={coverLetter} onChange={(e) => onChange("coverLetter", e.target.value)}
          rows={3} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Tell us about yourself and why you'd be a great fit..." />
      </div>
    </div>
  );
}
