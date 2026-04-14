"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EducationEntry } from "./apply-types";

interface ApplyEducationSectionProps {
  education: EducationEntry[];
  onAdd: () => void;
  onUpdate: (idx: number, field: keyof EducationEntry, value: string) => void;
  onRemove: (idx: number) => void;
}

export function ApplyEducationSection({ education, onAdd, onUpdate, onRemove }: ApplyEducationSectionProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</span>
        Education
      </h2>
      <p className="text-xs text-zinc-500">Optional. Add your educational background.</p>

      {education.map((edu, idx) => (
        <div key={idx} className="relative rounded-lg border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            aria-label="Remove education entry"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Institution</label>
              <Input
                value={edu.institution}
                onChange={(e) => onUpdate(idx, "institution", e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="University or School Name"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Degree / Program</label>
              <Input
                value={edu.degree}
                onChange={(e) => onUpdate(idx, "degree", e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Bachelor of Science, GED, etc."
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Start Year</label>
              <Input
                value={edu.startYear}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                  onUpdate(idx, "startYear", v);
                }}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="2020"
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">End Year</label>
              <Input
                value={edu.endYear}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.toLowerCase().startsWith("p")) {
                    onUpdate(idx, "endYear", "Present");
                  } else {
                    const v = raw.replace(/\D/g, "").slice(0, 4);
                    onUpdate(idx, "endYear", v);
                  }
                }}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder='2024 or "Present"'
              />
            </div>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={onAdd}
        className="gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
        <Plus className="h-3.5 w-3.5" /> Add Education
      </Button>
    </div>
  );
}
