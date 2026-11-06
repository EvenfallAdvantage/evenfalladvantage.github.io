/**
 * Airtable applicant review. OAuth tokens stay on the server.
 * preview is read-only. import runs only after the user confirms, and the
 * server dedupes by company + Airtable record id.
 */
import { runIntegrationAction } from "@/lib/supabase/db-integrations";
import type { RosterDiagnosticReport } from "@/lib/integrations/airtable-sync";

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

export interface AirtableSchemaField {
  id: string;
  name: string;
  type: string;
  choices?: string[];
}

export interface AirtableFieldBinding {
  field_id: string;
  name: string;
  type: string;
}

export interface AirtableSyncPreview {
  canSync: boolean;
  savedMapping: boolean;
  truncated: boolean;
  counts: Record<string, number>;
  mappingProblems: { code?: string; destination?: string | null; message: string }[];
  valueProblems: { code?: string; message: string }[];
  unmappedFields: string[];
  rows: { airtableId: string; label: string; action: string }[];
  notes: string[];
  planToken?: string;
  removalHold?: string | null;
  pages?: number;
  report?: RosterDiagnosticReport;
  read?: {
    rawRead: number;
    seen: number;
    valid: number;
    invalidId: number;
    duplicateRecord: number;
    duplicateEmail: number;
    conflict: number;
    missingRequired: number;
    create: number;
    attach: number;
    link: number;
    update: number;
    unchanged: number;
    remove: number;
    held: number;
    protected: number;
    cap: number;
  };
}

export interface AirtableSyncResult {
  created: number;
  linked?: number;
  updated: number;
  conflicts: number;
  skipped: number;
  missing: number;
  removed?: number;
  attached?: number;
  held?: number;
  protected?: number;
  manual?: number;
  errors: { airtableId: string; message: string }[];
  failed?: { create: number; attach: number; link: number; update: number; remove: number };
  read?: AirtableSyncPreview["read"];
  pages?: number;
  report?: RosterDiagnosticReport;
}

export async function saveAirtableTable(
  companyId: string,
  purpose: "applicants" | "roster" | "events",
  input: { baseId: string; baseName: string; tableId: string; tableName: string },
): Promise<void> {
  const body = await runIntegrationAction<{ ok: boolean; error?: string }>(companyId, "airtable", "save_table", {
    purpose,
    base_id: input.baseId,
    base_name: input.baseName,
    table_id: input.tableId,
    table_name: input.tableName,
  });
  unwrap(body);
}

export async function describeAirtableTable(companyId: string, baseId: string, tableId: string): Promise<AirtableSchemaField[]> {
  const body = await runIntegrationAction<{ ok: boolean; fields: AirtableSchemaField[]; error?: string }>(companyId, "airtable", "table_schema", {
    base_id: baseId,
    table_id: tableId,
  });
  return unwrap(body).fields ?? [];
}

export async function getAirtableFieldMapping(
  companyId: string,
  purpose: "roster" | "events",
  baseId: string,
  tableId: string,
): Promise<{ mapping: Record<string, AirtableFieldBinding>; confirmedAt: string | null }> {
  const body = await runIntegrationAction<{ ok: boolean; mapping: Record<string, AirtableFieldBinding>; confirmed_at: string | null; error?: string }>(
    companyId,
    "airtable",
    "get_field_mapping",
    { purpose, base_id: baseId, table_id: tableId },
  );
  const result = unwrap(body);
  return { mapping: result.mapping ?? {}, confirmedAt: result.confirmed_at ?? null };
}

export async function saveAirtableFieldMapping(
  companyId: string,
  purpose: "roster" | "events",
  baseId: string,
  tableId: string,
  mapping: Record<string, AirtableFieldBinding>,
): Promise<AirtableSyncPreview & { confirmed_at?: string; mapping?: Record<string, AirtableFieldBinding> }> {
  const body = await runIntegrationAction<AirtableSyncPreview & { ok: boolean; confirmed_at?: string; mapping?: Record<string, AirtableFieldBinding>; error?: string }>(
    companyId,
    "airtable",
    "save_field_mapping",
    { purpose, base_id: baseId, table_id: tableId, mapping, confirm: true },
  );
  return unwrap(body);
}

export async function previewAirtableSync(
  companyId: string,
  purpose: "roster" | "events",
  mapping?: Record<string, AirtableFieldBinding>,
): Promise<AirtableSyncPreview> {
  const body = await runIntegrationAction<AirtableSyncPreview & { ok: boolean; error?: string }>(
    companyId,
    "airtable",
    purpose === "roster" ? "preview_roster" : "preview_events",
    mapping ? { mapping } : {},
  );
  const result = unwrap(body);
  return {
    canSync: Boolean(result.canSync),
    savedMapping: Boolean(result.savedMapping),
    truncated: Boolean(result.truncated),
    counts: result.counts ?? {},
    mappingProblems: result.mappingProblems ?? [],
    valueProblems: result.valueProblems ?? [],
    unmappedFields: result.unmappedFields ?? [],
    rows: result.rows ?? [],
    notes: result.notes ?? [],
    planToken: result.planToken,
    removalHold: result.removalHold ?? null,
    pages: result.pages,
    read: result.read,
    report: result.report,
  };
}

export async function syncAirtablePurpose(
  companyId: string,
  purpose: "roster" | "events",
  planToken?: string,
): Promise<AirtableSyncResult> {
  const body = await runIntegrationAction<AirtableSyncResult & { ok: boolean; error?: string }>(
    companyId,
    "airtable",
    purpose === "roster" ? "sync_roster" : "sync_events",
    purpose === "roster" ? { confirm: true, plan_token: planToken } : { confirm: true },
  );
  const result = unwrap(body);
  return {
    created: result.created ?? 0,
    linked: result.linked ?? 0,
    updated: result.updated ?? 0,
    attached: result.attached ?? 0,
    removed: result.removed ?? 0,
    held: result.held ?? 0,
    conflicts: result.conflicts ?? 0,
    skipped: result.skipped ?? 0,
    missing: result.missing ?? 0,
    protected: result.protected ?? 0,
    manual: result.manual ?? 0,
    errors: result.errors ?? [],
    failed: result.failed,
    read: result.read,
    pages: result.pages,
    report: result.report,
  };
}

export async function getAirtableRosterReport(companyId: string): Promise<RosterDiagnosticReport | null> {
  const body = await runIntegrationAction<{ ok: boolean; found?: boolean; report?: RosterDiagnosticReport; error?: string }>(
    companyId,
    "airtable",
    "roster_report",
    { limit: 400 },
  );
  const result = unwrap(body);
  return result.found && result.report ? result.report : null;
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
