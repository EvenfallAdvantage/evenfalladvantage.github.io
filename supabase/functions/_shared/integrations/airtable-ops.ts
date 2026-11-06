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
  PROTECTED_ROLES,
  readPurposeSelection,
  readSchemaFields,
  rosterCounts,
  schemaBaseChoices,
  schemaTableChoices,
  assertRosterWrite,
  assertAirtableCannotGrantRole,
  type AirtablePurpose,
  type EventLocal,
  type FieldMap,
  type InterpretedRecord,
  type MappedPurpose,
  type MappingAssessment,
  type PurposeSelection,
  type RosterPerson,
  type RosterWrite,
  type SchemaField,
} from "../../../../overwatch-src/src/lib/integrations/airtable-sync.ts";

const API = "https://api.airtable.com/v0";

export interface RosterStore {
  listPeople(companyId: string): Promise<RosterPerson[]>;
  createStaff(row: {
    companyId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    title?: string;
    airtableRecordId: string;
    baseId: string;
    tableId: string;
  }, ctx: AdapterCtx): Promise<{ membershipId: string; userId: string }>;
  linkExisting(row: {
    companyId: string;
    membershipId: string;
    userId: string;
    airtableRecordId: string;
    baseId: string;
    tableId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    title?: string;
  }): Promise<void>;
  updateLinked(row: {
    companyId: string;
    membershipId: string;
    userId: string;
    airtableRecordId: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    title?: string;
  }): Promise<void>;
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

export interface OpsDeps {
  roster: RosterStore;
  events: EventStore;
  mappings: MappingStore;
  settings: SettingsStore;
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

export async function fetchRecords(baseId: string, tableId: string, token: string | undefined, ctx: AdapterCtx): Promise<{ records: { id?: unknown; fields?: unknown }[]; truncated: boolean }> {
  const records: { id?: unknown; fields?: unknown }[] = [];
  const seen = new Set<string>();
  let offset: string | undefined;
  let truncated = false;
  for (let page = 0; page < 5; page++) {
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
    records.push(...(data.records ?? []));
    if (!data.offset || records.length >= AIRTABLE_SYNC_MAX_RECORDS) {
      truncated = Boolean(data.offset) || records.length > AIRTABLE_SYNC_MAX_RECORDS;
      break;
    }
    offset = data.offset;
  }
  return { records: records.slice(0, AIRTABLE_SYNC_MAX_RECORDS), truncated };
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
        if (!purpose || !picked.baseId || !picked.tableId) return fail("Choose a roster or events table");
        const deps = await resolve(ctx);
        const row = await deps.mappings.get(conn.company_id, purpose, picked.baseId.trim(), picked.tableId.trim());
        return { ok: true, mapping: row?.mappings ?? {}, confirmed_at: row?.confirmedAt ?? null };
      },
    },
    save_field_mapping: {
      access: "manage",
      async run(conn, input, ctx) {
        if (input.confirm !== true) return fail("Confirm the field mapping before saving it");
        const purpose = mappedPurpose(input.purpose);
        const picked = selectionFrom(input);
        if (!purpose || !picked.baseId || !picked.tableId) return fail("Choose a roster or events table");
        const checked = await schemaFor(conn, picked.baseId.trim(), picked.tableId.trim(), ctx);
        if ("error" in checked) return fail(checked.error);
        const assessment = assessFieldMapping(purpose, input.mapping, checked.fields);
        if (!assessment.ok) return previewBody(assessment, { savedMapping: false });
        const deps = await resolve(ctx);
        const confirmedAt = ctx.now().toISOString();
        await deps.mappings.confirm(conn.company_id, purpose, picked.baseId.trim(), picked.tableId.trim(), assessment.mapping, confirmedAt);
        return { ok: true, confirmed_at: confirmedAt, mapping: assessment.mapping, unmappedFields: assessment.unmappedFields };
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
      const proposed = input.mapping && typeof input.mapping === "object" ? input.mapping : stored?.mappings;
      const assessment = assessFieldMapping(purpose, proposed ?? {}, checked.fields);
      if (!assessment.ok) return previewBody(assessment, { savedMapping: Boolean(stored?.confirmedAt) });
      let fetched: { records: { id?: unknown; fields?: unknown }[]; truncated: boolean };
      try {
        fetched = await fetchRecords(savedSelection.baseId, savedSelection.tableId, conn.secrets.access_token, ctx);
      } catch (error) {
        const message = denied(error);
        if (message) return fail(message);
        throw error;
      }
      const interpreted = fetched.records.map((record) => interpretRecord(purpose, record, assessment.mapping, checked.fields));
      const body = purpose === "roster"
        ? rosterPreview(interpreted, await deps.roster.listPeople(conn.company_id), fetched.truncated)
        : eventPreview(interpreted, await deps.events.listEvents(conn.company_id), fetched.truncated);
      const usingDraft = Boolean(input.mapping);
      const canSync = Boolean(stored?.confirmedAt) && !usingDraft;
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
    },
  };
}

function rosterPreview(interpreted: InterpretedRecord[], people: RosterPerson[], truncated: boolean) {
  const plan = planRosterSync(people, interpreted, { truncated });
  const rows = [
    ...plan.creates.map((row) => ({ airtableId: row.airtableId, label: row.email, action: "create" })),
    ...plan.links.map((row) => ({ airtableId: row.airtableId, label: row.membershipId, action: "link" })),
    ...plan.updates.map((row) => ({ airtableId: row.airtableId, label: row.membershipId, action: row.protectedRole ? "update_protected" : "update" })),
    ...plan.conflicts.map((row) => ({ airtableId: row.airtableId, label: row.reason, action: "conflict" })),
    ...plan.skipped.map((row) => ({ airtableId: row.airtableId, label: row.reason, action: "skip" })),
  ].slice(0, 25);
  return { ok: true, counts: rosterCounts(plan), valueProblems: plan.valueProblems.slice(0, 50).map((problem) => ({ code: problem.code, message: problem.message })), rows };
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
      let fetched: { records: { id?: unknown; fields?: unknown }[]; truncated: boolean };
      try {
        fetched = await fetchRecords(savedSelection.baseId, savedSelection.tableId, conn.secrets.access_token, ctx);
      } catch (error) {
        const message = denied(error);
        if (message) return fail(message);
        throw error;
      }
      const interpreted = fetched.records.map((record) => interpretRecord(purpose, record, assessment.mapping, checked.fields));
      if (purpose === "roster") {
        const plan = planRosterSync(await deps.roster.listPeople(conn.company_id), interpreted, { truncated: fetched.truncated });
        return await applyRoster(deps.roster, conn, savedSelection, plan, ctx);
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
  plan: ReturnType<typeof planRosterSync>,
  ctx: AdapterCtx,
) {
  const errors: { airtableId: string; message: string }[] = [];
  let created = 0;
  let linked = 0;
  let updated = 0;
  const run = async (write: RosterWrite, op: () => Promise<void>) => {
    try {
      assertRosterWrite(write);
      if (write.kind === "create") assertAirtableCannotGrantRole(write.role);
      await op();
      if (write.kind === "create") created += 1;
      else if (write.kind === "link") linked += 1;
      else updated += 1;
    } catch (error) {
      errors.push({ airtableId: write.airtableId, message: error instanceof Error ? error.message.slice(0, 180) : "Row failed" });
    }
  };
  for (const write of plan.creates) {
    await run(write, () => store.createStaff({
      companyId: conn.company_id,
      firstName: write.firstName ?? "Team member",
      lastName: write.lastName ?? "",
      email: write.email,
      phone: write.phone,
      title: write.title,
      airtableRecordId: write.airtableId,
      baseId: selection.baseId,
      tableId: selection.tableId,
    }, ctx).then(() => undefined));
  }
  for (const write of plan.links) {
    await run(write, () => store.linkExisting({
      companyId: conn.company_id,
      membershipId: write.membershipId,
      userId: write.userId,
      airtableRecordId: write.airtableId,
      baseId: selection.baseId,
      tableId: selection.tableId,
      firstName: write.firstName,
      lastName: write.lastName,
      phone: write.phone,
      title: write.title,
    }));
  }
  for (const write of plan.updates) {
    await run(write, () => store.updateLinked({
      companyId: conn.company_id,
      membershipId: write.membershipId,
      userId: write.userId,
      airtableRecordId: write.airtableId,
      firstName: write.firstName,
      lastName: write.lastName,
      phone: write.phone,
      title: write.title,
    }));
  }
  return {
    ok: true,
    created,
    linked,
    updated,
    conflicts: plan.conflicts.length,
    skipped: plan.skipped.length,
    missing: plan.missingFromAirtable.length,
    protected: plan.protected.length,
    truncated: false,
    errors: errors.slice(0, 25),
  };
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
          db.from("company_memberships").select("id, user_id, role, status, title, users(email, first_name, last_name, phone)").eq("company_id", companyId).limit(2000),
          db.from("employee_external_ids").select("user_id, external_employee_id").eq("company_id", companyId).eq("provider", "airtable").limit(2000),
        ]);
        if (memErr) throw memErr;
        if (linkErr) throw linkErr;
        const byUser = new Map((links ?? []).map((row) => [(row as { user_id: string }).user_id, (row as { external_employee_id: string }).external_employee_id]));
        return ((mems ?? []) as Record<string, unknown>[]).map((row) => {
          const user = (Array.isArray(row.users) ? row.users[0] : row.users) as { email?: string | null; first_name?: string; last_name?: string; phone?: string | null } | null;
          return {
            membershipId: String(row.id),
            userId: String(row.user_id),
            role: String(row.role ?? "staff"),
            status: String(row.status ?? "active"),
            email: user?.email ?? null,
            firstName: user?.first_name ?? "",
            lastName: user?.last_name ?? "",
            phone: user?.phone ?? null,
            title: typeof row.title === "string" ? row.title : null,
            airtableRecordId: byUser.get(String(row.user_id)) ?? null,
          };
        });
      },
      async createStaff(row, callCtx) {
        assertAirtableCannotGrantRole("staff");
        const email = row.email.trim().toLowerCase();
        const { data: existingUsers, error: userErr } = await db.from("users").select("id").ilike("email", email).limit(2);
        if (userErr) throw userErr;
        const userId = (existingUsers ?? [])[0] as { id?: string } | undefined;
        if (userId?.id) {
          const { data: mem, error: memErr } = await db.from("company_memberships").select("id, role").eq("company_id", row.companyId).eq("user_id", userId.id).maybeSingle();
          if (memErr) throw memErr;
          if (mem && PROTECTED_ROLES.has(String((mem as { role?: string }).role))) {
            throw new Error("Airtable cannot change an owner or admin");
          }
          if (mem) throw new Error("This person is already on the roster");
        }
        const header = callCtx.callerAuthorization;
        const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const url = Deno.env.get("SUPABASE_URL") ?? "";
        if (!header || !anon || !url) throw new Error("Roster sync is not configured");
        const userClient = createClient(url, anon, {
          global: { headers: { Authorization: header } },
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data, error } = await userClient.rpc("create_roster_member", {
          p_company_id: row.companyId,
          p_first_name: row.firstName,
          p_last_name: row.lastName,
          p_email: email,
          p_phone: row.phone ?? null,
          p_role: "staff",
        });
        if (error) throw new Error(error.message.slice(0, 180));
        const created = data as { user_id?: string; membership_id?: string; existing_user?: boolean } | null;
        if (!created?.membership_id || !created.user_id) throw new Error("Roster member was not created");
        const { data: roleRow, error: roleErr } = await db.from("company_memberships").select("role").eq("id", created.membership_id).eq("company_id", row.companyId).maybeSingle();
        if (roleErr) throw roleErr;
        if (PROTECTED_ROLES.has(String((roleRow as { role?: string } | null)?.role))) {
          throw new Error("Airtable cannot change an owner or admin");
        }
        const { error: linkErr } = await db.from("employee_external_ids").insert({
          company_id: row.companyId,
          user_id: created.user_id,
          provider: "airtable",
          external_employee_id: row.airtableRecordId,
          match_method: "import",
        });
        if (linkErr && linkErr.code !== "23505") throw linkErr;
        if (row.title) {
          const { error: titleErr } = await db.from("company_memberships").update({ title: row.title }).eq("id", created.membership_id).eq("company_id", row.companyId);
          if (titleErr) throw titleErr;
        }
        return { membershipId: created.membership_id, userId: created.user_id };
      },
      async linkExisting(row) {
        const { data: mem, error } = await db.from("company_memberships").select("role, user_id, title").eq("id", row.membershipId).eq("company_id", row.companyId).maybeSingle();
        if (error) throw error;
        const role = String((mem as { role?: string } | null)?.role ?? "");
        if (!mem || (mem as { user_id?: string }).user_id !== row.userId) throw new Error("Roster member was not found");
        if (PROTECTED_ROLES.has(role)) throw new Error("Airtable cannot change an owner or admin");
        const { error: linkErr } = await db.from("employee_external_ids").insert({
          company_id: row.companyId,
          user_id: row.userId,
          provider: "airtable",
          external_employee_id: row.airtableRecordId,
          match_method: "email",
        });
        if (linkErr && linkErr.code !== "23505") throw linkErr;
        await patchPerson(row.companyId, row.membershipId, row.userId, row);
      },
      async updateLinked(row) {
        const { data: link, error } = await db.from("employee_external_ids").select("external_employee_id").eq("company_id", row.companyId).eq("user_id", row.userId).eq("provider", "airtable").maybeSingle();
        if (error) throw error;
        if ((link as { external_employee_id?: string } | null)?.external_employee_id !== row.airtableRecordId) {
          throw new Error("Airtable record is not linked to this person");
        }
        await patchPerson(row.companyId, row.membershipId, row.userId, row);
      },
    };
    async function patchPerson(companyId: string, membershipId: string, userId: string, set: { firstName?: string; lastName?: string; phone?: string; title?: string }) {
      const userPatch: Record<string, string> = {};
      if (set.firstName) userPatch.first_name = set.firstName;
      if (set.lastName) userPatch.last_name = set.lastName;
      if (set.phone) userPatch.phone = set.phone;
      if (Object.keys(userPatch).length) {
        const { error } = await db.from("users").update(userPatch).eq("id", userId);
        if (error) throw error;
      }
      if (set.title) {
        const { error } = await db.from("company_memberships").update({ title: set.title }).eq("id", membershipId).eq("company_id", companyId);
        if (error) throw error;
      }
    }
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
    return { roster, events, mappings, settings, lastTestOk: fallbackTest };
  };
}
