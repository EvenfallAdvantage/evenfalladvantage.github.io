"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Users, AlertTriangle, ListChecks, ArrowRightLeft, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { getTeams, getAllTeamMetrics } from "@/lib/supabase/db";
import type { Team } from "@/lib/supabase/db-teams";
import type { TeamMetrics } from "@/lib/supabase/db-analytics";
import { ProgressBar } from "@/app/feed/components/shared";
import { logger } from "@/lib/logger";

export default function TeamsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canView = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [teams, setTeams] = useState<Team[]>([]);
  const [metrics, setMetrics] = useState<TeamMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [teamsData, metricsData] = await Promise.all([
        getTeams(activeCompanyId),
        getAllTeamMetrics(activeCompanyId),
      ]);
      setTeams(teamsData);
      setMetrics(metricsData);
    } catch (e) {
      logger.swallow("teams-page:load", e, "warn");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setHeader(
      "TEAMS",
      "Multi-team coordination and KPIs",
      <Users className="h-5 w-5" />,
      <Button onClick={refresh} disabled={refreshing} variant="outline" size="sm" className="gap-2">
        {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Refresh
      </Button>
    );
    return () => clearHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeader, clearHeader, refreshing]);

  const teamById = useMemo(() => {
    const m = new Map<string, Team>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        incidentsOpen: acc.incidentsOpen + m.incidentsOpen,
        incidentsOverdue: acc.incidentsOverdue + m.incidentsOverdue,
        tasksOpen: acc.tasksOpen + m.tasksOpen,
        tasksOverdue: acc.tasksOverdue + m.tasksOverdue,
        transfersIn: acc.transfersIn + m.recentTransfersIn,
      }),
      { incidentsOpen: 0, incidentsOverdue: 0, tasksOpen: 0, tasksOverdue: 0, transfersIn: 0 }
    );
  }, [metrics]);

  if (!canView) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Manager access required to view team dashboards.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <ListSkeleton rows={3} />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground space-y-3">
          <Users className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">No teams have been created yet.</p>
          <p className="text-xs">
            Create teams under{" "}
            <Link href="/admin/staff" className="text-primary underline">
              Personnel
            </Link>{" "}
            to start coordinating across squads.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Org-wide totals */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile label="Open Incidents" value={totals.incidentsOpen} tone="blue" icon={<AlertTriangle className="h-3.5 w-3.5" />} />
        <StatTile
          label="Incidents Overdue"
          value={totals.incidentsOverdue}
          tone={totals.incidentsOverdue > 0 ? "red" : "muted"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <StatTile label="Open Tasks" value={totals.tasksOpen} tone="indigo" icon={<ListChecks className="h-3.5 w-3.5" />} />
        <StatTile
          label="Tasks Overdue"
          value={totals.tasksOverdue}
          tone={totals.tasksOverdue > 0 ? "red" : "muted"}
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Transfers (7d)"
          value={totals.transfersIn}
          tone="purple"
          icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Per-team cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {metrics.map((m) => {
          const team = teamById.get(m.teamId);
          if (!team) return null;
          return <TeamCard key={team.id} team={team} metrics={m} />;
        })}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "blue" | "indigo" | "red" | "purple" | "muted";
  icon: React.ReactNode;
}) {
  const TONE: Record<typeof tone, string> = {
    blue: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    indigo: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
    red: "bg-red-500/10 text-red-700 border-red-500/30",
    purple: "bg-purple-500/10 text-purple-700 border-purple-500/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Card className={`border ${TONE[tone]}`}>
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70 flex items-center gap-1">
          {icon} {label}
        </div>
        <p className="text-2xl font-bold leading-tight mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function TeamCard({ team, metrics }: { team: Team; metrics: TeamMetrics }) {
  const incidentLoadPct = metrics.incidentsTotal > 0 ? Math.round((metrics.incidentsOpen / metrics.incidentsTotal) * 100) : 0;
  const taskLoadPct = metrics.tasksTotal > 0 ? Math.round((metrics.tasksOpen / metrics.tasksTotal) * 100) : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: team.color }}
            aria-hidden="true"
          />
          {team.name}
          {team.isArchived && (
            <Badge variant="outline" className="text-[10px]">Archived</Badge>
          )}
        </CardTitle>
        {team.description && (
          <p className="text-xs text-muted-foreground">{team.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Incidents */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Incidents
            </span>
            <span className="text-muted-foreground">
              {metrics.incidentsOpen} open / {metrics.incidentsTotal} total
            </span>
          </div>
          <ProgressBar value={metrics.incidentsOpen} max={Math.max(1, metrics.incidentsTotal)} color="rgb(59 130 246)" />
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
            <span>{incidentLoadPct}% open</span>
            {metrics.incidentsOverdue > 0 && (
              <span className="text-red-600">{metrics.incidentsOverdue} overdue</span>
            )}
          </div>
        </div>

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold flex items-center gap-1">
              <ListChecks className="h-3 w-3" /> Tasks
            </span>
            <span className="text-muted-foreground">
              {metrics.tasksOpen} open / {metrics.tasksTotal} total
            </span>
          </div>
          <ProgressBar value={metrics.tasksOpen} max={Math.max(1, metrics.tasksTotal)} color="rgb(99 102 241)" />
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
            <span>{taskLoadPct}% open</span>
            {metrics.tasksOverdue > 0 && (
              <span className="text-red-600">{metrics.tasksOverdue} overdue</span>
            )}
          </div>
        </div>

        {/* Transfers */}
        <div className="flex items-center gap-2 text-xs pt-2 border-t border-border/40">
          <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Last 7d transfers in:</span>
          <span className="font-semibold">{metrics.recentTransfersIn}</span>
        </div>

        {/* Quick links */}
        <div className="flex gap-2 pt-1">
          <Link href={`/incidents?team=${team.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs h-7">
              View Incidents
            </Button>
          </Link>
          <Link href={`/tasks?team=${team.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full text-xs h-7">
              View Tasks
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
