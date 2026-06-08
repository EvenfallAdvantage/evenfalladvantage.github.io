"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import type { Team } from "@/lib/supabase/db-teams";

interface TaskFiltersProps {
  scope: "mine" | "team" | "all";
  onScopeChange: (s: "mine" | "team" | "all") => void;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  priorityFilter: string;
  onPriorityChange: (s: string) => void;
  teamFilter: string;
  onTeamChange: (s: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  teams: Team[];
  counts: { total: number; open: number; overdue: number };
}

export function TaskFilters({
  scope,
  onScopeChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  teamFilter,
  onTeamChange,
  search,
  onSearchChange,
  teams,
  counts,
}: TaskFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Stats badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-card">
          {counts.total} total
        </Badge>
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">
          {counts.open} open
        </Badge>
        {counts.overdue > 0 && (
          <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
            {counts.overdue} overdue
          </Badge>
        )}
      </div>

      {/* Scope tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs ${scope === "mine" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onScopeChange("mine")}
        >
          My Tasks
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs ${scope === "team" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onScopeChange("team")}
        >
          Team
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`text-xs ${scope === "all" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => onScopeChange("all")}
        >
          All
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {teams.length > 0 && (
          <select
            value={teamFilter}
            onChange={(e) => onTeamChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Filter by team"
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
