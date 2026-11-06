/**
 * Roster and Ops Planning actions for the Airtable adapter.
 * Read-only against Airtable. Writes stay in Overwatch, and only after confirm.
 * Applicant import does not go through this file.
 */
import { vendorJson } from "./vendor-fetch.ts";
import { VendorError, type ActionDef, type AdapterCtx, type LiveConnection } from "./types.ts";
import {
  AIRTABLE_SYNC_MAX_RECORDS,
  assessFieldMapping,
  eventCounts,
  interpretRecord,
  mergePurposeSettings,
  planEventSync,
  planRosterSync,
  readPurposeSelection,
  readSchemaFields,
  rosterCounts,
  rosterPlanToken,
  rosterDiagnosticReport,
  rosterDisplayName,
  scrubRosterWriteError,
  rosterSyncPayload,
  sameFieldMap,
  isRosterDiagnosticReport,
  schemaBaseChoices,
  schemaTableChoices,
  takeAirtableRecords,
  type AirtablePurpose,
  type EventLocal,
  type FieldMap,
  type InterpretedRecord,
  type MappedPurpose,
  type MappingAssessment,
  type PurposeSelection,
  type RosterIdentity,
  type RosterPerson,
  type RosterPlan,
  type SchemaField,
} from "../../../../overwatch-src/src/lib/integrations/airtable-sync.ts";

const API = "https://api.airtable.com/v0";

export interface RosterStore {
  listPeople(companyId: string): Promise<{ people: RosterPerson[]; truncated: boolean }>;
  listEmailOwners(emails: readonly string[]): Promise<RosterIdentity[]>;
  applyPlan(row: {
    companyId: string;
    baseId: string;
    tableId: string;
    plan: ReturnType<typeof rosterSyncPayload>;
  }): Promise<{
    created: number;
    attached: number;
    linked: number;
    updated: number;
    removed: number;
    failed: { create: number; attach: number; link: number; update: number; remove: number };
    failures: { op: string; airtable_id: string; message: string }[];
  }>;
}

export interface EventStore {
  listEvents(companyId: string): Promise<EventLocal[]>;
  createEvent(row: {
    companyId: string;
    name: string;
    start: string;
    end: string;
    location?: string;
    notes?: string;
    airtableRecordId: string;
    baseId: string;
    tableId: string;
    hash: string;
  }): Promise<{ id: string }>;
  updateLinked(row: {
    companyId: string;
    eventId: string;
    airtableRecordId: string;
    expectedHash: string;
    name: string;
    start: string;
    end: string;
    location?: string;
    notes?: string;
    hash: string;
  }): Promise<"updated" | "skipped">;
}

export interface StoredMapping {
  mappings: FieldMap;
  confirmedAt: string | null;
}

export interface MappingStore {
  get(companyId: string, purpose: MappedPurpose, baseId: string, tableId: string): Promise<StoredMapping | null>;
  confirm(companyId: string, purpose: MappedPurpose, baseId: string, tableId: string, mappings: FieldMap, confirmedAt: string): Promise<void>;
}

export interface SettingsStore {
  save(companyId: string, connectionId: string, settings: Record<string, string>): Promise<Record<string, unknown>>;
}

export interface ReportStore {
  latest(companyId: string, connectionId: string): Promise<unknown | null>;
}

export interface OpsDeps {
  roster: RosterStore;
  events: EventStore;
  mappings: MappingStore;
  settings: SettingsStore;
  reports?: ReportStore;
  lastTestOk(companyId: string): Promise<boolean>;
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function bearer(token: string | undefined): HeadersInit {
  return { Authorization: `Bearer ${token ?? ""}` };
}

function denied(error: unknown): string | null {
  if (error instanceof VendorError && (error.status === 401 || error.status === 403 || error.status === 404)) {
    return "Airtable could not read that base";
  }
  return null;
}

interface SchemaPayload {
  tables?: { id?: unknown; name?: unknown; fields?: unknown }[];
}

export async function fetchBases(token: string | undefined, ctx: AdapterCtx): Promise<{ id: string; name: string }[]> {
  const out: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  let offset: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`${API}/meta/bases`);
    if (offset) {
      if (seen.has(offset)) break;
      seen.add(offset);
      url.searchParams.set("offset", offset);
    }
    const data = await vendorJson<{ bases?: { id?: unknown; name?: unknown; permissionLevel?: unknown }[]; offset?: string }>(url.toString(), {
      fetchImpl: ctx.fetch,
      headers: bearer(token),
    });
    out.push(...schemaBaseChoices(data.bases));
    if (!data.offset) break;
    offset = data.offset;
  }
  return out;
}

export async function fetchSchema(baseId: string, token: string | undefined, ctx: AdapterCtx): Promise<SchemaPayload> {
  return await vendorJson<SchemaPayload>(`${API}/meta/bases/${baseId}/tables`, {
    fetchImpl: ctx.fetch,
    headers: bearer(token),
  });
}

export async function fetchRecords(baseId: string, tableId: string, token: string | undefined, ctx: AdapterCtx): Promise<{ records: { id?: unknown; fields?: unknown }[]; truncated: boolean; pages: number }> {
  const pages: { records: { id?: unknown; fields?: unknown }[]; offset?: string | null }[] = [];
  const seen = new Set<string>();
  let offset: string | undefined;
  const maxPages = Math.ceil(AIRTABLE_SYNC_MAX_RECORDS / 100) + 2;
  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${API}/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (offset) {
      if (seen.has(offset)) break;
      seen.add(offset);
      url.searchParams.set("offset", offset);
    }
    const data = await vendorJson<{ records?: { id?: unknown; fields?: unknown }[]; offset?: string }>(url.toString(), {
      fetchImpl: ctx.fetch,
      headers: bearer(token),
    });
    pages.push({ records: data.records ?? [], offset: data.offset ?? null });
    const read = pages.reduce((sum, item) => sum + item.records.length, 0);
    if (!data.offset || read >= AIRTABLE_SYNC_MAX_RECORDS) break;
    offset = data.offset;
  }
  const taken = takeAirtableRecords(pages);
  return { records: taken.records, truncated: taken.truncated, pages: pages.length };
}

function purposeOf(value: unknown): AirtablePurpose | null {
  return value === "applicants" || value === "roster" || value === "events" ? value : null;
}

function mappedPurpose(value: unknown): MappedPurpose | null {
  return value === "roster" || value === "events" ? value : null;
}

function selectionFrom(input: Record<string, unknown>): PurposeSelection {
  return {
    baseId: typeof input.base_id === "string" ? input.base_id : "",
    baseName: typeof input.base_name === "string" ? input.base_name : "",
    tableId: typeof input.table_id === "string" ? input.table_id : "",
    tableName: typeof input.table_name === "string" ? input.table_name : "",
  };
}

async function schemaFor(
  conn: LiveConnection,
  baseId: string,
  tableId: string,
  ctx: AdapterCtx,
): Promise<{ fields: SchemaField[]; tables: { id: string; name: string }[] } | { error: string }> {
  try {
    const bases = await fetchBases(conn.secrets.access_token, ctx);
    if (!bases.some((base) => base.id === baseId)) return { error: "That base is not available to this Airtable connection" };
    const payload = await fetchSchema(baseId, conn.secrets.access_token, ctx);
    const tables = schemaTableChoices(payload.tables);
    const table = (payload.tables ?? []).find((item) => item.id === tableId);
    if (!table || !tables.some((item) => item.id === tableId)) return { error: "That table is not in the authorized base" };
    return { fields: readSchemaFields(table.fields), tables };
  } catch (error) {
    const message = denied(error);
    if (message) return { error: message };
    throw error;
  }
}

function previewBody(assessment: MappingAssessment, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    canSync: false,
    savedMapping: false,
    truncated: false,
    counts: {},
    mappingProblems: assessment.problems.map((problem) => ({ code: problem.code, destination: problem.destination ?? null, message: problem.message })),
    valueProblems: [],
    unmappedFields: assessment.unmappedFields,
    rows: [],
    notes: ["Confirm the field mapping before the first sync. Suggestions are not saved."],
    ...extra,
  };
}

function rowLabel(purpose: MappedPurpose, values: Record<string, string>): string {
  if (purpose === "events") return values.title || "Untitled event";
  const name = [values.first_name, values.last_name].filter(Boolean).join(" ").trim();
  return name || values.email || "Unnamed record";
}

export function opsActions(resolve: (ctx: AdapterCtx) => Promise<OpsDeps>): Record<string, ActionDef> {
  return {
    save_table: {
      access: "manage",
      async run(conn, input, ctx) {
        const purpose = purposeOf(input.purpose);
        if (!purpose) return fail("Choose applicants, roster, or events");
        const picked = selectionFrom(input);
        const merged = mergePurposeSettings(conn.settings, purpose, picked);
        if (!merged.ok) return fail(merged.error);
        const checked = await schemaFor(conn, picked.baseId.trim(), picked.tableId.trim(), ctx);
        if ("error" in checked) return fail(checked.error);
        const deps = await resolve(ctx);
        const saved = await deps.settings.save(conn.company_id, conn.id, merged.settings);
        const round = readPurposeSelection(saved, purpose);
        if (round.baseId !== picked.baseId.trim() || round.tableId !== picked.tableId.trim()) {
          return fail("The table mapping was not stored. Apply the Airtable roster migration before saving Roster or Events.");
        }
        return { ok: true, purpose, base_id: round.baseId, table_id: round.tableId, base_name: round.baseName, table_name: round.tableName };
      },
    },
    table_schema: {
      access: "manage",
      async run(conn, input, ctx) {
        const picked = selectionFrom(input);
        if (!picked.baseId || !picked.tableId) return fail("Choose a base and table");
        const checked = await schemaFor(conn, picked.baseId.trim(), picked.tableId.trim(), ctx);
        if ("error" in checked) return fail(checked.error);
        return {
          ok: true,
          fields: checked.fields.map((field) => ({
            id: field.id,
            name: field.name,
            type: field.type,
            ...(field.choices ? { choices: field.choices } : {}),
          })),
        };
      },
    },
    get_field_mapping: {
      access: "manage",
      async run(conn, input, ctx) {
        const purpose = mappedPurpose(input.purpose);
        const picked = selectionFrom(input);
        if (!purpose) return fail("Choose a roster or events table");
        const saved = readPurposeSelection(conn.settings, purpose);
        if (!saved.baseId || !saved.tableId) return fail(`Save the ${purpose} table first`);
        if ((picked.baseId && picked.baseId.trim() !== saved.baseId) || (picked.tableId && picked.tableId.trim() !== saved.tableId)) {
          return fail("Save this table before loading its mapping");
        }
        const deps = await resolve(ctx);
        const row = await deps.mappings.get(conn.company_id, purpose, saved.baseId, saved.tableId);
        return { ok: true, mapping: row?.mappings ?? {}, confirmed_at: row?.confirmedAt ?? null, base_id: saved.baseId, table_id: saved.tableId };
      },
    },
    save_field_mapping: {
      access: "manage",
      async run(conn, input, ctx) {
        if (input.confirm !== true) return fail("Confirm the field mapping before saving it");
        const purpose = mappedPurpose(input.purpose);
        const picked = selectionFrom(input);
        if (!purpose || !picked.baseId || !picked.tableId) return fail("Choose a roster or events table");
        const saved = readPurposeSelection(conn.settings, purpose);
        if (picked.baseId.trim() !== saved.baseId || picked.tableId.trim() !== saved.tableId) {
          return fail("Save this table before confirming its mapping");
        }
        const checked = await schemaFor(conn, saved.baseId, saved.tableId, ctx);
        if ("error" in checked) return fail(checked.error);
        const assessment = assessFieldMapping(purpose, input.mapping, checked.fields);
        if (!assessment.ok) return previewBody(assessment, { savedMapping: false });
        const deps = await resolve(ctx);
        const confirmedAt = ctx.now().toISOString();
        await deps.mappings.confirm(conn.company_id, purpose, saved.baseId, saved.tableId, assessment.mapping, confirmedAt);
        const stored = await deps.mappings.get(conn.company_id, purpose, saved.baseId, saved.tableId);
        if (!stored || !sameFieldMap(stored.mappings, assessment.mapping)) return fail("The field mapping was not stored");
        return { ok: true, confirmed_at: stored.confirmedAt, mapping: stored.mappings, unmappedFields: assessment.unmappedFields };
      },
    },
    roster_report: {
      access: "read",
      async run(conn, input, ctx) {
        const deps = await resolve(ctx);
        const stored = (await deps.reports?.latest(conn.company_id, conn.id)) ?? null;
        if (!isRosterDiagnosticReport(stored)) return { ok: true, found: false };
        const limit = Math.min(400, Math.max(1, Number(input.limit) || 400));
        const offset = Math.max(0, Math.min(stored.rows.length, Number(input.offset) || 0));
        return {
          ok: true,
          found: true,
          offset,
          limit,
          report: { ...stored, rows: stored.rows.slice(offset, offset + limit) },
        };
      },
    },
    preview_roster: previewAction("roster", resolve),
    preview_events: previewAction("events", resolve),
    sync_roster: syncAction("roster", resolve),
    sync_events: syncAction("events", resolve),
  };
}

function previewAction(purpose: MappedPurpose, resolve: (ctx: AdapterCtx) => Promise<OpsDeps>): ActionDef {
  return {
    access: "manage",
    async run(conn, input, ctx) {
      const deps = await resolve(ctx);
      if (!(await deps.lastTestOk(conn.company_id))) return fail("Run Test connection before previewing a sync");
      const savedSelection = readPurposeSelection(conn.settings, purpose);
      if (!savedSelection.baseId || !savedSelection.tableId) return fail(`Save the ${purpose} table first`);
      const checked = await schemaFor(conn, savedSelection.baseId, savedSelection.tableId, ctx);
      if ("error" in checked) return fail(checked.error);
      const stored = await deps.mappings.get(conn.company_id, purpose, savedSelection.baseId, savedSelection.tableId);
      const savedAssessment = assessFieldMapping(purpose, stored?.mappings ?? {}, checked.fields);
      const clientMapping = input.mapping && typeof input.mapping === "object" ? assessFieldMapping(purpose, input.mapping, checked.fields).mapping : null;
      const clientMatches = clientMapping == null || sameFieldMap(clientMapping, savedAssessment.mapping);
      const eventDraft = purpose === "events" && clientMapping != null && !clientMatches;
      const assessment = eventDraft ? assessFieldMapping(purpose, clientMapping, checked.fields) : savedAssessment;
      if (!assessment.ok) return previewBody(assessment, { savedMapping: Boolean(stored?.confirmedAt) });
      let fetched: { records: { id?: unknown; fields?: unknown }[]; truncated: boolean; pages: number };
      try {
        fetched = await fetchRecords(savedSelection.baseId, savedSelection.tableId, conn.secrets.access_token, ctx);
      } catch (error) {
        const message = denied(error);
        if (message) return fail(message);
        throw error;
      }
      const interpreted = fetched.records.map((record) => interpretRecord(purpose, record, assessment.mapping, checked.fields));
      const usingDraft = eventDraft;
      const canSync = Boolean(stored?.confirmedAt) && !eventDraft;
      if (purpose === "events") {
        const body = eventPreview(interpreted, await deps.events.listEvents(conn.company_id), fetched.truncated);
        return {
          ...body,
          canSync,
          savedMapping: Boolean(stored?.confirmedAt) && !usingDraft,
          truncated: fetched.truncated,
          mappingProblems: [],
          unmappedFields: assessment.unmappedFields,
          notes: [
            fetched.truncated ? `Only the first ${AIRTABLE_SYNC_MAX_RECORDS} Airtable records were read. Nobody is removed for being absent.` : "People and operations missing from this page are reported and left in place.",
            "Airtable is not changed. Owner and admin roles are not granted or removed.",
            usingDraft ? "This check used the mapping on screen. Save it before syncing." : "Sync uses the confirmed mapping only.",
          ],
        };
      }
      const listed = await deps.roster.listPeople(conn.company_id);
      const identities = await deps.roster.listEmailOwners(interpreted.flatMap((record) => record.values.email ? [record.values.email] : []));
      const body = rosterPreview(interpreted, listed.people, { truncated: fetched.truncated, rosterTruncated: listed.truncated, identities, pages: fetched.pages });
      const partial = fetched.truncated || listed.truncated;
      return {
        ...body,
        canSync,
        savedMapping: Boolean(stored?.confirmedAt) && !usingDraft,
        truncated: partial,
        pages: fetched.pages,
        mappingProblems: [],
        unmappedFields: assessment.unmappedFields,
        notes: [
          partial
            ? `Only the first ${AIRTABLE_SYNC_MAX_RECORDS} Airtable records were read, or the company roster was too large to compare. Nobody is removed from a partial read.`
            : "People in this company who are not in Airtable are removed from the roster, except owners, admins, and managers. Logins are not deleted.",
          "Airtable is not changed. Role and status are not changed.",
          "Rows without a valid email are not added. An already linked Airtable record stays even when its email is blank. Invalid optional values are left unchanged.",
          clientMatches ? "Sync uses the confirmed mapping only." : "The mapping on screen is not the saved mapping. These counts use the saved mapping.",
        ],
      };
    },
  };
}

function rosterNames(interpreted: InterpretedRecord[], people: readonly RosterPerson[]) {
  const namesByRecord = new Map<string, string>();
  for (const row of interpreted) {
    const name = rosterDisplayName(row.values.first_name, row.values.last_name);
    if (name) namesByRecord.set(row.airtableId, name);
  }
  const namesByMembership = new Map(people.map((person) => [person.membershipId, rosterDisplayName(person.firstName, person.lastName)]));
  return { namesByRecord, namesByMembership };
}

function rosterPreview(
  interpreted: InterpretedRecord[],
  people: RosterPerson[],
  opts: { truncated: boolean; rosterTruncated: boolean; identities: readonly RosterIdentity[]; pages: number },
) {
  const plan = planRosterSync(people, interpreted, opts);
  const report = rosterDiagnosticReport({ kind: "preview", plan, pages: opts.pages, ...rosterNames(interpreted, people) });
  return {
    ok: true,
    counts: {
      ...rosterCounts(plan),
      rawRead: plan.read.rawRead,
      seen: plan.read.seen,
      valid: plan.read.valid,
      missingRequired: plan.read.missingRequired,
      duplicate: plan.read.duplicateRecord + plan.read.duplicateEmail,
    },
    read: plan.read,
    report,
    valueProblems: plan.valueProblems.slice(0, 8).map((problem) => ({ code: problem.code, message: problem.message })),
    rows: report.rows.filter((row) => row.op === "conflict").slice(0, 25).map((row) => ({
      airtableId: row.airtableId,
      label: row.reason,
      action: "conflict",
    })),
    planToken: rosterPlanToken(plan),
    removalHold: plan.removalHold,
  };
}

function eventPreview(interpreted: InterpretedRecord[], events: EventLocal[], truncated: boolean) {
  const plan = planEventSync(events, interpreted, { truncated });
  const rows = [
    ...plan.creates.map((row) => ({ airtableId: row.airtableId, label: row.name, action: "create" })),
    ...plan.updates.map((row) => ({ airtableId: row.airtableId, label: row.name, action: "update" })),
    ...plan.conflicts.map((row) => ({ airtableId: row.airtableId, label: row.reason, action: "conflict" })),
    ...plan.skipped.map((row) => ({ airtableId: row.airtableId, label: row.reason, action: "skip" })),
  ].slice(0, 25);
  return { ok: true, counts: eventCounts(plan), valueProblems: plan.valueProblems.slice(0, 50).map((problem) => ({ code: problem.code, message: problem.message })), rows };
}

function syncAction(purpose: MappedPurpose, resolve: (ctx: AdapterCtx) => Promise<OpsDeps>): ActionDef {
  return {
    access: "manage",
    async run(conn, input, ctx) {
      if (input.confirm !== true) return fail("Confirm the sync before it runs");
      const deps = await resolve(ctx);
      if (!(await deps.lastTestOk(conn.company_id))) return fail("Run Test connection before syncing");
      const savedSelection = readPurposeSelection(conn.settings, purpose);
      if (!savedSelection.baseId || !savedSelection.tableId) return fail(`Save the ${purpose} table first`);
      const stored = await deps.mappings.get(conn.company_id, purpose, savedSelection.baseId, savedSelection.tableId);
      if (!stored?.confirmedAt) return fail("Confirm the field mapping before the first sync");
      const checked = await schemaFor(conn, savedSelection.baseId, savedSelection.tableId, ctx);
      if ("error" in checked) return fail(checked.error);
      const assessment = assessFieldMapping(purpose, stored.mappings, checked.fields);
      if (!assessment.ok) return fail(assessment.problems[0]?.message ?? "Field mapping is incomplete");
      let fetched: { records: { id?: unknown; fields?: unknown }[]; truncated: boolean; pages: number };
      try {
        fetched = await fetchRecords(savedSelection.baseId, savedSelection.tableId, conn.secrets.access_token, ctx);
      } catch (error) {
        const message = denied(error);
        if (message) return fail(message);
        throw error;
      }
      const interpreted = fetched.records.map((record) => interpretRecord(purpose, record, assessment.mapping, checked.fields));
      if (purpose === "roster") {
        const listed = await deps.roster.listPeople(conn.company_id);
        const identities = await deps.roster.listEmailOwners(interpreted.flatMap((record) => record.values.email ? [record.values.email] : []));
        const plan = planRosterSync(listed.people, interpreted, { truncated: fetched.truncated, rosterTruncated: listed.truncated, identities });
        const token = rosterPlanToken(plan);
        if (typeof input.plan_token !== "string" || input.plan_token !== token) {
          return {
            ok: false,
            error: "The roster changed after the check. Review the counts and sync again.",
            planToken: token,
            removalHold: plan.removalHold,
            counts: rosterCounts(plan),
            read: plan.read,
            pages: fetched.pages,
            report: rosterDiagnosticReport({ kind: "preview", plan, pages: fetched.pages, ...rosterNames(interpreted, listed.people) }),
          };
        }
        return await applyRoster(deps.roster, conn, savedSelection, plan, fetched.pages, interpreted, listed.people);
      }
      const plan = planEventSync(await deps.events.listEvents(conn.company_id), interpreted, { truncated: fetched.truncated });
      return await applyEvents(deps.events, conn, savedSelection, plan);
    },
  };
}

async function applyRoster(
  store: RosterStore,
  conn: LiveConnection,
  selection: PurposeSelection,
  plan: RosterPlan,
  pages: number,
  interpreted: InterpretedRecord[],
  people: readonly RosterPerson[],
) {
  try {
    const applied = await store.applyPlan({
      companyId: conn.company_id,
      baseId: selection.baseId,
      tableId: selection.tableId,
      plan: rosterSyncPayload(plan),
    });
    const failed = applied.failed ?? { create: 0, attach: 0, link: 0, update: 0, remove: 0 };
    const failures = applied.failures.map((row) => ({ op: row.op, airtableId: row.airtable_id, message: scrubRosterWriteError(row.message) }));
    const report = rosterDiagnosticReport({
      kind: "sync",
      plan,
      pages,
      ...rosterNames(interpreted, people),
      failures,
      writeFailures: failed,
    });
    return {
      ok: true,
      created: applied.created,
      attached: applied.attached,
      linked: applied.linked,
      updated: applied.updated,
      removed: applied.removed,
      failed,
      conflicts: plan.conflicts.length,
      skipped: plan.skipped.length,
      missing: applied.removed,
      held: plan.held.length,
      protected: plan.protected.length,
      truncated: plan.removalHold === "truncated" || plan.removalHold === "roster_truncated",
      read: plan.read,
      pages,
      report,
      errors: failures.map((row) => ({ airtableId: row.airtableId, message: row.message })),
    };
  } catch (error) {
    return fail(error instanceof Error ? error.message.slice(0, 300) : "Roster sync failed");
  }
}

async function applyEvents(
  store: EventStore,
  conn: LiveConnection,
  selection: PurposeSelection,
  plan: ReturnType<typeof planEventSync>,
) {
  const errors: { airtableId: string; message: string }[] = [];
  let created = 0;
  let updated = 0;
  for (const write of plan.creates) {
    if (write.status !== "draft") {
      errors.push({ airtableId: write.airtableId, message: "Airtable cannot set an approval status" });
      continue;
    }
    try {
      await store.createEvent({
        companyId: conn.company_id,
        name: write.name,
        start: write.start,
        end: write.end,
        location: write.location,
        notes: write.notes,
        airtableRecordId: write.airtableId,
        baseId: selection.baseId,
        tableId: selection.tableId,
        hash: write.hash,
      });
      created += 1;
    } catch (error) {
      errors.push({ airtableId: write.airtableId, message: error instanceof Error ? error.message.slice(0, 180) : "Row failed" });
    }
  }
  for (const write of plan.updates) {
    try {
      const result = await store.updateLinked({
        companyId: conn.company_id,
        eventId: write.eventId,
        airtableRecordId: write.airtableId,
        expectedHash: write.previousHash,
        name: write.name,
        start: write.start,
        end: write.end,
        location: write.location,
        notes: write.notes,
        hash: write.hash,
      });
      if (result === "updated") updated += 1;
      else errors.push({ airtableId: write.airtableId, message: "Local operation was left unchanged" });
    } catch (error) {
      errors.push({ airtableId: write.airtableId, message: error instanceof Error ? error.message.slice(0, 180) : "Row failed" });
    }
  }
  return {
    ok: true,
    created,
    updated,
    conflicts: plan.conflicts.length,
    skipped: plan.skipped.length,
    missing: plan.missingFromAirtable.length,
    manual: plan.manualLeftAlone,
    protected: 0,
    errors: errors.slice(0, 25),
  };
}

export function defaultOpsDeps(fallbackTest: (companyId: string) => Promise<boolean>): (ctx: AdapterCtx) => Promise<OpsDeps> {
  return async (ctx) => {
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const roster: RosterStore = {
      async listPeople(companyId) {
        const [{ data: mems, error: memErr }, { data: links, error: linkErr }] = await Promise.all([
          db.from("company_memberships").select("id, user_id, role, status, title, users(email, first_name, last_name, phone)").eq("company_id", companyId).limit(2001),
          db.from("employee_external_ids").select("user_id, external_employee_id").eq("company_id", companyId).eq("provider", "airtable").limit(2001),
        ]);
        if (memErr) throw memErr;
        if (linkErr) throw linkErr;
        const byUser = new Map((links ?? []).map((row) => [(row as { user_id: string }).user_id, (row as { external_employee_id: string }).external_employee_id]));
        const source = (mems ?? []) as Record<string, unknown>[];
        return {
          truncated: source.length > 2000,
          people: source.slice(0, 2000).map((row) => {
            const user = (Array.isArray(row.users) ? row.users[0] : row.users) as { email?: string | null; first_name?: string; last_name?: string; phone?: string | null } | null;
            return {
              membershipId: String(row.id),
              userId: String(row.user_id),
              role: String(row.role ?? "staff").toLowerCase(),
              status: String(row.status ?? "active").toLowerCase(),
              email: user?.email ?? null,
              firstName: user?.first_name ?? "",
              lastName: user?.last_name ?? "",
              phone: user?.phone ?? null,
              title: typeof row.title === "string" ? row.title : null,
              airtableRecordId: byUser.get(String(row.user_id)) ?? null,
            };
          }),
        };
      },
      async listEmailOwners(emails) {
        const unique = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))].slice(0, AIRTABLE_SYNC_MAX_RECORDS);
        if (!unique.length) return [];
        const { data, error } = await db.rpc("airtable_roster_email_owners", { p_emails: unique });
        if (error) {
          const missing = /airtable_roster_email_owners|schema cache|PGRST202/i.test(error.message);
          throw new Error(missing ? "Apply the Airtable roster reconciliation migration before syncing." : error.message.slice(0, 180));
        }
        return ((data ?? []) as { user_id?: string; email?: string }[])
          .filter((row) => row.user_id && row.email)
          .map((row) => ({ userId: String(row.user_id), email: String(row.email) }));
      },
      async applyPlan(row) {
        const header = ctx.callerAuthorization;
        const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        if (!header || !anon || !url) throw new Error("Roster sync is not configured");
        const userClient = createClient(url, anon, {
          global: { headers: { Authorization: header } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await userClient.rpc("apply_airtable_roster_sync", {
          p_company_id: row.companyId,
          p_base_id: row.baseId,
          p_table_id: row.tableId,
          p_plan: row.plan,
        });
        if (error) throw new Error(error.message.slice(0, 300));
        const applied = data as {
          created?: number; attached?: number; linked?: number; updated?: number; removed?: number;
          failed?: { create?: number; attach?: number; link?: number; update?: number; remove?: number };
          failures?: { op?: string; airtable_id?: string; message?: string }[];
        } | null;
        const failed = applied?.failed ?? {};
        return {
          created: applied?.created ?? 0,
          attached: applied?.attached ?? 0,
          linked: applied?.linked ?? 0,
          updated: applied?.updated ?? 0,
          removed: applied?.removed ?? 0,
          failed: {
            create: failed.create ?? 0,
            attach: failed.attach ?? 0,
            link: failed.link ?? 0,
            update: failed.update ?? 0,
            remove: failed.remove ?? 0,
          },
          failures: (applied?.failures ?? [])
            .filter((row) => row.op && row.message)
            .map((row) => ({ op: String(row.op), airtable_id: String(row.airtable_id ?? ""), message: String(row.message) })),
        };
      },
    };
    const events: EventStore = {
      async listEvents(companyId) {
        const { data, error } = await db.from("events").select("id, name, start_date, end_date, location, notes, status, airtable_record_id, airtable_sync_hash").eq("company_id", companyId).limit(2001);
        if (error) throw error;
        return ((data ?? []) as Record<string, unknown>[]).slice(0, 2000).map((row) => ({
          id: String(row.id),
          airtableRecordId: typeof row.airtable_record_id === "string" ? row.airtable_record_id : null,
          name: String(row.name ?? ""),
          startDate: String(row.start_date ?? ""),
          endDate: String(row.end_date ?? ""),
          location: typeof row.location === "string" ? row.location : null,
          notes: typeof row.notes === "string" ? row.notes : null,
          status: String(row.status ?? "draft"),
          syncHash: typeof row.airtable_sync_hash === "string" ? row.airtable_sync_hash : null,
        }));
      },
      async createEvent(row) {
        const { data, error } = await db.from("events").insert({
          id: crypto.randomUUID(),
          company_id: row.companyId,
          name: row.name,
          start_date: row.start,
          end_date: row.end,
          location: row.location ?? null,
          notes: row.notes ?? null,
          status: "draft",
          airtable_record_id: row.airtableRecordId,
          airtable_base_id: row.baseId,
          airtable_table_id: row.tableId,
          airtable_sync_hash: row.hash,
        }).select("id").maybeSingle();
        if (error?.code === "23505") throw new Error("This Airtable event is already linked");
        if (error) throw error;
        const id = (data as { id?: string } | null)?.id;
        if (!id) throw new Error("Event was not created");
        return { id };
      },
      async updateLinked(row) {
        const { data, error } = await db.from("events").update({
          name: row.name,
          start_date: row.start,
          end_date: row.end,
          location: row.location ?? null,
          notes: row.notes ?? null,
          airtable_sync_hash: row.hash,
        }).eq("id", row.eventId).eq("company_id", row.companyId).eq("airtable_record_id", row.airtableRecordId).eq("airtable_sync_hash", row.expectedHash).select("id").maybeSingle();
        if (error) throw error;
        return data ? "updated" : "skipped";
      },
    };
    const mappings: MappingStore = {
      async get(companyId, purpose, baseId, tableId) {
        const { data, error } = await db.from("airtable_field_mappings").select("mappings, confirmed_at").eq("company_id", companyId).eq("purpose", purpose).eq("base_id", baseId).eq("table_id", tableId).maybeSingle();
        if (error) throw error;
        if (!data) return null;
        const row = data as { mappings?: FieldMap; confirmed_at?: string | null };
        return { mappings: row.mappings ?? {}, confirmedAt: row.confirmed_at ?? null };
      },
      async confirm(companyId, purpose, baseId, tableId, mappings, confirmedAt) {
        const { error } = await db.from("airtable_field_mappings").upsert({
          company_id: companyId,
          purpose,
          base_id: baseId,
          table_id: tableId,
          mappings,
          confirmed_at: confirmedAt,
          updated_at: confirmedAt,
        }, { onConflict: "company_id,purpose,base_id,table_id" });
        if (error) throw error;
      },
    };
    const settings: SettingsStore = {
      async save(companyId, connectionId, next) {
        const { data, error } = await db.from("integration_connections").update({ settings: next }).eq("id", connectionId).eq("company_id", companyId).eq("provider", "airtable").select("settings").maybeSingle();
        if (error) throw error;
        return ((data as { settings?: Record<string, unknown> } | null)?.settings ?? {}) as Record<string, unknown>;
      },
    };
    const reports: ReportStore = {
      async latest(companyId, connectionId) {
        const { data, error } = await db.from("audit_logs")
          .select("metadata")
          .eq("company_id", companyId)
          .eq("entity_id", connectionId)
          .in("event_type", ["integration.airtable.preview_roster", "integration.airtable.sync_roster"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) return null;
        const metadata = (data as { metadata?: { report?: unknown } } | null)?.metadata;
        return metadata?.report ?? null;
      },
    };
    return { roster, events, mappings, settings, reports, lastTestOk: fallbackTest };
  };
}
