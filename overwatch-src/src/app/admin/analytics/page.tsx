"use client";

/**
 * /admin/analytics - HaloInsights parity dashboard.
 *
 * Manager+ gated. Three view tabs: Incidents, Tasks, Combined.
 * Each shows KPI tiles, time-series chart, distribution charts, and a
 * drill-down table for a clicked segment. Filter bar persists across tabs.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  AlertTriangle,
  ListChecks,
  Layers,
  Loader2,
  Download,
  FileDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  getIncidentAnalytics,
  getTaskAnalytics,
  getMultiLogReport,
  getIncidentsForSegment,
  getTasksForSegment,
  getTeams,
  type IncidentAnalytics,
  type TaskAnalytics,
  type MultiLogReport,
} from "@/lib/supabase/db";
import type { Team } from "@/lib/supabase/db-teams";
import { FilterBar, type FilterBarValue } from "@/components/work/filter-bar";
import { LineChart, StackedBarChart, GroupedBarChart, HeatCalendar, Sparkline } from "@/components/charts";
import { exportCSV, INCIDENT_COLUMNS } from "@/lib/csv-export";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { generateAnalyticsPDF } from "./components/analytics-pdf";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "todo", label: "Todo" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#eab308",
  low: "#3b82f6",
  unknown: "#94a3b8",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  in_progress: "#0ea5e9",
  investigating: "#a855f7",
  resolved: "#22c55e",
  closed: "#64748b",
  todo: "#94a3b8",
  blocked: "#f59e0b",
  done: "#22c55e",
  cancelled: "#94a3b8",
  unknown: "#9ca3af",
};

type Tab = "incidents" | "tasks" | "combined";

function defaultRange(): FilterBarValue {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    teamId: "",
    status: "",
    priority: "",
    type: "",
    search: "",
  };
}

export default function AnalyticsPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const canView = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [tab, setTab] = useState<Tab>("incidents");
  const [filters, setFilters] = useState<FilterBarValue>(defaultRange());

  const [teams, setTeams] = useState<Team[]>([]);
  const [incAnalytics, setIncAnalytics] = useState<IncidentAnalytics | null>(null);
  const [tskAnalytics, setTskAnalytics] = useState<TaskAnalytics | null>(null);
  const [multiLog, setMultiLog] = useState<MultiLogReport | null>(null);
  const [loading, setLoading] = useState(true);

  const [drillSegment, setDrillSegment] = useState<{ kind: "incident" | "task"; key: string; value: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const rangeToIso = useCallback(() => {
    const from = `${filters.from}T00:00:00.000Z`;
    const to = `${filters.to}T23:59:59.999Z`;
    return { from, to };
  }, [filters.from, filters.to]);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    const { from, to } = rangeToIso();
    const opts = {
      from,
      to,
      teamId: filters.teamId || undefined,
    };
    try {
      const [t, ia, ta, ml] = await Promise.all([
        getTeams(activeCompanyId),
        getIncidentAnalytics(activeCompanyId, opts),
        getTaskAnalytics(activeCompanyId, opts),
        getMultiLogReport(activeCompanyId, { from, to, teamId: filters.teamId || undefined }),
      ]);
      setTeams(t);
      setIncAnalytics(ia);
      setTskAnalytics(ta);
      setMultiLog(ml);
    } catch (e) {
      logger.swallow("analytics:load", e, "warn");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, filters.teamId, rangeToIso]);

  useEffect(() => { void load(); }, [load]);

  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportPdf() {
    if (!incAnalytics || !tskAnalytics) {
      toast.error("Wait for data to finish loading");
      return;
    }
    if (!activeCompany) {
      toast.error("Active company required");
      return;
    }
    setExportingPdf(true);
    try {
      await generateAnalyticsPDF({
        range: { from: filters.from, to: filters.to },
        companyName: activeCompany.companyName,
        brandHex: activeCompany.brandColor || "#1d3451",
        companyLogo: activeCompany.companyLogo,
        incidents: incAnalytics,
        tasks: tskAnalytics,
        combined: multiLog,
        teamNameById,
      });
    } catch (e) {
      logger.swallow("analytics:pdf", e, "warn");
      toast.error("PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    setHeader(
      "ANALYTICS",
      "Cross-domain operational metrics",
      <BarChart3 className="h-5 w-5" />,
      <div className="flex items-center gap-2">
        <Button onClick={handleExportPdf} disabled={exportingPdf || loading} variant="outline" size="sm" className="gap-2">
          {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
          Export PDF
        </Button>
        <Button onClick={load} variant="outline" size="sm" className="gap-2">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
    );
    return () => clearHeader();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeader, clearHeader, load, loading, exportingPdf, incAnalytics, tskAnalytics, multiLog]);

  // Time series for the active tab.
  const timeSeries = useMemo(() => {
    const days: string[] = [];
    const from = new Date(filters.from);
    const to = new Date(filters.to);
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [filters.from, filters.to]);

  const incidentSeries = useMemo(() => {
    if (!incAnalytics) return [];
    return timeSeries.map((d) => incAnalytics.byDay[d] ?? 0);
  }, [incAnalytics, timeSeries]);

  const taskSeries = useMemo(() => {
    if (!tskAnalytics) return [];
    return timeSeries.map((d) => tskAnalytics.byDay[d] ?? 0);
  }, [tskAnalytics, timeSeries]);

  const teamNameById = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  async function handleSegmentClick(kind: "incident" | "task", key: string, value: string) {
    setDrillSegment({ kind, key, value });
    setDrillLoading(true);
    const { from, to } = rangeToIso();
    try {
      if (kind === "incident") {
        const seg: Record<string, string | undefined> = {
          from,
          to,
          teamId: filters.teamId || undefined,
        };
        seg[key] = value;
        const rows = await getIncidentsForSegment(activeCompanyId ?? "", seg as Parameters<typeof getIncidentsForSegment>[1]);
        setDrillRows(rows);
      } else {
        const seg: Record<string, string | undefined> = {
          from,
          to,
          teamId: filters.teamId || undefined,
        };
        seg[key] = value;
        const rows = await getTasksForSegment(activeCompanyId ?? "", seg as Parameters<typeof getTasksForSegment>[1]);
        setDrillRows(rows);
      }
    } catch (e) {
      logger.swallow("analytics:drill", e, "warn");
    } finally {
      setDrillLoading(false);
    }
  }

  function handleExportCsv() {
    if (drillRows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    if (drillSegment?.kind === "incident") {
      exportCSV(drillRows as Record<string, unknown>[], INCIDENT_COLUMNS, "incident-analytics");
    } else {
      exportCSV(
        drillRows as Record<string, unknown>[],
        [
          { key: "title", label: "Title" },
          { key: "status", label: "Status" },
          { key: "priority", label: "Priority" },
          { key: "team_id", label: "Team ID" },
          { key: "assigned_to", label: "Assignee" },
          { key: "due_at", label: "Due" },
          { key: "completed_at", label: "Completed" },
          { key: "created_at", label: "Created" },
        ],
        "task-analytics",
      );
    }
  }

  if (!canView) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Manager access required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterBar
        value={filters}
        onChange={setFilters}
        teams={teams}
        statuses={STATUS_OPTIONS}
        onReset={() => setFilters(defaultRange())}
      />

      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {(
          [
            { key: "incidents" as Tab, label: "Incidents", icon: AlertTriangle },
            { key: "tasks" as Tab, label: "Tasks", icon: ListChecks },
            { key: "combined" as Tab, label: "Combined", icon: Layers },
          ]
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setDrillSegment(null); setDrillRows([]); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "incidents" && incAnalytics ? (
        <IncidentsView
          analytics={incAnalytics}
          series={incidentSeries}
          timeLabels={timeSeries}
          teamNameById={teamNameById}
          onSegmentClick={(k, v) => handleSegmentClick("incident", k, v)}
        />
      ) : tab === "tasks" && tskAnalytics ? (
        <TasksView
          analytics={tskAnalytics}
          series={taskSeries}
          timeLabels={timeSeries}
          teamNameById={teamNameById}
          onSegmentClick={(k, v) => handleSegmentClick("task", k, v)}
        />
      ) : tab === "combined" && multiLog ? (
        <CombinedView report={multiLog} timeLabels={timeSeries} />
      ) : null}

      {drillSegment && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Drill-down: {drillSegment.kind} where {drillSegment.key} = {drillSegment.value}
                <Badge variant="outline" className="text-[10px]">{drillRows.length} rows</Badge>
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv} disabled={drillRows.length === 0}>
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setDrillSegment(null); setDrillRows([]); }}>
                  Close
                </Button>
              </div>
            </div>
            {drillLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto my-4" />
            ) : drillRows.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-4 text-center">No rows match this segment.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1.5 px-2">Title</th>
                      <th className="text-left py-1.5 px-2">Status</th>
                      <th className="text-left py-1.5 px-2">Team</th>
                      <th className="text-right py-1.5 px-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillRows.map((r) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="py-1.5 px-2 truncate max-w-[280px]">{r.title}</td>
                        <td className="py-1.5 px-2">{r.status}</td>
                        <td className="py-1.5 px-2">{teamNameById.get(r.team_id) ?? "-"}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-[10px]">
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2">
        <FileDown className="h-3 w-3" />
        Drill down by clicking any segment to load matching rows and export.
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, sparkData }: { label: string; value: number | string; sub?: string; sparkData?: number[] }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sparkData && sparkData.length > 0 && <Sparkline data={sparkData} color="#6366f1" />}
        </div>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function IncidentsView({
  analytics,
  series,
  timeLabels,
  teamNameById,
  onSegmentClick,
}: {
  analytics: IncidentAnalytics;
  series: number[];
  timeLabels: string[];
  teamNameById: Map<string, string>;
  onSegmentClick: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total" value={analytics.totalCount} sparkData={series} />
        <StatTile label="Open" value={analytics.openCount} />
        <StatTile label="Resolved" value={analytics.resolvedCount} />
        <StatTile
          label="Resolution rate"
          value={`${analytics.totalCount > 0 ? Math.round((analytics.resolvedCount / analytics.totalCount) * 100) : 0}%`}
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Incidents over time
          </h3>
          <LineChart
            data={series}
            color="#3b82f6"
            showDots
            smoothing={1}
            height={120}
            labels={series.length > 0 ? [timeLabels[0], timeLabels[timeLabels.length - 1]] : undefined}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By severity</h3>
            <ul className="space-y-1 text-xs">
              {analytics.bySeverity.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSegmentClick("severity", s.key)}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: SEVERITY_COLORS[s.key] ?? "#9ca3af" }}
                      />
                      {s.key}
                    </span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By status</h3>
            <ul className="space-y-1 text-xs">
              {analytics.byStatus.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSegmentClick("status", s.key)}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ backgroundColor: STATUS_COLORS[s.key] ?? "#9ca3af" }}
                      />
                      {s.key}
                    </span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By type</h3>
            <ul className="space-y-1 text-xs max-h-44 overflow-y-auto">
              {analytics.byType.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSegmentClick("type", s.key)}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30"
                  >
                    <span>{s.key.replace(/_/g, " ")}</span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By team</h3>
            <ul className="space-y-1 text-xs">
              {analytics.byTeam.map((s) => {
                const name = s.teamId ? teamNameById.get(s.teamId) ?? s.teamId.slice(0, 8) : "Unassigned";
                return (
                  <li key={s.teamId ?? "none"}>
                    <button
                      type="button"
                      onClick={() => s.teamId && onSegmentClick("teamId", s.teamId)}
                      className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30 disabled:cursor-default"
                      disabled={!s.teamId}
                    >
                      <span>{name}</span>
                      <span className="font-mono text-muted-foreground">{s.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2">Activity heat (last 12 weeks)</h3>
          <HeatCalendar counts={analytics.byDay} color="#3b82f6" />
        </CardContent>
      </Card>
    </div>
  );
}

function TasksView({
  analytics,
  series,
  timeLabels,
  teamNameById,
  onSegmentClick,
}: {
  analytics: TaskAnalytics;
  series: number[];
  timeLabels: string[];
  teamNameById: Map<string, string>;
  onSegmentClick: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total" value={analytics.totalCount} sparkData={series} />
        <StatTile label="Open" value={analytics.openCount} />
        <StatTile label="Done" value={analytics.doneCount} sub={`${analytics.completionRatePct}% completion`} />
        <StatTile label="Overdue" value={analytics.overdueCount} sub="status not done and due_at in past" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" /> Tasks over time
          </h3>
          <LineChart
            data={series}
            color="#6366f1"
            showDots
            smoothing={1}
            height={120}
            labels={series.length > 0 ? [timeLabels[0], timeLabels[timeLabels.length - 1]] : undefined}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By status</h3>
            <ul className="space-y-1 text-xs">
              {analytics.byStatus.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSegmentClick("status", s.key)}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30"
                  >
                    <span>{s.key.replace(/_/g, " ")}</span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By priority</h3>
            <ul className="space-y-1 text-xs">
              {analytics.byPriority.map((s) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => onSegmentClick("priority", s.key)}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30"
                  >
                    <span>{s.key}</span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By team</h3>
            <ul className="space-y-1 text-xs">
              {analytics.byTeam.map((s) => {
                const name = s.teamId ? teamNameById.get(s.teamId) ?? s.teamId.slice(0, 8) : "Unassigned";
                return (
                  <li key={s.teamId ?? "none"}>
                    <button
                      type="button"
                      onClick={() => s.teamId && onSegmentClick("teamId", s.teamId)}
                      disabled={!s.teamId}
                      className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30 disabled:cursor-default"
                    >
                      <span>{name}</span>
                      <span className="font-mono text-muted-foreground">{s.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-2">By assignee (top)</h3>
            <ul className="space-y-1 text-xs max-h-44 overflow-y-auto">
              {analytics.byAssignee.slice(0, 12).map((s) => (
                <li key={s.assigneeId ?? "none"}>
                  <button
                    type="button"
                    onClick={() => s.assigneeId && onSegmentClick("assigneeId", s.assigneeId)}
                    disabled={!s.assigneeId}
                    className="w-full flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted/30 disabled:cursor-default"
                  >
                    <span className="font-mono text-[10px]">
                      {s.assigneeId ? s.assigneeId.slice(0, 8) : "Unassigned"}
                    </span>
                    <span className="font-mono text-muted-foreground">{s.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CombinedView({ report, timeLabels }: { report: MultiLogReport; timeLabels: string[] }) {
  const incidents = timeLabels.map((d) => report.byDay[d]?.incidents ?? 0);
  const tasks = timeLabels.map((d) => report.byDay[d]?.tasks ?? 0);
  const patrols = timeLabels.map((d) => report.byDay[d]?.patrols ?? 0);
  const timesheets = timeLabels.map((d) => report.byDay[d]?.timesheets ?? 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Incidents" value={report.incidentsCount} sparkData={incidents} />
        <StatTile label="Tasks" value={report.tasksCount} sparkData={tasks} />
        <StatTile label="Patrols" value={report.patrolsCount} sparkData={patrols} />
        <StatTile label="Timesheets" value={report.timesheetsCount} sparkData={timesheets} />
      </div>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" /> Daily activity (stacked)
          </h3>
          <StackedBarChart
            buckets={timeLabels.length > 14 ? timeLabels.filter((_, i) => i % Math.ceil(timeLabels.length / 14) === 0) : timeLabels}
            series={[
              { name: "Incidents", color: "#3b82f6", values: incidents },
              { name: "Tasks", color: "#6366f1", values: tasks },
              { name: "Patrols", color: "#22c55e", values: patrols },
              { name: "Timesheets", color: "#eab308", values: timesheets },
            ]}
            height={160}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-2">Day-by-day comparison</h3>
          <GroupedBarChart
            buckets={timeLabels.length > 14 ? timeLabels.filter((_, i) => i % Math.ceil(timeLabels.length / 14) === 0) : timeLabels}
            series={[
              { name: "Incidents", color: "#3b82f6", values: incidents },
              { name: "Tasks", color: "#6366f1", values: tasks },
            ]}
            height={140}
          />
        </CardContent>
      </Card>
    </div>
  );
}
