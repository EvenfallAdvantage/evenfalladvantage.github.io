import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IncidentStatement = any;

/** Statements for an incident. Returns null when the table isn't there yet (migration not applied). */
export async function getIncidentStatements(incidentId: string): Promise<IncidentStatement[] | null> {
  const { data, error } = await createClient()
    .from("incident_statements")
    .select("*, users:taken_by(first_name, last_name)")
    .eq("incident_id", incidentId)
    .order("taken_at", { ascending: true });
  if (error) { if (error.code !== "42P01" && error.code !== "PGRST205") logDbReadError("incident statements", error); return null; }
  return data ?? [];
}

export async function createIncidentStatement(p: {
  incidentId: string; companyId: string; personRole: string; fullName: string;
  phone?: string; email?: string; address?: string; statement?: string; declined: boolean;
  signaturePng?: string | null; lat?: number | null; lng?: number | null;
}): Promise<IncidentStatement> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await createClient().from("incident_statements").insert({
    id: crypto.randomUUID(),
    incident_id: p.incidentId,
    company_id: p.companyId,
    person_role: p.personRole,
    full_name: p.fullName.trim(),
    phone: p.phone?.trim() || null,
    email: p.email?.trim() || null,
    address: p.address?.trim() || null,
    statement: p.declined ? (p.statement?.trim() || null) : p.statement?.trim() ?? null,
    declined: p.declined,
    taken_by: userId,
    taken_lat: p.lat ?? null,
    taken_lng: p.lng ?? null,
    signature_png: p.signaturePng ?? null,
    signed_at: p.signaturePng ? new Date().toISOString() : null, // server overwrites with its own time
  }).select().maybeSingle();
  if (error) throw error;
  return data;
}
