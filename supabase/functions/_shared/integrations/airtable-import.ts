/**
 * Pure Airtable applicant mapping and import planning.
 * No network, no secrets, no Deno globals. The adapter and the app tests
 * both use this so a reviewed import cannot silently duplicate people.
 */

export const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
export const AIRTABLE_BASE_ID = /^app[A-Za-z0-9]{14}$/;
export const AIRTABLE_TABLE_ID = /^tbl[A-Za-z0-9]{14}$/;
export const AIRTABLE_PREVIEW_LIMIT = 25;

const NAME_LIMIT = 200;

export interface AirtableSettings {
  baseId: string;
  tableId: string;
  baseName: string;
  tableName: string;
}

export interface NormalizedApplicant {
  airtableId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ExistingApplicant {
  id: string;
  email: string | null;
  airtableRecordId: string | null;
}

export interface ImportPlan {
  toImport: NormalizedApplicant[];
  alreadyImported: { airtableId: string; email: string; applicantId: string }[];
  emailConflicts: { airtableId: string; email: string; existingApplicantId: string | null }[];
  skipped: { airtableId: string; reason: "invalid_id" | "missing_email" }[];
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function clip(value: string): string {
  return value.trim().slice(0, NAME_LIMIT);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = asText(item);
      if (text) return text;
    }
  }
  return "";
}

function pick(fields: Record<string, unknown>, names: string[]): string {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const [key, value] of Object.entries(fields)) {
    if (wanted.has(key.toLowerCase())) {
      const text = asText(value);
      if (text) return text;
    }
  }
  return "";
}

export function readAirtableSettings(settings: Record<string, unknown> | null | undefined): AirtableSettings {
  const src = settings ?? {};
  const baseId = typeof src.base_id === "string" ? src.base_id.trim() : "";
  const tableId = typeof src.table_id === "string" ? src.table_id.trim() : "";
  const baseName = typeof src.base_name === "string" ? clip(src.base_name) : "";
  const tableName = typeof src.table_name === "string" ? clip(src.table_name) : "";
  return {
    baseId: AIRTABLE_BASE_ID.test(baseId) ? baseId : "",
    tableId: AIRTABLE_TABLE_ID.test(tableId) ? tableId : "",
    baseName,
    tableName,
  };
}

/** Map one Airtable record onto the applicant fields Overwatch actually stores. Extra columns are dropped. */
export function normalizeAirtableRecord(record: { id?: unknown; fields?: unknown }): NormalizedApplicant {
  const fields = record.fields && typeof record.fields === "object" ? record.fields as Record<string, unknown> : {};
  let firstName = pick(fields, ["First Name", "first_name", "First", "Given Name"]);
  let lastName = pick(fields, ["Last Name", "last_name", "Last", "Surname", "Family Name"]);
  if (!firstName && !lastName) {
    const full = pick(fields, ["Name", "Full Name", "Applicant"]);
    const splitAt = full.indexOf(" ");
    if (full && splitAt === -1) firstName = full;
    else if (full) {
      firstName = full.slice(0, splitAt);
      lastName = full.slice(splitAt + 1);
    }
  }
  const email = pick(fields, ["Email", "email", "E-mail", "Email Address"]);
  const phone = pick(fields, ["Phone", "phone", "Mobile", "Phone Number"]);
  return {
    airtableId: typeof record.id === "string" ? record.id : "",
    firstName: clip(firstName),
    lastName: clip(lastName),
    email: email.trim(),
    ...(phone ? { phone: clip(phone) } : {}),
  };
}

/**
 * Decide what a confirmed import may write.
 * Same company + Airtable record id is already imported.
 * Same email on a different applicant is a conflict and is not inserted.
 */
export function planApplicantImport(existing: ExistingApplicant[], incoming: NormalizedApplicant[]): ImportPlan {
  const byAirtable = new Map<string, ExistingApplicant>();
  const byEmail = new Map<string, ExistingApplicant>();
  for (const row of existing) {
    const recordId = row.airtableRecordId?.trim() ?? "";
    if (AIRTABLE_RECORD_ID.test(recordId) && !byAirtable.has(recordId)) byAirtable.set(recordId, row);
    const email = normalizeEmail(row.email);
    if (email && !byEmail.has(email)) byEmail.set(email, row);
  }

  const plan: ImportPlan = { toImport: [], alreadyImported: [], emailConflicts: [], skipped: [] };
  const seenEmail = new Set<string>();
  for (const row of incoming) {
    if (!AIRTABLE_RECORD_ID.test(row.airtableId)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "invalid_id" });
      continue;
    }
    const email = normalizeEmail(row.email);
    if (!email || !email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "missing_email" });
      continue;
    }
    const prior = byAirtable.get(row.airtableId);
    if (prior) {
      plan.alreadyImported.push({ airtableId: row.airtableId, email, applicantId: prior.id });
      continue;
    }
    if (seenEmail.has(email)) {
      plan.emailConflicts.push({ airtableId: row.airtableId, email, existingApplicantId: null });
      continue;
    }
    const emailOwner = byEmail.get(email);
    if (emailOwner) {
      plan.emailConflicts.push({ airtableId: row.airtableId, email, existingApplicantId: emailOwner.id });
      continue;
    }
    seenEmail.add(email);
    plan.toImport.push({ ...row, email });
  }
  return plan;
}
