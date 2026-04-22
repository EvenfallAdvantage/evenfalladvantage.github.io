"use client";

import { Check, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Section header for OPORD panel (collapsible sections).
 * Extracted to module-level to satisfy React Compiler (no components during render).
 */
export function OpordSectionHeader({
  id,
  title,
  collapsed,
  onToggle,
}: {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button type="button" onClick={() => onToggle(id)} className="flex items-center justify-between w-full pt-2 border-t border-border/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {collapsed ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronUp className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

/**
 * Section header for Intake panel (non-collapsible).
 */
export function IntakeSectionHeader({ title }: { title: string }) {
  return (
    <div className="pt-2 border-t border-border/20">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
    </div>
  );
}

/**
 * Chip toggle group for multi-select fields in ops panels.
 * Extracted to module-level to satisfy React Compiler.
 */
export function OpsChips<T extends string>({
  selected,
  options,
  color = "primary",
  disabled = false,
  onToggle,
}: {
  selected: string[];
  options: T[];
  color?: string;
  disabled?: boolean;
  onToggle: (val: T) => void;
}) {
  const colorClass =
    color === "red" ? "border-red-500/60 bg-red-500/10 text-red-500"
    : color === "amber" ? "border-amber-500/60 bg-amber-500/10 text-amber-600"
    : color === "green" ? "border-green-500/60 bg-green-500/10 text-green-600"
    : "border-primary bg-primary/10 text-primary";

  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {options.map(t => (
        <button
          key={t}
          type="button"
          onClick={() => !disabled && onToggle(t)}
          className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
            selected.includes(t) ? colorClass : "border-border/40 text-muted-foreground hover:border-border"
          }`}
        >
          {selected.includes(t) && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{t}
        </button>
      ))}
    </div>
  );
}
