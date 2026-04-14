"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { STATUS, type Incident } from "./constants";

interface IncidentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  incidents: Incident[];
}

export function IncidentFilters({ search, onSearchChange, filter, onFilterChange, incidents }: IncidentFiltersProps) {
  return (
    <>
      {/* Search + Status Filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search incidents..." value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "All", color: "" }, ...STATUS].map(s => (
            <Button
              key={s.value}
              variant={filter === s.value ? "default" : "outline"}
              size="sm"
              onClick={() => onFilterChange(s.value)}
              className="text-xs"
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open", count: incidents.filter((i: Incident) => i.status === "open").length, color: "text-red-500" },
          { label: "Investigating", count: incidents.filter((i: Incident) => i.status === "investigating").length, color: "text-amber-500" },
          { label: "Resolved", count: incidents.filter((i: Incident) => i.status === "resolved").length, color: "text-green-500" },
          { label: "Critical", count: incidents.filter((i: Incident) => i.severity === "critical").length, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.count}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
