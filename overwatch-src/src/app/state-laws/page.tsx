"use client";

import { useState, useMemo } from "react";
import {
  Scale, Search, IdCard, Clock, User, Shield, Handshake,
  Crosshair, Building2, Gavel, AlertTriangle, ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { STATE_LAWS, type StateLaw } from "@/lib/state-laws-data";

function hasLicense(s: StateLaw) {
  const l = s.licensing.toLowerCase();
  return !l.includes("no state license") && !l.includes("not required");
}

const INFO_SECTIONS: { key: keyof StateLaw; label: string; icon: React.ReactNode }[] = [
  { key: "licensing", label: "Licensing Requirements", icon: <IdCard className="h-4 w-4 text-blue-500" /> },
  { key: "trainingHours", label: "Training Hours", icon: <Clock className="h-4 w-4 text-amber-500" /> },
  { key: "minAge", label: "Minimum Age", icon: <User className="h-4 w-4 text-green-500" /> },
  { key: "useOfForce", label: "Use of Force", icon: <Shield className="h-4 w-4 text-red-500" /> },
  { key: "citizensArrest", label: "Citizen's Arrest", icon: <Handshake className="h-4 w-4 text-purple-500" /> },
  { key: "weapons", label: "Weapons / Armed Guards", icon: <Crosshair className="h-4 w-4 text-orange-500" /> },
  { key: "agency", label: "Regulatory Agency", icon: <Building2 className="h-4 w-4 text-cyan-500" /> },
];

export default function StateLawsPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "licensed" | "unlicensed">("all");

  const filtered = useMemo(() => {
    let list = STATE_LAWS;
    if (filter === "licensed") list = list.filter(hasLicense);
    if (filter === "unlicensed") list = list.filter((s) => !hasLicense(s));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) ||
        s.licensing.toLowerCase().includes(q) || s.agency.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, filter]);

  const licensedCount = STATE_LAWS.filter(hasLicense).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <Scale className="h-5 w-5 sm:h-6 sm:w-6" /> STATE GUARD LAWS
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Security guard licensing requirements by state</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-border/40">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono">{STATE_LAWS.length}</p>
              <p className="text-[10px] text-muted-foreground">States Covered</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-blue-500">{licensedCount}</p>
              <p className="text-[10px] text-muted-foreground">Require License</p>
            </CardContent>
          </Card>
          <Card className="border-border/40">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-muted-foreground">{STATE_LAWS.length - licensedCount}</p>
              <p className="text-[10px] text-muted-foreground">No State License</p>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search by state name, code, or keyword..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs">
            <option value="all">All States ({STATE_LAWS.length})</option>
            <option value="licensed">License Required ({licensedCount})</option>
            <option value="unlicensed">No License ({STATE_LAWS.length - licensedCount})</option>
          </select>
        </div>

        {/* State List */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No states match your search.</p>
          )}
          {filtered.map((state) => {
            const isExpanded = expanded === state.code;
            const licensed = hasLicense(state);
            return (
              <Card key={state.code} className={`border-border/40 transition-all ${isExpanded ? "border-primary/30" : ""}`}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : state.code)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold w-8 text-center">{state.code}</span>
                    <div>
                      <span className="text-sm font-semibold">{state.name}</span>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{state.licensing}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] ${licensed ? "bg-blue-500/15 text-blue-600" : "bg-muted text-muted-foreground"}`}>
                      {licensed ? "Licensed" : "No License"}
                    </Badge>
                    {state.useOfForce.includes("Stand your ground") && (
                      <Badge className="text-[9px] bg-amber-500/15 text-amber-600">SYG</Badge>
                    )}
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 border-t border-border/30">
                    <div className="grid gap-3 sm:grid-cols-2 mt-3">
                      {INFO_SECTIONS.map(({ key, label, icon }) => (
                        <div key={key} className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {icon}
                            <span className="text-xs font-semibold">{label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground ml-5.5 pl-1">{String(state[key])}</p>
                        </div>
                      ))}
                    </div>

                    {/* Notes & Statutes */}
                    <div className="mt-4 space-y-2">
                      {state.statutes && (
                        <div className="flex items-start gap-1.5">
                          <Gavel className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs font-semibold">Governing Statutes</span>
                            <p className="text-xs text-muted-foreground">{state.statutes}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold">Notes</span>
                          <p className="text-xs text-muted-foreground">{state.notes}</p>
                        </div>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <p className="text-[9px] text-muted-foreground/60 mt-4 border-t border-border/20 pt-2">
                      This information is for educational purposes only. Always verify requirements with your state&apos;s regulatory agency.
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
