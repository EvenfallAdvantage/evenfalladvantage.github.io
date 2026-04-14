import { createClient } from "@/lib/supabase/client";
import { ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

export interface SiteAssessment {
  id: string;
  company_id: string;
  event_id: string | null;
  client_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  data: Record<string, unknown>;
  risk_score: number | null;
  risk_level: string | null;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Save or update a site assessment.
 */
export async function saveSiteAssessment(
  companyId: string,
  assessment: {
    id?: string;
    event_id?: string | null;
    client_name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    data: Record<string, unknown>;
    risk_score?: number;
    risk_level?: string;
    pdf_url?: string;
  }
): Promise<SiteAssessment> {
  const supabase = createClient();
  const userId = await ensureInternalUser();

  const record = {
    company_id: companyId,
    event_id: assessment.event_id ?? null,
    client_name: assessment.client_name ?? null,
    address: assessment.address ?? null,
    lat: assessment.lat ?? null,
    lng: assessment.lng ?? null,
    data: assessment.data,
    risk_score: assessment.risk_score ?? null,
    risk_level: assessment.risk_level ?? null,
    pdf_url: assessment.pdf_url ?? null,
    created_by: userId,
    updated_at: new Date().toISOString(),
  };

  if (assessment.id) {
    // Update existing
    const { data, error } = await supabase
      .from("site_assessments")
      .update(record)
      .eq("id", assessment.id)
      .select()
      .single();
    if (error) throw error;
    return data as SiteAssessment;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from("site_assessments")
      .insert(record)
      .select()
      .single();
    if (error) throw error;
    return data as SiteAssessment;
  }
}

/**
 * Get all site assessments for a company.
 */
export async function getCompanyAssessments(companyId: string): Promise<SiteAssessment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("site_assessments")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SiteAssessment[];
}

/**
 * Get a single assessment by ID.
 */
export async function getAssessment(id: string): Promise<SiteAssessment | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("site_assessments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as SiteAssessment | null;
}

/**
 * Get assessments not yet linked to an operation (for import picker).
 */
export async function getUnlinkedAssessments(companyId: string): Promise<SiteAssessment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("site_assessments")
    .select("*")
    .eq("company_id", companyId)
    .is("event_id", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SiteAssessment[];
}

/**
 * Link an assessment to an operation.
 */
export async function linkAssessmentToEvent(assessmentId: string, eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("site_assessments")
    .update({ event_id: eventId, updated_at: new Date().toISOString() })
    .eq("id", assessmentId);
  if (error) throw error;
}

/**
 * Get all assessments linked to a specific operation/event.
 */
export async function getAssessmentsByEventId(eventId: string): Promise<SiteAssessment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("site_assessments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) { logDbReadError("event assessments", error); return []; }
  return data ?? [];
}

/**
 * Remove the event link from an assessment.
 */
export async function unlinkAssessment(assessmentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("site_assessments")
    .update({ event_id: null, updated_at: new Date().toISOString() })
    .eq("id", assessmentId);
  if (error) throw error;
}

/**
 * Delete a site assessment.
 */
export async function deleteAssessment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("site_assessments")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
