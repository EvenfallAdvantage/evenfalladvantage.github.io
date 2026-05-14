import { createClient } from "./client";

// ─── Types ───────────────────────────────────────────────

export const CANONICAL_INTAKE_FIELDS = [
  "client_name",
  "client_email",
  "client_phone",
  "service",
  "location",
  "message",
  "start_date",
  "end_date",
  "subject",
  "notes",
] as const;

export type CanonicalIntakeField = (typeof CANONICAL_INTAKE_FIELDS)[number];

export type IntakeFieldMapping = {
  id: string;
  company_id: string;
  source_field: string;
  canonical_field: CanonicalIntakeField;
  created_at: string;
};

export type CanonicalFieldMeta = {
  key: CanonicalIntakeField;
  label: string;
  example: string;
};

export const CANONICAL_FIELD_META: CanonicalFieldMeta[] = [
  { key: "client_name", label: "Client Name", example: "Jane Doe" },
  { key: "client_email", label: "Client Email", example: "jane@example.com" },
  { key: "client_phone", label: "Client Phone", example: "(555) 555-5555" },
  { key: "service", label: "Service Requested", example: "Event Security" },
  { key: "location", label: "Site Location", example: "123 Main St" },
  { key: "start_date", label: "Desired Start Date", example: "2026-06-01" },
  { key: "end_date", label: "End Date", example: "2026-06-02" },
  { key: "subject", label: "Subject / Title", example: "Festival security inquiry" },
  { key: "message", label: "Message / Description", example: "Need 6 guards for 8 hr event" },
  { key: "notes", label: "Internal Notes", example: "Referred by Acme Productions" },
];

/* ─── CRUD ────────────────────────────────────────────── */

export async function listMappings(companyId: string): Promise<IntakeFieldMapping[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("intake_field_mappings")
    .select("id, company_id, source_field, canonical_field, created_at")
    .eq("company_id", companyId)
    .order("source_field");
  if (error) throw error;
  return (data ?? []) as IntakeFieldMapping[];
}

export async function upsertMapping(params: {
  companyId: string;
  sourceField: string;
  canonicalField: CanonicalIntakeField;
}): Promise<IntakeFieldMapping> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("intake_field_mappings")
    .upsert(
      {
        company_id: params.companyId,
        source_field: params.sourceField.trim(),
        canonical_field: params.canonicalField,
      },
      { onConflict: "company_id,source_field" },
    )
    .select("id, company_id, source_field, canonical_field, created_at")
    .single();
  if (error || !data) throw error ?? new Error("Failed to save mapping");
  return data as IntakeFieldMapping;
}

export async function deleteMapping(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("intake_field_mappings").delete().eq("id", id);
  if (error) throw error;
}

/* ─── Preview helper (mirrors Edge Function logic) ───── */

/**
 * Pure-function preview of how a JSON payload would be mapped.
 * Used by the admin UI's "Test Payload" tool — must match
 * the Edge Function (`supabase/functions/intake-ingest/index.ts`).
 */
export function previewMapping(
  payload: Record<string, unknown>,
  mappings: { source_field: string; canonical_field: string }[],
): { canonical: Record<string, string>; extra: Record<string, unknown> } {
  const lookup = new Map<string, string>();
  for (const m of mappings) {
    lookup.set(m.source_field.toLowerCase().trim(), m.canonical_field);
  }

  const canonical: Record<string, string> = {};
  const extra: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(payload)) {
    const key = rawKey.toLowerCase().trim();
    const canonicalField = lookup.get(key);
    if (canonicalField && (CANONICAL_INTAKE_FIELDS as readonly string[]).includes(canonicalField)) {
      let str: string | null = null;
      if (typeof rawValue === "string") {
        const t = rawValue.trim();
        str = t.length > 0 ? t : null;
      } else if (typeof rawValue === "number" || typeof rawValue === "boolean") {
        str = String(rawValue);
      }
      if (str !== null) {
        canonical[canonicalField] = str;
        continue;
      }
    }
    extra[rawKey] = rawValue;
  }

  return { canonical, extra };
}
