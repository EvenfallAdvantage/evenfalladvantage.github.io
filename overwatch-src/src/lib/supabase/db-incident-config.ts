/**
 * Incident Configuration Service Layer
 *
 * Per-company incident type/status/field definitions.
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Types ─────────────────────────────────────────────────

export interface IncidentType {
  id: string;
  companyId: string;
  key: string;
  label: string;
  color: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentStatus {
  id: string;
  companyId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  isTerminal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentField {
  id: string;
  companyId: string;
  incidentTypeKey: string | null;
  fieldKey: string;
  label: string;
  fieldType: "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea";
  options: Record<string, unknown>;
  required: boolean;
  sortOrder: number;
  conditionalOn: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Incident Types ───────────────────────────────────────

export async function getIncidentTypes(companyId: string, activeOnly = false): Promise<IncidentType[]> {
  const supabase = createClient();
  let q = supabase
    .from("incident_type_defs")
    .select("*")
    .eq("company_id", companyId);
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q.order("sort_order", { ascending: true });

  if (error) { logDbReadError("incident types", error); return []; }

  return (data ?? []).map((t: {
    id: string;
    company_id: string;
    key: string;
    label: string;
    color: string;
    icon: string | null;
    sort_order: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }) => ({
    id: t.id,
    companyId: t.company_id,
    key: t.key,
    label: t.label,
    color: t.color,
    icon: t.icon,
    sortOrder: t.sort_order,
    isActive: t.is_active,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }));
}

export async function getIncidentType(companyId: string, key: string): Promise<IncidentType | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incident_type_defs")
    .select("*")
    .eq("company_id", companyId)
    .eq("key", key)
    .maybeSingle();

  if (error) { logDbReadError("incident type", error); return null; }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    key: data.key,
    label: data.label,
    color: data.color,
    icon: data.icon,
    sortOrder: data.sort_order,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createIncidentType(
  companyId: string,
  params: {
    key: string;
    label: string;
    color?: string;
    icon?: string;
    sortOrder?: number;
    isActive?: boolean;
  }
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();

  const { error } = await supabase.from("incident_type_defs").insert({
    id,
    company_id: companyId,
    key: params.key,
    label: params.label,
    color: params.color ?? "#6366f1",
    icon: params.icon ?? null,
    sort_order: params.sortOrder ?? 0,
    is_active: params.isActive ?? true,
    ...ts(),
  });

  if (error) {
    console.error("[Incident Types] Create failed:", error.message);
    return null;
  }
  return id;
}

export async function updateIncidentType(
  id: string,
  updates: Partial<{ label: string; color: string; icon: string; sortOrder: number; isActive: boolean }>
): Promise<IncidentType | null> {
  const supabase = createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.label !== undefined) update.label = updates.label;
  if (updates.color !== undefined) update.color = updates.color;
  if (updates.icon !== undefined) update.icon = updates.icon;
  if (updates.sortOrder !== undefined) update.sort_order = updates.sortOrder;
  if (updates.isActive !== undefined) update.is_active = updates.isActive;

  const { data, error } = await supabase
    .from("incident_type_defs")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[Incident Types] Update failed:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    key: data.key,
    label: data.label,
    color: data.color,
    icon: data.icon,
    sortOrder: data.sort_order,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteIncidentType(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("incident_type_defs").delete().eq("id", id);
  return !error;
}

// ─── Incident Statuses ─────────────────────────────────────

export async function getIncidentStatuses(companyId: string): Promise<IncidentStatus[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incident_status_defs")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (error) { logDbReadError("incident statuses", error); return []; }

  return (data ?? []).map((s: {
    id: string;
    company_id: string;
    key: string;
    label: string;
    color: string;
    sort_order: number;
    is_terminal: boolean;
    created_at: string;
    updated_at: string;
  }) => ({
    id: s.id,
    companyId: s.company_id,
    key: s.key,
    label: s.label,
    color: s.color,
    sortOrder: s.sort_order,
    isTerminal: s.is_terminal,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }));
}

export async function getIncidentStatus(companyId: string, key: string): Promise<IncidentStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("incident_status_defs")
    .select("*")
    .eq("company_id", companyId)
    .eq("key", key)
    .maybeSingle();

  if (error) { logDbReadError("incident status", error); return null; }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    key: data.key,
    label: data.label,
    color: data.color,
    sortOrder: data.sort_order,
    isTerminal: data.is_terminal,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createIncidentStatus(
  companyId: string,
  params: {
    key: string;
    label: string;
    color?: string;
    sortOrder?: number;
    isTerminal?: boolean;
  }
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();

  const { error } = await supabase.from("incident_status_defs").insert({
    id,
    company_id: companyId,
    key: params.key,
    label: params.label,
    color: params.color ?? "#6366f1",
    sort_order: params.sortOrder ?? 0,
    is_terminal: params.isTerminal ?? false,
    ...ts(),
  });

  if (error) {
    console.error("[Incident Statuses] Create failed:", error.message);
    return null;
  }
  return id;
}

export async function updateIncidentStatus(
  id: string,
  updates: Partial<{ label: string; color: string; sortOrder: number; isTerminal: boolean }>
): Promise<IncidentStatus | null> {
  const supabase = createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.label !== undefined) update.label = updates.label;
  if (updates.color !== undefined) update.color = updates.color;
  if (updates.sortOrder !== undefined) update.sort_order = updates.sortOrder;
  if (updates.isTerminal !== undefined) update.is_terminal = updates.isTerminal;

  const { data, error } = await supabase
    .from("incident_status_defs")
    .update(update)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[Incident Statuses] Update failed:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    key: data.key,
    label: data.label,
    color: data.color,
    sortOrder: data.sort_order,
    isTerminal: data.is_terminal,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteIncidentStatus(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("incident_status_defs").delete().eq("id", id);
  return !error;
}

// ─── Incident Fields ───────────────────────────────────────

export async function getIncidentFields(companyId: string, typeKey?: string): Promise<IncidentField[]> {
  const supabase = createClient();
  let q = supabase
    .from("incident_field_defs")
    .select("*")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true });

  if (typeKey) {
    q = q.or(`incident_type_key.eq.${typeKey},incident_type_key.is.null`);
  }

  const { data, error } = await q;

  if (error) { logDbReadError("incident fields", error); return []; }

  return (data ?? []).map((f: {
    id: string;
    company_id: string;
    incident_type_key: string | null;
    field_key: string;
    label: string;
    field_type: string;
    options: Record<string, unknown>;
    required: boolean;
    sort_order: number;
    conditional_on: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
  }) => ({
    id: f.id,
    companyId: f.company_id,
    incidentTypeKey: f.incident_type_key,
    fieldKey: f.field_key,
    label: f.label,
    fieldType: f.field_type as "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea",
    options: f.options,
    required: f.required,
    sortOrder: f.sort_order,
    conditionalOn: f.conditional_on,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));
}

export async function createIncidentField(
  companyId: string,
  params: {
    incidentTypeKey?: string;
    fieldKey: string;
    label: string;
    fieldType: "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea";
    options?: Record<string, unknown>;
    required?: boolean;
    sortOrder?: number;
    conditionalOn?: Record<string, unknown>;
  }
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();

  const { error } = await supabase.from("incident_field_defs").insert({
    id,
    company_id: companyId,
    incident_type_key: params.incidentTypeKey ?? null,
    field_key: params.fieldKey,
    label: params.label,
    field_type: params.fieldType,
    options: params.options ?? {},
    required: params.required ?? false,
    sort_order: params.sortOrder ?? 0,
    conditional_on: params.conditionalOn ?? null,
    ...ts(),
  });

  if (error) {
    console.error("[Incident Fields] Create failed:", error.message);
    return null;
  }
  return id;
}

export async function updateIncidentField(
  fieldId: string,
  updates: Partial<{
    incidentTypeKey: string | null;
    label: string;
    fieldType: "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea";
    options: Record<string, unknown>;
    required: boolean;
    sortOrder: number;
    conditionalOn: Record<string, unknown> | null;
  }>
): Promise<IncidentField | null> {
  const supabase = createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.incidentTypeKey !== undefined) update.incident_type_key = updates.incidentTypeKey;
  if (updates.label !== undefined) update.label = updates.label;
  if (updates.fieldType !== undefined) update.field_type = updates.fieldType;
  if (updates.options !== undefined) update.options = updates.options;
  if (updates.required !== undefined) update.required = updates.required;
  if (updates.sortOrder !== undefined) update.sort_order = updates.sortOrder;
  if (updates.conditionalOn !== undefined) update.conditional_on = updates.conditionalOn;

  const { data, error } = await supabase
    .from("incident_field_defs")
    .update(update)
    .eq("id", fieldId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[Incident Fields] Update failed:", error.message);
    return null;
  }

  if (!data) return null;

  return {
    id: data.id,
    companyId: data.company_id,
    incidentTypeKey: data.incident_type_key,
    fieldKey: data.field_key,
    label: data.label,
    fieldType: data.field_type as "text" | "number" | "select" | "multiselect" | "date" | "checkbox" | "textarea",
    options: data.options,
    required: data.required,
    sortOrder: data.sort_order,
    conditionalOn: data.conditional_on,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function deleteIncidentField(fieldId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("incident_field_defs").delete().eq("id", fieldId);
  return !error;
}
