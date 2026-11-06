/**
 * Airtable applicant review. OAuth tokens stay on the server.
 * preview is read-only. import runs only after the user confirms, and the
 * server dedupes by company + Airtable record id.
 */
import { runIntegrationAction } from "@/lib/supabase/db-integrations";

export interface AirtablePreviewRecord {
  airtableId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface AirtablePreview {
  records: AirtablePreviewRecord[];
  truncated: boolean;
}

export interface AirtableImportResult {
  imported: { airtableId: string; email: string; applicantId: string }[];
  alreadyImported: { airtableId: string; email: string; applicantId: string }[];
  emailConflicts: { airtableId: string; email: string; existingApplicantId: string | null }[];
  skipped: { airtableId: string; reason: string }[];
}

interface ActionBody<T> {
  ok?: boolean;
  error?: string;
  result?: T & { ok?: boolean; error?: string };
}

function unwrap<T>(body: ActionBody<T>): T {
  const result = body.result;
  if (!result || result.ok === false) throw new Error(result?.error ?? body.error ?? "Airtable request failed");
  return result;
}

export async function listAirtableBases(companyId: string): Promise<{ id: string; name: string }[]> {
  const body = await runIntegrationAction<{ ok: boolean; bases: { id: string; name: string }[]; error?: string }>(companyId, "airtable", "list_bases");
  return unwrap(body).bases ?? [];
}

export async function listAirtableTables(companyId: string, baseId: string): Promise<{ id: string; name: string }[]> {
  const body = await runIntegrationAction<{ ok: boolean; tables: { id: string; name: string }[]; error?: string }>(companyId, "airtable", "list_tables", { base_id: baseId });
  return unwrap(body).tables ?? [];
}

export async function previewAirtableApplicants(companyId: string): Promise<AirtablePreview> {
  const body = await runIntegrationAction<{ ok: boolean; records: AirtablePreviewRecord[]; truncated: boolean; error?: string }>(companyId, "airtable", "preview_records");
  const result = unwrap(body);
  return { records: result.records ?? [], truncated: Boolean(result.truncated) };
}

export async function importReviewedAirtableApplicants(companyId: string, recordIds: string[]): Promise<AirtableImportResult> {
  const body = await runIntegrationAction<AirtableImportResult & { ok: boolean; error?: string }>(companyId, "airtable", "import_applicants", { record_ids: recordIds });
  const result = unwrap(body);
  return {
    imported: result.imported ?? [],
    alreadyImported: result.alreadyImported ?? [],
    emailConflicts: result.emailConflicts ?? [],
    skipped: result.skipped ?? [],
  };
}
