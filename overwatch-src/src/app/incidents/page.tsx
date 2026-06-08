"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { useCompanyQuery } from "@/hooks/use-company-query";
import { usePageHeader } from "@/stores/page-header-store";
import { useActiveTeam } from "@/hooks/use-active-team";

import { IncidentCreateForm } from "./components/incident-create-form";
import { IncidentFilters } from "./components/incident-filters";
import { IncidentList } from "./components/incident-list";
import { IncidentBoard } from "./components/incident-board";
import type { Incident, Member } from "./components/constants";

export default function IncidentsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore(s => s.getActiveCompany());
  const isAdmin = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  const searchParams = useSearchParams();
  const [persistedTeam, setPersistedTeam] = useActiveTeam(activeCompanyId);
  const urlTeam = searchParams.get("team");
  const initialBoardTeam = urlTeam ?? persistedTeam ?? "all";

  // If URL has ?team, sync it to localStorage
  useEffect(() => {
    if (urlTeam) {
      setPersistedTeam(urlTeam);
      setViewMode("board");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTeam]);

  const { data: incidents = [], isLoading: incLoading, refetch: refetchIncidents } = useCompanyQuery<Incident[]>(
    "incidents", (cid) => getIncidents(cid, filter), { extraKeys: [filter] }
  );
  const { data: members = [], isLoading: memLoading, refetch: refetchMembers } = useCompanyQuery<Member[]>(
    "company-members", (cid) => getCompanyMembers(cid)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeTimesheet = null, refetch: refetchTimesheet } = useQuery<any>({
    queryKey: ["active-timesheet", activeCompanyId ?? ""],
    queryFn: () => getActiveTimesheet(),
    enabled: !!activeCompanyId,
  });
  const loading = incLoading || memLoading;
  const load = async () => {
    await Promise.all([refetchIncidents(), refetchMembers(), refetchTimesheet()]);
  };

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader(
      "REPORTS",
      "Incident reports and field documentation",
      <AlertTriangle className="h-5 w-5" />,
      <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Report Incident
      </Button>
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, showCreate]);

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
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full scrollbar-hide">
        <Link
          href="/dictate"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors whitespace-nowrap shrink-0"
        >
          Dictate
        </Link>
        <Link
          href="/forms"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors whitespace-nowrap shrink-0"
        >
          Field Reports
        </Link>
        <div className="flex items-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm whitespace-nowrap shrink-0">
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

      {/* View mode toggle (managers only) */}
      {isAdmin && (
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              viewMode === "board" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live Board
          </button>
        </div>
      )}

      {viewMode === "board" && isAdmin && activeCompanyId ? (
        <IncidentBoard
          activeCompanyId={activeCompanyId}
          initialTeamFilter={initialBoardTeam}
          onTeamFilterChange={(teamId) => setPersistedTeam(teamId === "all" ? null : teamId)}
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
