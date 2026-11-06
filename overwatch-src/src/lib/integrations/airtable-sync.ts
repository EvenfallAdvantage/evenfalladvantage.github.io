/**
 * Airtable roster and Ops Planning sync planning.
 * No network, no secrets, no Deno globals. Applicant import does not use this
 * file; it keeps the reviewed name/email reader in airtable-import.ts.
 *
 * Field mapping is explicit. Same-name suggestions are returned for the UI
 * and are not a saved mapping. Sync refuses owner, admin, and manager role
 * or status changes, and it does not delete those memberships or any login.
 */

export const AIRTABLE_BASE_ID = /^app[A-Za-z0-9]{14}$/;
export const AIRTABLE_TABLE_ID = /^tbl[A-Za-z0-9]{14}$/;
export const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;
export const AIRTABLE_FIELD_ID = /^fld[A-Za-z0-9]{14}$/;

/**
 * Airtable pages are 100 records. A company Employees table of about 600
 * needs six pages. 1000 is the hard stop: enough for that roster plus growth,
 * and a partial read at the cap never removes memberships.
 */
export const AIRTABLE_SYNC_MAX_RECORDS = 1000;

export type AirtablePurpose = "applicants" | "roster" | "events";
export type MappedPurpose = "roster" | "events";

const PURPOSE_KEYS: Record<AirtablePurpose, { baseId: string; baseName: string; tableId: string; tableName: string }> = {
  applicants: { baseId: "base_id", baseName: "base_name", tableId: "table_id", tableName: "table_name" },
  roster: { baseId: "roster_base_id", baseName: "roster_base_name", tableId: "roster_table_id", tableName: "roster_table_name" },
  events: { baseId: "events_base_id", baseName: "events_base_name", tableId: "events_table_id", tableName: "events_table_name" },
};

export const AIRTABLE_SETTING_KEYS = [
  "base_id", "base_name", "table_id", "table_name",
  "roster_base_id", "roster_base_name", "roster_table_id", "roster_table_name",
  "events_base_id", "events_base_name", "events_table_id", "events_table_name",
] as const;

export interface AirtableChoice {
  id: string;
  name: string;
}

export interface PurposeSelection {
  baseId: string;
  baseName: string;
  tableId: string;
  tableName: string;
}

export interface SchemaField {
  id: string;
  name: string;
  type: string;
  choices?: string[];
}

export interface FieldBinding {
  field_id: string;
  name: string;
  type: string;
}

export type FieldMap = Partial<Record<string, FieldBinding>>;

export interface DestinationField {
  key: string;
  label: string;
  required: boolean;
  accepts: readonly string[];
  /** What Overwatch writes. Never a role, status, or approval. */
  writes: string;
}

const TEXT = ["singleLineText", "multilineText"] as const;
const TEXT_OR_SELECT = ["singleLineText", "multilineText", "singleSelect"] as const;
const LONG_TEXT = ["singleLineText", "multilineText", "richText"] as const;
const EMAIL = ["email", "singleLineText"] as const;
const PHONE = ["phoneNumber", "singleLineText"] as const;
const WHEN = ["date", "dateTime"] as const;

export const ROSTER_DESTINATIONS: readonly DestinationField[] = [
  { key: "first_name", label: "First name", required: true, accepts: TEXT, writes: "users.first_name" },
  { key: "last_name", label: "Last name", required: false, accepts: TEXT, writes: "users.last_name" },
  { key: "email", label: "Email", required: true, accepts: EMAIL, writes: "identity match only; never a role" },
  { key: "phone", label: "Phone", required: false, accepts: PHONE, writes: "users.phone when the value has digits" },
  { key: "title", label: "Title", required: false, accepts: TEXT_OR_SELECT, writes: "company_memberships.title" },
];

export const EVENT_DESTINATIONS: readonly DestinationField[] = [
  { key: "title", label: "Title", required: true, accepts: TEXT_OR_SELECT, writes: "events.name" },
  { key: "start", label: "Start", required: true, accepts: WHEN, writes: "events.start_date" },
  { key: "end", label: "End", required: true, accepts: WHEN, writes: "events.end_date" },
  { key: "location", label: "Location", required: false, accepts: TEXT_OR_SELECT, writes: "events.location" },
  { key: "notes", label: "Notes", required: false, accepts: LONG_TEXT, writes: "events.notes" },
];

/** Destinations Airtable is not allowed to drive. Documented and rejected if sent. */
export const FORBIDDEN_DESTINATIONS = [
  "role", "status", "pay", "pay_rate", "owner", "admin", "permission", "approved", "approval",
] as const;

export const PROTECTED_ROLES = new Set(["owner", "admin", "manager"]);

export function isProtectedRosterRole(role: string | null | undefined): boolean {
  return PROTECTED_ROLES.has((role ?? "").trim().toLowerCase());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_LIMIT = 200;
const NOTES_LIMIT = 4000;

export function destinationsFor(purpose: MappedPurpose): readonly DestinationField[] {
  return purpose === "roster" ? ROSTER_DESTINATIONS : EVENT_DESTINATIONS;
}

export function readPurposeSelection(settings: Record<string, unknown> | null | undefined, purpose: AirtablePurpose): PurposeSelection {
  const src = settings ?? {};
  const keys = PURPOSE_KEYS[purpose];
  const text = (key: string) => (typeof src[key] === "string" ? src[key].trim() : "");
  const baseId = text(keys.baseId);
  const tableId = text(keys.tableId);
  return {
    baseId: AIRTABLE_BASE_ID.test(baseId) ? baseId : "",
    baseName: text(keys.baseName).slice(0, NAME_LIMIT),
    tableId: AIRTABLE_TABLE_ID.test(tableId) ? tableId : "",
    tableName: text(keys.tableName).slice(0, NAME_LIMIT),
  };
}

/**
 * Overlay one purpose's base/table onto the keys already stored.
 * Other purposes are copied through so saving Events cannot drop Employees.
 */
export function mergePurposeSettings(
  current: Record<string, unknown> | null | undefined,
  purpose: AirtablePurpose,
  next: PurposeSelection,
): { ok: true; settings: Record<string, string> } | { ok: false; error: string } {
  const baseId = next.baseId.trim();
  const tableId = next.tableId.trim();
  if (!AIRTABLE_BASE_ID.test(baseId)) return { ok: false, error: "Choose a base from the list" };
  if (!AIRTABLE_TABLE_ID.test(tableId)) return { ok: false, error: "Choose a table from the list" };
  const settings: Record<string, string> = {};
  const src = current ?? {};
  for (const key of AIRTABLE_SETTING_KEYS) {
    const value = src[key];
    if (typeof value === "string" && value.trim()) settings[key] = value.trim().slice(0, NAME_LIMIT);
  }
  const keys = PURPOSE_KEYS[purpose];
  settings[keys.baseId] = baseId;
  settings[keys.tableId] = tableId;
  const baseName = next.baseName.trim().slice(0, NAME_LIMIT);
  const tableName = next.tableName.trim().slice(0, NAME_LIMIT);
  if (baseName) settings[keys.baseName] = baseName;
  else delete settings[keys.baseName];
  if (tableName) settings[keys.tableName] = tableName;
  else delete settings[keys.tableName];
  return { ok: true, settings };
}

/** Saved selection is not a filter. Callers render this list as-is. */
export function authorizedChoices<T extends { id: string }>(fetched: readonly T[], savedId?: string): T[] {
  void savedId;
  return fetched.slice();
}

const READABLE_BASE = new Set(["read", "comment", "edit", "create"]);

/** Every authorized base/table from a schema payload. `savedId` is ignored on purpose. */
export function schemaBaseChoices(
  bases: readonly { id?: unknown; name?: unknown; permissionLevel?: unknown }[] | null | undefined,
  savedId?: string,
): AirtableChoice[] {
  void savedId;
  const out: AirtableChoice[] = [];
  for (const base of bases ?? []) {
    if (typeof base.id !== "string" || !AIRTABLE_BASE_ID.test(base.id)) continue;
    if (typeof base.permissionLevel === "string" && !READABLE_BASE.has(base.permissionLevel)) continue;
    const name = typeof base.name === "string" && base.name.trim() ? base.name.trim().slice(0, NAME_LIMIT) : base.id;
    out.push({ id: base.id, name });
  }
  return out;
}

export function schemaTableChoices(
  tables: readonly { id?: unknown; name?: unknown }[] | null | undefined,
  savedId?: string,
): AirtableChoice[] {
  void savedId;
  const out: AirtableChoice[] = [];
  for (const table of tables ?? []) {
    if (typeof table.id !== "string" || !AIRTABLE_TABLE_ID.test(table.id)) continue;
    const name = typeof table.name === "string" && table.name.trim() ? table.name.trim().slice(0, NAME_LIMIT) : table.id;
    out.push({ id: table.id, name });
  }
  return out;
}

/** Prefer an exact table name when that purpose has no saved table yet. */
export function suggestedTableId(tables: readonly AirtableChoice[], preferredName: string, savedId: string): string {
  if (savedId && tables.some((t) => t.id === savedId)) return savedId;
  if (savedId) return savedId;
  const want = preferredName.trim().toLowerCase();
  return tables.find((t) => t.name.trim().toLowerCase() === want)?.id ?? "";
}

function normName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function readSchemaFields(fields: unknown): SchemaField[] {
  if (!Array.isArray(fields)) return [];
  const out: SchemaField[] = [];
  for (const raw of fields) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || !AIRTABLE_FIELD_ID.test(row.id)) continue;
    const name = typeof row.name === "string" ? row.name.trim().slice(0, NAME_LIMIT) : "";
    const type = typeof row.type === "string" ? row.type.trim().slice(0, 40) : "";
    if (!name || !type) continue;
    const choices = readChoiceNames(row.options);
    out.push(choices ? { id: row.id, name, type, choices } : { id: row.id, name, type });
    if (out.length >= 300) break;
  }
  return out;
}

function readChoiceNames(options: unknown): string[] | undefined {
  if (!options || typeof options !== "object") return undefined;
  const choices = (options as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return undefined;
  const names: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const name = (choice as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) names.push(name.trim().slice(0, NAME_LIMIT));
    if (names.length >= 200) break;
  }
  return names.length ? names : undefined;
}

/**
 * Suggest a source only when one schema field's name matches the destination
 * label or key after lowercasing and removing punctuation, and the type is
 * compatible. "Given Name" does not match "First name".
 */
export function suggestFieldMapping(fields: readonly SchemaField[], purpose: MappedPurpose): Record<string, string> {
  const suggestions: Record<string, string> = {};
  for (const dest of destinationsFor(purpose)) {
    const wanted = new Set([normName(dest.label), normName(dest.key)]);
    const hits = fields.filter((f) => wanted.has(normName(f.name)) && dest.accepts.includes(f.type));
    if (hits.length === 1) suggestions[dest.key] = hits[0].id;
  }
  return suggestions;
}

export interface MappingProblem {
  code: "missing_required" | "unknown_destination" | "unknown_field" | "incompatible_type" | "duplicate_source" | "forbidden_destination";
  destination?: string;
  field?: string;
  message: string;
}

export interface MappingAssessment {
  ok: boolean;
  mapping: FieldMap;
  problems: MappingProblem[];
  unmappedFields: string[];
}

export function assessFieldMapping(
  purpose: MappedPurpose,
  proposed: unknown,
  fields: readonly SchemaField[],
): MappingAssessment {
  const dests = destinationsFor(purpose);
  const allowed = new Set(dests.map((d) => d.key));
  const byId = new Map(fields.map((f) => [f.id, f]));
  const problems: MappingProblem[] = [];
  const mapping: FieldMap = {};
  const used = new Map<string, string>();
  const src = proposed && typeof proposed === "object" && !Array.isArray(proposed) ? proposed as Record<string, unknown> : {};

  for (const key of Object.keys(src)) {
    if (!allowed.has(key)) {
      const forbidden = (FORBIDDEN_DESTINATIONS as readonly string[]).includes(key);
      problems.push({
        code: forbidden ? "forbidden_destination" : "unknown_destination",
        destination: key,
        message: forbidden
          ? `${key} cannot be mapped from Airtable and cannot change access`
          : `${key} is not a ${purpose} field Overwatch can import`,
      });
    }
  }

  for (const dest of dests) {
    const raw = src[dest.key];
    if (raw == null || raw === "") {
      if (dest.required) {
        problems.push({ code: "missing_required", destination: dest.key, message: `${dest.label} needs an Airtable field` });
      }
      continue;
    }
    const binding = raw as Partial<FieldBinding>;
    const fieldId = typeof binding.field_id === "string" ? binding.field_id.trim() : "";
    const field = byId.get(fieldId);
    if (!field) {
      problems.push({ code: "unknown_field", destination: dest.key, field: fieldId, message: `${dest.label} does not match a field on this table` });
      continue;
    }
    if (!dest.accepts.includes(field.type)) {
      problems.push({
        code: "incompatible_type",
        destination: dest.key,
        field: field.name,
        message: `${field.name} is ${field.type}, which cannot fill ${dest.label}`,
      });
      continue;
    }
    const prior = used.get(field.id);
    if (prior) {
      problems.push({
        code: "duplicate_source",
        destination: dest.key,
        field: field.name,
        message: `${field.name} is already mapped to ${prior}`,
      });
      continue;
    }
    used.set(field.id, dest.label);
    mapping[dest.key] = { field_id: field.id, name: field.name, type: field.type };
  }

  const unmappedFields = fields.filter((f) => !used.has(f.id)).map((f) => f.name);
  return { ok: problems.length === 0, mapping, problems, unmappedFields };
}

/** Field ids the user saved. A stale on-screen suggestion does not count as the same map. */
export function sameFieldMap(left: FieldMap | null | undefined, right: FieldMap | null | undefined): boolean {
  const a = left ?? {};
  const b = right ?? {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key]?.field_id ?? "") !== (b[key]?.field_id ?? "")) return false;
  }
  return true;
}

export interface ValueProblem {
  airtableId: string;
  destination: string;
  code: "missing_value" | "incompatible_value" | "unrecognized_value";
  message: string;
}

function cellText(value: unknown): { text: string; multiple: boolean } {
  if (typeof value === "string") return { text: value.trim(), multiple: false };
  if (typeof value === "number" && Number.isFinite(value)) return { text: String(value), multiple: false };
  if (typeof value === "boolean") return { text: value ? "true" : "false", multiple: false };
  if (Array.isArray(value)) {
    if (value.length !== 1) return { text: "", multiple: value.length > 1 };
    return cellText(value[0]);
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.name === "string") return { text: row.name.trim(), multiple: false };
    if (typeof row.email === "string") return { text: row.email.trim(), multiple: false };
  }
  return { text: "", multiple: false };
}

export function parseAirtableInstant(value: string, type: string, bound: "start" | "end"): string | null {
  const trimmed = value.trim();
  if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return bound === "start" ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.000Z`;
  }
  if (type === "dateTime") {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }
  return null;
}

export interface InterpretedRecord {
  airtableId: string;
  values: Record<string, string>;
  problems: ValueProblem[];
}

export function interpretRecord(
  purpose: MappedPurpose,
  record: { id?: unknown; fields?: unknown },
  mapping: FieldMap,
  schema: readonly SchemaField[],
): InterpretedRecord {
  const airtableId = typeof record.id === "string" ? record.id : "";
  const fields = record.fields && typeof record.fields === "object" ? record.fields as Record<string, unknown> : {};
  const byName = new Map(schema.map((f) => [f.name, f]));
  const values: Record<string, string> = {};
  const problems: ValueProblem[] = [];

  for (const dest of destinationsFor(purpose)) {
    const binding = mapping[dest.key];
    if (!binding) continue;
    const schemaField = byName.get(binding.name) ?? schema.find((f) => f.id === binding.field_id);
    const raw = fields[binding.name];
    const cell = cellText(raw);
    if (cell.multiple || (raw != null && cell.text === "" && typeof raw !== "string" && typeof raw !== "number")) {
      problems.push({
        airtableId,
        destination: dest.key,
        code: "incompatible_value",
        message: `${dest.label} value from ${binding.name} is not a single ${dest.accepts.includes("date") || dest.accepts.includes("dateTime") ? "date" : "text"} value`,
      });
      continue;
    }
    if (!cell.text) {
      if (dest.required) {
        problems.push({ airtableId, destination: dest.key, code: "missing_value", message: `${dest.label} is empty` });
      }
      continue;
    }
    if (schemaField?.choices && !schemaField.choices.includes(cell.text)) {
      problems.push({
        airtableId,
        destination: dest.key,
        code: "unrecognized_value",
        message: `${binding.name} value is not one of the Airtable choices`,
      });
      continue;
    }
    if (dest.key === "email" && !EMAIL_RE.test(cell.text.toLowerCase())) {
      problems.push({ airtableId, destination: dest.key, code: "incompatible_value", message: "Email is not a valid address" });
      continue;
    }
    if (dest.key === "phone" && !/\d/.test(cell.text)) {
      problems.push({ airtableId, destination: dest.key, code: "incompatible_value", message: "Phone has no digits" });
      continue;
    }
    if (dest.key === "start" || dest.key === "end") {
      const instant = parseAirtableInstant(cell.text, binding.type, dest.key);
      if (!instant) {
        problems.push({ airtableId, destination: dest.key, code: "incompatible_value", message: `${dest.label} is not a usable date` });
        continue;
      }
      values[dest.key] = instant;
      continue;
    }
    const limit = dest.key === "notes" ? NOTES_LIMIT : NAME_LIMIT;
    values[dest.key] = cell.text.slice(0, limit);
  }
  return { airtableId, values, problems };
}

export interface RosterPerson {
  membershipId: string;
  userId: string;
  role: string;
  status: string;
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  title: string | null;
  airtableRecordId: string | null;
}

export interface RosterWriteBase {
  airtableId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  title?: string;
}

export type RosterWrite =
  | (RosterWriteBase & { kind: "create"; email: string; role: "staff" })
  | (RosterWriteBase & { kind: "attach"; email: string; userId: string; role: "staff" })
  | (RosterWriteBase & { kind: "link"; membershipId: string; userId: string })
  | (RosterWriteBase & { kind: "update"; membershipId: string; userId: string; protectedRole: boolean });

/** A company membership Airtable reconciliation may remove. Never a login. */
export interface RosterMembershipRef {
  membershipId: string;
  userId: string;
  role: string;
  email: string | null;
  airtableId: string | null;
}

export interface RosterIdentity {
  userId: string;
  email: string;
}

export type RosterRemovalHold = "truncated" | "roster_truncated" | "conflicts" | null;

/** How the Airtable page was classified. These counts are what a 597-row table must add up to. */
export interface RosterReadReport {
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
}

export interface RosterPlan {
  blocked: boolean;
  blockReason?: string;
  creates: Extract<RosterWrite, { kind: "create" }>[];
  attaches: Extract<RosterWrite, { kind: "attach" }>[];
  links: Extract<RosterWrite, { kind: "link" }>[];
  updates: Extract<RosterWrite, { kind: "update" }>[];
  unchanged: string[];
  conflicts: { airtableId: string; email: string; reason: string; membershipId?: string }[];
  skipped: { airtableId: string; reason: string }[];
  /** Memberships this confirmed plan will remove. Empty while the read is partial or conflicted. */
  removals: RosterMembershipRef[];
  /** Absent non-protected memberships that stay because removals are held. */
  held: RosterMembershipRef[];
  removalHold: RosterRemovalHold;
  missingFromAirtable: { membershipId: string; userId: string; airtableId: string; role: string }[];
  protected: { membershipId: string; role: string; reason: string; airtableId: string | null }[];
  valueProblems: ValueProblem[];
  read: RosterReadReport;
}

export function assertAirtableCannotGrantRole(role: string): "staff" {
  if (role !== "staff") throw new Error("Airtable cannot create owner, admin, or any non-staff role");
  return "staff";
}

export function assertRosterWrite(write: RosterWrite): void {
  if (write.kind === "create" || write.kind === "attach") assertAirtableCannotGrantRole(write.role);
  const keys = Object.keys(write);
  if (keys.includes("status") || keys.includes("pay") || keys.includes("pay_rate")) {
    throw new Error("Airtable cannot change membership status or pay");
  }
  if (write.kind !== "create" && write.kind !== "attach" && keys.includes("role")) {
    throw new Error("Airtable cannot change membership role");
  }
  if (write.kind !== "create" && write.kind !== "attach" && keys.includes("email")) {
    throw new Error("Airtable cannot change a linked email");
  }
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeRosterEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function rosterRole(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Pages of an Airtable list, in order. Stops at the record cap. A leftover
 * offset, or a caller that stopped while an offset remained, is truncated so
 * reconciliation will not remove anyone from a partial read.
 */
export function takeAirtableRecords<T>(
  pages: readonly { records: readonly T[]; offset?: string | null }[],
  cap = AIRTABLE_SYNC_MAX_RECORDS,
): { records: T[]; truncated: boolean } {
  if (pages.length === 0) return { records: [], truncated: false };
  const records: T[] = [];
  for (const page of pages) {
    records.push(...page.records);
    const more = typeof page.offset === "string" && page.offset.length > 0;
    if (!more) return { records: records.slice(0, cap), truncated: records.length > cap };
    if (records.length >= cap) return { records: records.slice(0, cap), truncated: true };
  }
  return { records: records.slice(0, cap), truncated: true };
}

export function planRosterSync(
  locals: readonly RosterPerson[],
  incoming: readonly InterpretedRecord[],
  opts: { truncated: boolean; rosterTruncated?: boolean; identities?: readonly RosterIdentity[] },
): RosterPlan {
  const plan: RosterPlan = {
    blocked: false,
    creates: [],
    attaches: [],
    links: [],
    updates: [],
    unchanged: [],
    conflicts: [],
    skipped: [],
    removals: [],
    held: [],
    removalHold: null,
    missingFromAirtable: [],
    protected: [],
    valueProblems: [],
    read: emptyRosterRead(),
  };
  const byRecord = new Map<string, RosterPerson>();
  const byEmail = new Map<string, RosterPerson[]>();
  for (const row of locals) {
    const recordId = row.airtableRecordId?.trim() ?? "";
    if (AIRTABLE_RECORD_ID.test(recordId)) {
      const prior = byRecord.get(recordId);
      if (prior && prior.membershipId !== row.membershipId) {
        plan.conflicts.push({
          airtableId: recordId,
          email: normalizeRosterEmail(row.email),
          reason: "record_matches_multiple_people",
          membershipId: row.membershipId,
        });
      } else if (!prior) byRecord.set(recordId, row);
    }
    const email = normalizeRosterEmail(row.email);
    if (email) {
      const list = byEmail.get(email) ?? [];
      list.push(row);
      byEmail.set(email, list);
    }
  }
  const identityByEmail = new Map<string, Set<string>>();
  for (const identity of opts.identities ?? []) {
    const email = normalizeRosterEmail(identity.email);
    const userId = identity.userId.trim();
    if (!email || !userId) continue;
    const ids = identityByEmail.get(email) ?? new Set<string>();
    ids.add(userId);
    identityByEmail.set(email, ids);
  }
  const distinctOwners = (email: string) => {
    const ids = new Set<string>(identityByEmail.get(email) ?? []);
    for (const local of byEmail.get(email) ?? []) ids.add(local.userId);
    return ids;
  };

  const seenIds = new Set<string>();
  const presentIds = new Set<string>();
  const presentEmails = new Set<string>();
  const usable: InterpretedRecord[] = [];
  for (const row of incoming) {
    if (!AIRTABLE_RECORD_ID.test(row.airtableId)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "invalid_id" });
      continue;
    }
    if (seenIds.has(row.airtableId)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "duplicate_record" });
      continue;
    }
    seenIds.add(row.airtableId);
    presentIds.add(row.airtableId);
    plan.valueProblems.push(...row.problems);
    const email = normalizeRosterEmail(row.values.email);
    if (email && EMAIL_RE.test(email)) presentEmails.add(email);
    usable.push(row);
  }

  const suppressed = new Set<string>();
  const grouped = new Map<string, InterpretedRecord[]>();
  for (const row of usable) {
    const email = normalizeRosterEmail(row.values.email);
    if (!email || !EMAIL_RE.test(email)) continue;
    const list = grouped.get(email) ?? [];
    list.push(row);
    grouped.set(email, list);
  }
  for (const [email, rows] of grouped) {
    if (rows.length < 2) continue;
    const linked = rows.filter((row) => byRecord.has(row.airtableId));
    const winner = linked.length === 1
      ? linked[0]
      : linked.length > 1
        ? null
        : [...rows].sort((a, b) => (a.airtableId < b.airtableId ? -1 : 1))[0];
    for (const row of rows) {
      if (winner && row.airtableId === winner.airtableId) continue;
      suppressed.add(row.airtableId);
      plan.conflicts.push({ airtableId: row.airtableId, email, reason: "duplicate_email_in_airtable" });
    }
  }

  const logProtected = (row: RosterPerson, airtableId: string | null, reason: string) => {
    plan.protected.push({
      membershipId: row.membershipId,
      role: rosterRole(row.role),
      reason,
      airtableId,
    });
  };

  for (const row of usable) {
    if (suppressed.has(row.airtableId)) continue;
    const email = normalizeRosterEmail(row.values.email);
    const emailOk = Boolean(email && EMAIL_RE.test(email));
    const linked = byRecord.get(row.airtableId);
    if (linked) {
      const protectedRole = isProtectedRosterRole(linked.role);
      if (emailOk) {
        const others = distinctOwners(email);
        others.delete(linked.userId);
        if (others.size > 0) {
          plan.conflicts.push({
            airtableId: row.airtableId,
            email,
            reason: "email_owned_by_other_user",
            membershipId: linked.membershipId,
          });
          if (protectedRole) logProtected(linked, row.airtableId, "email_unchanged");
          continue;
        }
      }
      const set = profileSet(row.values, linked, false);
      if (!set.firstName && !set.lastName && !set.phone && !set.title) plan.unchanged.push(row.airtableId);
      else {
        plan.updates.push({
          kind: "update",
          airtableId: row.airtableId,
          membershipId: linked.membershipId,
          userId: linked.userId,
          protectedRole,
          ...set,
        });
      }
      if (protectedRole) {
        const localEmail = normalizeRosterEmail(linked.email);
        logProtected(linked, row.airtableId, emailOk && localEmail !== email ? "email_unchanged" : "role_unchanged");
      }
      continue;
    }
    if (!emailOk) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "missing_email" });
      continue;
    }
    const requiredProblem = row.problems.find((problem) => problem.destination === "first_name" || problem.destination === "email");
    if (requiredProblem || !cleanOptional(row.values.first_name)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: requiredProblem?.code ?? "missing_required_value" });
      continue;
    }
    const localOwners = byEmail.get(email) ?? [];
    const ownerIds = distinctOwners(email);
    if (localOwners.length > 1) {
      plan.conflicts.push({ airtableId: row.airtableId, email, reason: "email_matches_multiple_people" });
      continue;
    }
    if (localOwners.length === 1) {
      const owner = localOwners[0];
      const others = [...ownerIds].filter((id) => id !== owner.userId);
      if (others.length > 0) {
        plan.conflicts.push({
          airtableId: row.airtableId,
          email,
          reason: "email_owned_by_other_user",
          membershipId: owner.membershipId,
        });
        if (isProtectedRosterRole(owner.role)) logProtected(owner, row.airtableId, "email_unchanged");
        continue;
      }
      const linkedId = owner.airtableRecordId?.trim() ?? "";
      if (AIRTABLE_RECORD_ID.test(linkedId) && linkedId !== row.airtableId) {
        plan.conflicts.push({
          airtableId: row.airtableId,
          email,
          reason: "email_already_linked",
          membershipId: owner.membershipId,
        });
        if (isProtectedRosterRole(owner.role)) logProtected(owner, row.airtableId, "email_unchanged");
        continue;
      }
      if (isProtectedRosterRole(owner.role)) {
        logProtected(owner, row.airtableId, "email_not_linked");
        continue;
      }
      plan.links.push({
        kind: "link",
        airtableId: row.airtableId,
        membershipId: owner.membershipId,
        userId: owner.userId,
        ...profileSet(row.values, owner, true),
      });
      continue;
    }
    if (ownerIds.size > 1) {
      plan.conflicts.push({ airtableId: row.airtableId, email, reason: "email_matches_multiple_people" });
      continue;
    }
    if (ownerIds.size === 1) {
      plan.attaches.push({
        kind: "attach",
        airtableId: row.airtableId,
        email,
        userId: [...ownerIds][0],
        role: "staff",
        title: cleanOptional(row.values.title),
      });
      continue;
    }
    plan.creates.push({
      kind: "create",
      airtableId: row.airtableId,
      email,
      role: "staff",
      firstName: row.values.first_name,
      lastName: cleanOptional(row.values.last_name),
      phone: cleanOptional(row.values.phone),
      title: cleanOptional(row.values.title),
    });
  }

  if (opts.truncated) plan.removalHold = "truncated";
  else if (opts.rosterTruncated) plan.removalHold = "roster_truncated";
  else {
    const candidates: RosterMembershipRef[] = [];
    for (const row of locals) {
      const recordId = row.airtableRecordId?.trim() ?? "";
      const linkedId = AIRTABLE_RECORD_ID.test(recordId) ? recordId : "";
      const email = normalizeRosterEmail(row.email);
      const covered = Boolean((linkedId && presentIds.has(linkedId)) || (email && presentEmails.has(email)));
      if (covered) continue;
      if (isProtectedRosterRole(row.role)) {
        logProtected(row, linkedId || null, "absent_preserved");
        continue;
      }
      candidates.push({
        membershipId: row.membershipId,
        userId: row.userId,
        role: rosterRole(row.role),
        email: email || null,
        airtableId: linkedId || null,
      });
    }
    // A duplicate email, or any other identity conflict, holds every removal.
    // A membership whose Airtable record id was in this read is already
    // covered above, including when that row's email is blank or a field is invalid.
    if (plan.conflicts.length > 0) {
      plan.removalHold = "conflicts";
      plan.held = candidates;
    } else {
      plan.removals = candidates;
      plan.missingFromAirtable = candidates.map((row) => ({
        membershipId: row.membershipId,
        userId: row.userId,
        airtableId: row.airtableId ?? "",
        role: row.role,
      }));
    }
  }
  for (const write of [...plan.creates, ...plan.attaches, ...plan.links, ...plan.updates]) assertRosterWrite(write);
  for (const removal of plan.removals) {
    if (isProtectedRosterRole(removal.role)) throw new Error("Airtable cannot remove an owner, admin, or manager");
  }
  const invalidId = plan.skipped.filter((row) => row.reason === "invalid_id").length;
  const duplicateRecord = plan.skipped.filter((row) => row.reason === "duplicate_record").length;
  const missingRequired = plan.skipped.length - invalidId - duplicateRecord;
  plan.read = {
    rawRead: incoming.length,
    seen: seenIds.size,
    valid: plan.creates.length + plan.attaches.length + plan.links.length + plan.updates.length + plan.unchanged.length,
    invalidId,
    duplicateRecord,
    duplicateEmail: plan.conflicts.filter((row) => row.reason === "duplicate_email_in_airtable").length,
    conflict: plan.conflicts.length,
    missingRequired,
    create: plan.creates.length,
    attach: plan.attaches.length,
    link: plan.links.length,
    update: plan.updates.length,
    unchanged: plan.unchanged.length,
    remove: plan.removals.length,
    held: plan.held.length,
    protected: plan.protected.length,
    cap: AIRTABLE_SYNC_MAX_RECORDS,
  };
  return plan;
}

function emptyRosterRead(): RosterReadReport {
  return {
    rawRead: 0, seen: 0, valid: 0, invalidId: 0, duplicateRecord: 0, duplicateEmail: 0,
    conflict: 0, missingRequired: 0, create: 0, attach: 0, link: 0, update: 0, unchanged: 0,
    remove: 0, held: 0, protected: 0, cap: AIRTABLE_SYNC_MAX_RECORDS,
  };
}

function profileSet(values: Record<string, string>, local: RosterPerson, blanksOnly: boolean): Omit<RosterWriteBase, "airtableId"> {
  const next: Omit<RosterWriteBase, "airtableId"> = {};
  const take = (key: "firstName" | "lastName" | "phone" | "title", incoming: string | undefined, current: string | null) => {
    const value = cleanOptional(incoming);
    if (!value) return;
    const currentValue = cleanOptional(current ?? undefined);
    if (blanksOnly && currentValue) return;
    if (value === currentValue) return;
    next[key] = value;
  };
  take("firstName", values.first_name, local.firstName);
  take("lastName", values.last_name, local.lastName);
  take("phone", values.phone, local.phone);
  take("title", values.title, local.title);
  return next;
}

export interface EventLocal {
  id: string;
  airtableRecordId: string | null;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  notes: string | null;
  status: string;
  syncHash: string | null;
}

export interface EventWrite {
  airtableId: string;
  name: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  hash: string;
  status: "draft";
}

export interface EventPlan {
  blocked: boolean;
  creates: (EventWrite & { kind: "create" })[];
  updates: (EventWrite & { kind: "update"; eventId: string; previousHash: string })[];
  unchanged: string[];
  conflicts: { airtableId: string; eventId?: string; reason: string }[];
  skipped: { airtableId: string; reason: string }[];
  missingFromAirtable: { eventId: string; airtableId: string }[];
  valueProblems: ValueProblem[];
  manualLeftAlone: number;
}

export function eventSyncHash(fields: { name: string; start: string; end: string; location: string; notes: string }): string {
  const canon = (value: string, date: boolean) => {
    const trimmed = value.trim();
    if (!date) return trimmed;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString();
  };
  return [
    canon(fields.name, false),
    canon(fields.start, true),
    canon(fields.end, true),
    canon(fields.location, false),
    canon(fields.notes, false),
  ].join("\u001f");
}

export function eventInsertStatus(): "draft" {
  return "draft";
}

export function planEventSync(
  locals: readonly EventLocal[],
  incoming: readonly InterpretedRecord[],
  opts: { truncated: boolean },
): EventPlan {
  const plan: EventPlan = {
    blocked: false,
    creates: [],
    updates: [],
    unchanged: [],
    conflicts: [],
    skipped: [],
    missingFromAirtable: [],
    valueProblems: [],
    manualLeftAlone: locals.filter((row) => !row.airtableRecordId).length,
  };
  const byRecord = new Map<string, EventLocal>();
  for (const row of locals) {
    const recordId = row.airtableRecordId?.trim() ?? "";
    if (AIRTABLE_RECORD_ID.test(recordId) && !byRecord.has(recordId)) byRecord.set(recordId, row);
  }
  const seen = new Set<string>();
  for (const row of incoming) {
    plan.valueProblems.push(...row.problems);
    if (!AIRTABLE_RECORD_ID.test(row.airtableId)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "invalid_id" });
      continue;
    }
    if (seen.has(row.airtableId)) {
      plan.skipped.push({ airtableId: row.airtableId, reason: "duplicate_record" });
      continue;
    }
    seen.add(row.airtableId);
    const title = cleanOptional(row.values.title);
    const start = cleanOptional(row.values.start);
    const end = cleanOptional(row.values.end);
    const scheduleProblem = row.problems.some((p) => p.destination === "title" || p.destination === "start" || p.destination === "end");
    if (scheduleProblem || !title || !start || !end || start >= end) {
      plan.skipped.push({ airtableId: row.airtableId, reason: !title ? "missing_title" : "invalid_schedule" });
      continue;
    }
    const linked = byRecord.get(row.airtableId);
    const location = cleanOptional(row.values.location) || linked?.location || "";
    const notes = cleanOptional(row.values.notes) || linked?.notes || "";
    const hash = eventSyncHash({ name: title, start, end, location, notes });
    const write: EventWrite = {
      airtableId: row.airtableId,
      name: title,
      start,
      end,
      location: location || undefined,
      notes: notes || undefined,
      hash,
      status: eventInsertStatus(),
    };
    if (!linked) {
      plan.creates.push({ kind: "create", ...write });
      continue;
    }
    const currentHash = eventSyncHash({
      name: linked.name,
      start: linked.startDate,
      end: linked.endDate,
      location: linked.location ?? "",
      notes: linked.notes ?? "",
    });
    if (linked.syncHash && linked.syncHash !== currentHash) {
      plan.conflicts.push({ airtableId: row.airtableId, eventId: linked.id, reason: "locally_modified" });
      continue;
    }
    if (!linked.syncHash) {
      plan.conflicts.push({ airtableId: row.airtableId, eventId: linked.id, reason: "unhashed_link" });
      continue;
    }
    if (currentHash === hash) {
      plan.unchanged.push(row.airtableId);
      continue;
    }
    plan.updates.push({ kind: "update", eventId: linked.id, previousHash: linked.syncHash, ...write });
  }
  if (!opts.truncated) {
    for (const row of locals) {
      const recordId = row.airtableRecordId?.trim() ?? "";
      if (!AIRTABLE_RECORD_ID.test(recordId) || seen.has(recordId)) continue;
      plan.missingFromAirtable.push({ eventId: row.id, airtableId: recordId });
    }
  }
  return plan;
}

export function rosterCounts(plan: RosterPlan): Record<string, number> {
  return {
    create: plan.creates.length,
    attach: plan.attaches.length,
    link: plan.links.length,
    update: plan.updates.length,
    unchanged: plan.unchanged.length,
    conflict: plan.conflicts.length,
    skipped: plan.skipped.length,
    remove: plan.removals.length,
    held: plan.held.length,
    missing: plan.removals.length,
    protected: plan.protected.length,
    valueProblems: plan.valueProblems.length,
  };
}

export interface RosterSyncPayload {
  creates: { airtable_id: string; email: string; first_name?: string; last_name?: string; phone?: string; title?: string }[];
  attaches: { airtable_id: string; user_id: string; email: string; title?: string }[];
  links: { airtable_id: string; membership_id: string; user_id: string; first_name?: string; last_name?: string; phone?: string; title?: string }[];
  updates: { airtable_id: string; membership_id: string; user_id: string; first_name?: string; last_name?: string; phone?: string; title?: string }[];
  removals: { membership_id: string; user_id: string }[];
}

function payloadProfile(row: { firstName?: string; lastName?: string; phone?: string; title?: string }) {
  return {
    ...(row.firstName ? { first_name: row.firstName } : {}),
    ...(row.lastName ? { last_name: row.lastName } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.title ? { title: row.title } : {}),
  };
}

/** Fields the database function is allowed to receive. Role, status, and email changes are absent. */
export function rosterSyncPayload(plan: RosterPlan): RosterSyncPayload {
  for (const write of [...plan.creates, ...plan.attaches, ...plan.links, ...plan.updates]) assertRosterWrite(write);
  for (const removal of plan.removals) {
    if (isProtectedRosterRole(removal.role)) throw new Error("Airtable cannot remove an owner, admin, or manager");
  }
  return {
    creates: plan.creates.map((row) => ({
      airtable_id: row.airtableId,
      email: row.email,
      ...payloadProfile(row),
    })),
    attaches: plan.attaches.map((row) => ({
      airtable_id: row.airtableId,
      user_id: row.userId,
      email: row.email,
      ...(row.title ? { title: row.title } : {}),
    })),
    links: plan.links.map((row) => ({
      airtable_id: row.airtableId,
      membership_id: row.membershipId,
      user_id: row.userId,
      ...payloadProfile(row),
    })),
    updates: plan.updates.map((row) => ({
      airtable_id: row.airtableId,
      membership_id: row.membershipId,
      user_id: row.userId,
      ...payloadProfile(row),
    })),
    removals: plan.removals.map((row) => ({ membership_id: row.membershipId, user_id: row.userId })),
  };
}

/** Stable id of the plan the user is confirming. Field values are included so a local edit is not overwritten. */
export function rosterPlanToken(plan: RosterPlan): string {
  const payload = rosterSyncPayload(plan);
  const sort = <T>(rows: T[], key: (row: T) => string) => [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return JSON.stringify({
    creates: sort(payload.creates, (row) => `${row.airtable_id}\u001f${row.email}`),
    attaches: sort(payload.attaches, (row) => `${row.airtable_id}\u001f${row.user_id}`),
    links: sort(payload.links, (row) => `${row.airtable_id}\u001f${row.membership_id}`),
    updates: sort(payload.updates, (row) => `${row.airtable_id}\u001f${row.membership_id}`),
    removals: sort(payload.removals, (row) => `${row.membership_id}\u001f${row.user_id}`),
    conflicts: sort(plan.conflicts, (row) => `${row.airtableId}\u001f${row.reason}\u001f${row.email}`),
    removalHold: plan.removalHold,
    rawRead: plan.read.rawRead,
    seen: plan.read.seen,
  });
}

export function rosterConfirmDescription(
  counts: Record<string, number>,
  opts: { truncated: boolean; removalHold?: string | null; read?: RosterReadReport },
): string {
  const remove = counts.remove ?? counts.missing ?? 0;
  const held = counts.held ?? 0;
  const hold = opts.truncated || opts.removalHold === "truncated" || opts.removalHold === "roster_truncated"
    ? "The Airtable read was incomplete, so nobody is removed."
    : opts.removalHold === "conflicts" || held > 0
      ? `${held} people are not in Airtable and will stay until conflicts are resolved.`
      : remove > 0
        ? `${remove} company memberships will be removed. Their logins stay.`
        : "Nobody is removed.";
  const blanks = " Rows without a valid email are not added. An already linked Airtable record stays even when its email is blank. Invalid optional values are left unchanged.";
  const link = (counts.link ?? 0) + (counts.attach ?? 0);
  const read = opts.read;
  const accounting = read
    ? `Read ${read.rawRead} (cap ${read.cap}). Seen ${read.seen}, valid ${read.valid}, duplicate/conflict ${read.duplicateRecord + read.conflict}, missing required ${read.missingRequired}, updated ${read.update}, unchanged ${read.unchanged}, removals ${read.remove}. `
    : "";
  return `${accounting}Create ${counts.create ?? 0}, link ${link}, update ${counts.update ?? 0}. ${hold} Conflicts ${counts.conflict ?? 0}, skipped ${counts.skipped ?? 0}. Owners, admins, and managers stay. Airtable is not written.${blanks}`;
}

export function eventCounts(plan: EventPlan): Record<string, number> {
  return {
    create: plan.creates.length,
    update: plan.updates.length,
    unchanged: plan.unchanged.length,
    conflict: plan.conflicts.length,
    skipped: plan.skipped.length,
    missing: plan.missingFromAirtable.length,
    manual: plan.manualLeftAlone,
    valueProblems: plan.valueProblems.length,
  };
}
