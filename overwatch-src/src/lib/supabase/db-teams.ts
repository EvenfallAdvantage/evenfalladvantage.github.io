/**
 * Teams System
 *
 * Multi-team coordination within a company (HaloFusion).
 * Teams can be assigned incidents and tasks, have custom dashboards,
 * and support multi-agency operations.
 *
 * Tables: teams, team_members (created via SQL migration)
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

export interface Team {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  isArchived: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: "lead" | "member";
  createdAt: string;
}

// ─── CRUD ─────────────────────────────────────────────────

/**
 * Get all teams for a company.
 */
export async function getTeams(companyId: string): Promise<Team[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) { logDbReadError("teams", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((t: any) => ({
    id: t.id,
    companyId: t.company_id,
    name: t.name,
    description: t.description,
    color: t.color,
    icon: t.icon,
    isArchived: t.is_archived,
    createdById: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

/**
 * Get a single team by ID.
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .maybeSingle();

  if (error) { logDbReadError("team details", error); return null; }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    isArchived: data.is_archived,
    createdById: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create a new team.
 */
export async function createTeam(
  companyId: string,
  params: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
  }
): Promise<string | null> {
  const userId = await (await import("./db-helpers")).ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const id = crypto.randomUUID();

  const { error } = await supabase
    .from("teams")
    .insert({
      id,
      company_id: companyId,
      name: params.name,
      description: params.description ?? null,
      color: params.color ?? "#6366f1",
      icon: params.icon ?? null,
      created_by: userId,
      ...ts(),
    });

  if (error) {
    console.error("[Teams] Create failed:", error.message);
    return null;
  }
  return id;
}

/**
 * Update a team.
 */
export async function updateTeam(
  teamId: string,
  updates: Partial<{ name: string; description: string; color: string; icon: string; isArchived: boolean }>
): Promise<Team | null> {
  const supabase = createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) update.name = updates.name;
  if (updates.description !== undefined) update.description = updates.description;
  if (updates.color !== undefined) update.color = updates.color;
  if (updates.icon !== undefined) update.icon = updates.icon;
  if (updates.isArchived !== undefined) update.is_archived = updates.isArchived;

  const { data, error } = await supabase
    .from("teams")
    .update(update)
    .eq("id", teamId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[Teams] Update failed:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    description: data.description,
    color: data.color,
    icon: data.icon,
    isArchived: data.is_archived,
    createdById: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Archive a team.
 */
export async function archiveTeam(teamId: string): Promise<boolean> {
  return updateTeam(teamId, { isArchived: true }) !== null;
}

/**
 * Delete a team (only if empty).
 */
export async function deleteTeam(teamId: string): Promise<boolean> {
  const supabase = createClient();
  // Check if team has members first
  const { data: members } = await supabase
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .limit(1);

  if (members && members.length > 0) {
    console.error("[Teams] Cannot delete team with members");
    return false;
  }

  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  return !error;
}

// ─── Team Members ─────────────────────────────────────────

/**
 * Get all members of a team.
 */
export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) { logDbReadError("team members", error); return []; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((tm: any) => ({
    id: tm.id,
    teamId: tm.team_id,
    userId: tm.user_id,
    role: tm.role as "lead" | "member",
    createdAt: tm.created_at,
  }));
}

/**
 * Add a user to a team.
 */
export async function addTeamMember(
  teamId: string,
  userId: string,
  role: "lead" | "member" = "member"
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();

  const { error } = await supabase
    .from("team_members")
    .insert({
      id,
      team_id: teamId,
      user_id: userId,
      role,
      ...ts(),
    });

  if (error) {
    console.error("[Teams] Add member failed:", error.message);
    return null;
  }
  return id;
}

/**
 * Remove a user from a team.
 */
export async function removeTeamMember(teamId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  return !error;
}

/**
 * Get all teams a user belongs to.
 */
export async function getUserTeams(companyId: string, userId: string): Promise<Team[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);

  if (error) { logDbReadError("user teams", error); return []; }

  if (!data || data.length === 0) return [];

  const teamIds = data.map((tm: { team_id: string }) => tm.team_id);
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("*")
    .in("id", teamIds)
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (teamsError) { logDbReadError("user teams details", teamsError); return []; }

  return (teams ?? []).map((t: {
    id: string;
    company_id: string;
    name: string;
    description: string | null;
    color: string;
    icon: string | null;
    is_archived: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }) => ({
    id: t.id,
    companyId: t.company_id,
    name: t.name,
    description: t.description,
    color: t.color,
    icon: t.icon,
    isArchived: t.is_archived,
    createdById: t.created_by,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}
