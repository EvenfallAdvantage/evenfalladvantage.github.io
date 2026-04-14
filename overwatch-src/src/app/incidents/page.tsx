"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { AlertTriangle, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import {
  getIncidents,
  getCompanyMembers,
  getActiveTimesheet,
} from "@/lib/supabase/db";
import { usePageHeader } from "@/stores/page-header-store";

import { IncidentCreateForm } from "./components/incident-create-form";
import { IncidentFilters } from "./components/incident-filters";
import { IncidentList } from "./components/incident-list";
import type { Incident, Member } from "./components/constants";

export default function IncidentsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore(s => s.getActiveCompany());
  const isAdmin = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeTimesheet, setActiveTimesheet] = useState<any>(null);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(
      "REPORTS",
      "Incident reports, field reports, and documentation",
      <AlertTriangle className="h-5 w-5" />,
      <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Report Incident
      </Button>
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, showCreate]);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") return;
    try {
      const [inc, mem, ts] = await Promise.all([
        getIncidents(activeCompanyId, filter),
        getCompanyMembers(activeCompanyId),
        getActiveTimesheet(),
      ]);
      setIncidents(inc);
      setMembers(mem);
      setActiveTimesheet(ts);
    } catch { /* */ } finally { setLoading(false); }
  }, [activeCompanyId, filter]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Report type tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
        <Link
          href="/dictate"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
        >
          Dictate
        </Link>
        <Link
          href="/forms"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors"
        >
          Field Reports
        </Link>
        <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          Incidents
        </div>
      </div>

      {/* Create Form */}
      {showCreate && activeCompanyId && (
        <IncidentCreateForm
          activeCompanyId={activeCompanyId}
          activeTimesheet={activeTimesheet}
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Filters + Stats */}
      <IncidentFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
        incidents={incidents}
      />

      {/* Incident List */}
      {activeCompanyId && (
        <IncidentList
          incidents={incidents}
          members={members}
          loading={false}
          search={search}
          isAdmin={!!isAdmin}
          activeCompanyId={activeCompanyId}
          onReload={load}
        />
      )}
    </div>
  );
}
