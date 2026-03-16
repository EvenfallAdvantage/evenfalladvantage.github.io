/**
 * Airtable Sync Service
 *
 * Bidirectional sync of applicant/staff records between
 * Overwatch and an Airtable base.
 *
 * Uses the Airtable REST API with personal access token auth.
 * Docs: https://airtable.com/developers/web/api/introduction
 */

import { getActiveConfig, type ProviderKey } from "./integrations";

interface AirtableCfg {
  api_key: string;     // Personal Access Token (pat...)
  base_id: string;     // Base ID (app...)
  table_name: string;  // Table name or ID
}

const AT_API = "https://api.airtable.com/v0";

function atHeaders(cfg: AirtableCfg): Record<string, string> {
  return {
    "Authorization": `Bearer ${cfg.api_key}`,
    "Content-Type": "application/json",
  };
}

async function getAirtableConfig(companyId: string): Promise<AirtableCfg | null> {
  return getActiveConfig<AirtableCfg>(companyId, "airtable" as ProviderKey);
}

// ─── Read Records ─────────────────────────────────────────

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

/**
 * List records from the configured Airtable table.
 * Supports optional filterByFormula and maxRecords.
 */
export async function listRecords(
  companyId: string,
  opts?: { filter?: string; maxRecords?: number; sort?: { field: string; direction: "asc" | "desc" }[] }
): Promise<AirtableRecord[]> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) {
    console.warn("[Airtable] No active Airtable integration for company", companyId);
    return [];
  }

  const params = new URLSearchParams();
  if (opts?.filter) params.set("filterByFormula", opts.filter);
  if (opts?.maxRecords) params.set("maxRecords", String(opts.maxRecords));
  if (opts?.sort) {
    opts.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction);
    });
  }

  const url = `${AT_API}/${cfg.base_id}/${encodeURIComponent(cfg.table_name)}?${params.toString()}`;

  try {
    const all: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const pageUrl = offset ? `${url}&offset=${offset}` : url;
      const res = await fetch(pageUrl, { headers: atHeaders(cfg) });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[Airtable] List failed (${res.status}):`, err);
        return all;
      }
      const data = await res.json();
      all.push(...(data.records || []));
      offset = data.offset;
    } while (offset && all.length < (opts?.maxRecords ?? 1000));

    return all;
  } catch (err) {
    console.error("[Airtable] Network error:", err);
    return [];
  }
}

/**
 * Get a single record by ID.
 */
export async function getRecord(companyId: string, recordId: string): Promise<AirtableRecord | null> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) return null;

  try {
    const res = await fetch(
      `${AT_API}/${cfg.base_id}/${encodeURIComponent(cfg.table_name)}/${recordId}`,
      { headers: atHeaders(cfg) }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Write Records ────────────────────────────────────────

/**
 * Create one or more records in Airtable.
 * Returns the created record IDs.
 */
export async function createRecords(
  companyId: string,
  records: { fields: Record<string, unknown> }[]
): Promise<string[]> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) return [];

  // Airtable allows max 10 records per request
  const ids: string[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      const res = await fetch(
        `${AT_API}/${cfg.base_id}/${encodeURIComponent(cfg.table_name)}`,
        {
          method: "POST",
          headers: atHeaders(cfg),
          body: JSON.stringify({ records: batch, typecast: true }),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        console.error(`[Airtable] Create failed (${res.status}):`, err);
        continue;
      }
      const data = await res.json();
      ids.push(...(data.records || []).map((r: AirtableRecord) => r.id));
    } catch (err) {
      console.error("[Airtable] Network error:", err);
    }
  }
  return ids;
}

/**
 * Update one or more records in Airtable (PATCH — partial update).
 */
export async function updateRecords(
  companyId: string,
  records: { id: string; fields: Record<string, unknown> }[]
): Promise<boolean> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) return false;

  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    try {
      const res = await fetch(
        `${AT_API}/${cfg.base_id}/${encodeURIComponent(cfg.table_name)}`,
        {
          method: "PATCH",
          headers: atHeaders(cfg),
          body: JSON.stringify({ records: batch, typecast: true }),
        }
      );
      if (!res.ok) {
        const err = await res.text();
        console.error(`[Airtable] Update failed (${res.status}):`, err);
        return false;
      }
    } catch (err) {
      console.error("[Airtable] Network error:", err);
      return false;
    }
  }
  return true;
}

/**
 * Delete records by ID.
 */
export async function deleteRecords(companyId: string, recordIds: string[]): Promise<boolean> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) return false;

  for (let i = 0; i < recordIds.length; i += 10) {
    const batch = recordIds.slice(i, i + 10);
    const params = batch.map(id => `records[]=${id}`).join("&");
    try {
      const res = await fetch(
        `${AT_API}/${cfg.base_id}/${encodeURIComponent(cfg.table_name)}?${params}`,
        { method: "DELETE", headers: atHeaders(cfg) }
      );
      if (!res.ok) return false;
    } catch {
      return false;
    }
  }
  return true;
}

// ─── Applicant Sync Helpers ───────────────────────────────

/**
 * Push an Overwatch applicant to Airtable.
 * Maps Overwatch applicant fields to common Airtable column names.
 */
export async function syncApplicantToAirtable(
  companyId: string,
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    status: string;
    guardCardNumber?: string;
    experience?: string;
    availability?: string;
    createdAt?: string;
  }
): Promise<string | null> {
  const fields: Record<string, unknown> = {
    "First Name": applicant.firstName,
    "Last Name": applicant.lastName,
    "Email": applicant.email,
    "Phone": applicant.phone ?? "",
    "Status": applicant.status,
    "Guard Card Number": applicant.guardCardNumber ?? "",
    "Experience": applicant.experience ?? "",
    "Availability": applicant.availability ?? "",
    "Overwatch ID": applicant.id,
    "Applied Date": applicant.createdAt ?? new Date().toISOString(),
    "Source": "Overwatch",
  };

  const ids = await createRecords(companyId, [{ fields }]);
  return ids[0] ?? null;
}

/**
 * Pull applicants from Airtable that don't yet exist in Overwatch.
 * Looks for records without an "Overwatch ID" field value.
 */
export async function pullNewApplicantsFromAirtable(
  companyId: string
): Promise<{ firstName: string; lastName: string; email: string; phone?: string; airtableId: string }[]> {
  const records = await listRecords(companyId, {
    filter: `{Overwatch ID} = ""`,
    maxRecords: 50,
  });

  return records.map(r => ({
    firstName: String(r.fields["First Name"] || r.fields["first_name"] || ""),
    lastName: String(r.fields["Last Name"] || r.fields["last_name"] || ""),
    email: String(r.fields["Email"] || r.fields["email"] || ""),
    phone: r.fields["Phone"] ? String(r.fields["Phone"]) : undefined,
    airtableId: r.id,
  })).filter(a => a.email); // Must have email
}

/**
 * Verify Airtable connection by listing up to 1 record.
 */
export async function verifyAirtableConnection(companyId: string): Promise<{ connected: boolean; tableName?: string; recordCount?: number }> {
  const cfg = await getAirtableConfig(companyId);
  if (!cfg) return { connected: false };

  try {
    const records = await listRecords(companyId, { maxRecords: 1 });
    return { connected: true, tableName: cfg.table_name, recordCount: records.length > 0 ? undefined : 0 };
  } catch {
    return { connected: false };
  }
}
