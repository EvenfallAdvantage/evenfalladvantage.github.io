"use client";

/**
 * FilterBar - shared toolbar for analytics, incident board, and task board.
 *
 * Renders date-range pickers, team selector, status/priority/type selectors,
 * search input. All inputs are controlled — parent owns state.
 */

import { useId } from "react";
import { CalendarRange, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Team } from "@/lib/supabase/db-teams";

export interface FilterBarValue {
  from: string;
  to: string;
  teamId: string;
  status: string;
  priority: string;
  type: string;
  search: string;
}

interface FilterBarProps {
  value: FilterBarValue;
  onChange: (next: FilterBarValue) => void;
  teams?: Team[];
  statuses?: Array<{ value: string; label: string }>;
  priorities?: Array<{ value: string; label: string }>;
  types?: Array<{ value: string; label: string }>;
  showSearch?: boolean;
  showDateRange?: boolean;
  /** Quick-range shortcuts. */
  showPresets?: boolean;
  onReset?: () => void;
}

const DEFAULT_PRIORITIES = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function FilterBar({
  value,
  onChange,
  teams = [],
  statuses = [],
  priorities = DEFAULT_PRIORITIES,
  types = [],
  showSearch = true,
  showDateRange = true,
  showPresets = true,
  onReset,
}: FilterBarProps) {
  const fromId = useId();
  const toId = useId();

  const setField = <K extends keyof FilterBarValue>(key: K, v: FilterBarValue[K]) =>
    onChange({ ...value, [key]: v });

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    onChange({
      ...value,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
      {showDateRange && (
        <>
          <div>
            <Label htmlFor={fromId} className="text-[10px] uppercase tracking-wider text-muted-foreground">
              From
            </Label>
            <Input
              id={fromId}
              type="date"
              value={value.from}
              onChange={(e) => setField("from", e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <Label htmlFor={toId} className="text-[10px] uppercase tracking-wider text-muted-foreground">
              To
            </Label>
            <Input
              id={toId}
              type="date"
              value={value.to}
              onChange={(e) => setField("to", e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </>
      )}

      {teams.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Team
          </Label>
          <select
            value={value.teamId}
            onChange={(e) => setField("teamId", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Team filter"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {statuses.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Status
          </Label>
          <select
            value={value.status}
            onChange={(e) => setField("status", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Status filter"
          >
            <option value="">All</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {priorities.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Priority
          </Label>
          <select
            value={value.priority}
            onChange={(e) => setField("priority", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Priority filter"
          >
            <option value="">All</option>
            {priorities.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      )}

      {types.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Type
          </Label>
          <select
            value={value.type}
            onChange={(e) => setField("type", e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Type filter"
          >
            <option value="">All</option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      )}

      {showSearch && (
        <div className="flex-1 min-w-[180px]">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={value.search}
              onChange={(e) => setField("search", e.target.value)}
              placeholder="Search..."
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
      )}

      {showPresets && (
        <div className="flex items-end gap-1">
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => applyPreset(7)}>
            7d
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => applyPreset(30)}>
            30d
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => applyPreset(90)}>
            90d
          </Button>
        </div>
      )}

      {onReset && (
        <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={onReset}>
          <CalendarRange className="h-3.5 w-3.5 mr-1" /> Reset
        </Button>
      )}
    </div>
  );
}
