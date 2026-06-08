"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Filter, CheckCircle2, Clock, User, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  getIncidentsByTeam,
  getIncidentsFiltered,
  setIncidentStatus,
  assignIncidentToTeam,
  getTeams,
  getIncidentStatuses,
} from "@/lib/supabase/db";
import type { Team } from "@/lib/supabase/db-teams";
import type { IncidentStatus } from "@/lib/supabase/db-incident-config";
import { createClient } from "@/lib/supabase/client";

interface Incident {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  incident_number?: string;
  created_at?: string;
  location?: string;
  reported_user?: Array<{ first_name?: string }>;
  team_id?: string;
}

interface IncidentBoardProps {
  activeCompanyId: string;
}

export function IncidentBoard({ activeCompanyId }: IncidentBoardProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [statuses, setStatuses] = useState<IncidentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [supabase] = useState(() => createClient());

  // Load static config (teams, statuses)
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [teamsData, statusesData] = await Promise.all([
          getTeams(activeCompanyId),
          getIncidentStatuses(activeCompanyId),
        ]);
        setTeams(teamsData);
        setStatuses(statusesData);
      } catch (e) {
        logger.swallow("incident-board:load-config", e, "warn");
      }
    };
    void loadConfig();
  }, [activeCompanyId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, string> = {};
      if (filterStatus !== "all") filters.status = filterStatus;
      if (filterTeam !== "all") filters.teamId = filterTeam;
      if (filterPriority !== "all") filters.priority = filterPriority;

      let data: Incident[];
      if (filterTeam !== "all") {
        data = (await getIncidentsByTeam(activeCompanyId, filterTeam)) as Incident[];
      } else {
        data = (await getIncidentsFiltered(activeCompanyId, filters)) as Incident[];
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        data = data.filter(
          (i) =>
            i.title?.toLowerCase().includes(term) ||
            i.incident_number?.toLowerCase().includes(term) ||
            i.description?.toLowerCase().includes(term)
        );
      }

      setIncidents(data);
    } catch (e) {
      logger.swallow("incident-board:load", e, "warn");
      toast.error("Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, filterStatus, filterTeam, filterPriority, searchTerm]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel(`incidents-board-${activeCompanyId}`);

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incidents", filter: `company_id=eq.${activeCompanyId}` },
        (payload: { new: Record<string, unknown> }) => {
          setIncidents((prev) => [payload.new as unknown as Incident, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "incidents", filter: `company_id=eq.${activeCompanyId}` },
        (payload: { new: Record<string, unknown> }) => {
          const next = payload.new as unknown as Incident;
          setIncidents((prev) => prev.map((i) => (i.id === next.id ? next : i)));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "incidents", filter: `company_id=eq.${activeCompanyId}` },
        (payload: { old: Record<string, unknown> }) => {
          const old = payload.old as unknown as Incident;
          setIncidents((prev) => prev.filter((i) => i.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, activeCompanyId]);

  const handleStatusChange = async (incidentId: string, newStatus: string | null) => {
    if (!newStatus) return;
    try {
      const result = await setIncidentStatus(incidentId, newStatus);
      if (result) {
        toast.success("Status updated");
        await load();
      } else {
        toast.error("Failed to update status");
      }
    } catch (e) {
      logger.swallow("incident-board:status-change", e, "warn");
      toast.error("Failed to update status");
    }
  };

  const handleTeamChange = async (incidentId: string, teamId: string | null) => {
    if (!teamId) return;
    try {
      const result = await assignIncidentToTeam(incidentId, teamId);
      if (result) {
        toast.success("Team assigned");
        await load();
      } else {
        toast.error("Failed to assign team");
      }
    } catch (e) {
      logger.swallow("incident-board:team-change", e, "warn");
      toast.error("Failed to assign team");
    }
  };

  const getStatusColor = (status: string) => {
    const found = statuses.find((s) => s.key === status);
    if (found?.color) {
      // Use inline-style hint for arbitrary hex colors
      return "";
    }
    const fallback: Record<string, string> = {
      open: "bg-blue-500/15 text-blue-700 border-blue-500/30",
      in_progress: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
      resolved: "bg-green-500/15 text-green-700 border-green-500/30",
      closed: "bg-gray-500/15 text-gray-700 border-gray-500/30",
    };
    return fallback[status] || "bg-muted text-muted-foreground";
  };

  const getStatusLabel = (statusKey: string) => {
    const found = statuses.find((s) => s.key === statusKey);
    return found?.label || statusKey || "unknown";
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "bg-blue-500/10 text-blue-700",
      medium: "bg-yellow-500/10 text-yellow-700",
      high: "bg-orange-500/10 text-orange-700",
      urgent: "bg-red-500/10 text-red-700",
    };
    return colors[priority] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Live Incident Board
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Live Incident Board
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary">
            {incidents.length} shown
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-status" className="text-xs font-medium">Status</Label>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v || "all")}>
              <SelectTrigger id="filter-status" className="w-32 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-team" className="text-xs font-medium">Team</Label>
            <Select value={filterTeam} onValueChange={(v) => setFilterTeam(v || "all")}>
              <SelectTrigger id="filter-team" className="w-32 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-priority" className="text-xs font-medium">Priority</Label>
            <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v || "all")}>
              <SelectTrigger id="filter-priority" className="w-32 h-8 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Input
              placeholder="Search incidents..."
              className="w-64 h-8 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={load}>
              <Filter className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {incidents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No incidents found</p>
            </div>
          ) : (
            incidents.map((incident) => {
              const statusKey = incident.status || "";
              const team = teams.find((t) => t.id === incident.team_id);
              return (
                <div key={incident.id} className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={getStatusColor(statusKey)}>
                          {getStatusLabel(statusKey)}
                        </Badge>
                        <Badge className={getPriorityColor(incident.priority || "")}>
                          {incident.priority || "medium"}
                        </Badge>
                        {incident.incident_number && (
                          <span className="text-xs text-muted-foreground">#{incident.incident_number}</span>
                        )}
                        {team && (
                          <Badge variant="outline" style={{ backgroundColor: `${team.color}20`, borderColor: team.color, color: team.color }}>
                            {team.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-base mb-1">{incident.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{incident.description}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-xs text-muted-foreground text-right">
                        {incident.created_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(incident.created_at).toLocaleDateString()}
                          </div>
                        )}
                        {incident.location && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {incident.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>Reported by: {incident.reported_user?.[0]?.first_name || "Unknown"}</span>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Select value={incident.team_id || ""} onValueChange={(v) => handleTeamChange(incident.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue placeholder="Assign team..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={statusKey} onValueChange={(v) => handleStatusChange(incident.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.id} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
