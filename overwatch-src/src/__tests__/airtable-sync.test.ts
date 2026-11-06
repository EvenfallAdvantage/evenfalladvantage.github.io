import { describe, expect, it } from "vitest";
import {
  assertAirtableCannotGrantRole,
  assessFieldMapping,
  authorizedChoices,
  eventSyncHash,
  interpretRecord,
  mergePurposeSettings,
  planEventSync,
  planRosterSync,
  readSchemaFields,
  schemaTableChoices,
  suggestFieldMapping,
  type EventLocal,
  type RosterPerson,
  type SchemaField,
} from "@/lib/integrations/airtable-sync";

const BASE = "appOPERATIONS1234";
const EMPLOYEES = "tblEMPLOYEES12345";
const EVENTS = "tblEVENTS12345678";
const VENDORS = "tblVENDORS1234567";
const FIRST = "fldFIRSTNAME12345";
const EMAIL = "fldEMAILADDRESS12";
const BADGE = "fldBADGENUMBER123";
const ROLE = "fldROLESELECT1234";
const TITLE = "fldTITLEFIELD1234";

const rosterSchema: SchemaField[] = [
  { id: FIRST, name: "First Name", type: "singleLineText" },
  { id: EMAIL, name: "Email", type: "email" },
  { id: BADGE, name: "Badge Number", type: "number" },
  { id: ROLE, name: "Role", type: "singleSelect", choices: ["Staff", "Admin"] },
  { id: "fldGIVENNAME12345", name: "Given Name", type: "singleLineText" },
];

function person(over: Partial<RosterPerson> = {}): RosterPerson {
  return {
    membershipId: "m1",
    userId: "u1",
    role: "staff",
    status: "active",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    phone: "555",
    title: "Officer",
    airtableRecordId: null,
    ...over,
  };
}

describe("Airtable table list", () => {
  it("keeps every authorized table when one table is already saved", () => {
    const fetched = [
      { id: EMPLOYEES, name: "Employees" },
      { id: EVENTS, name: "Events" },
      { id: VENDORS, name: "Vendors" },
      { id: "not-a-table", name: "skip" },
    ];
    expect(schemaTableChoices(fetched, EMPLOYEES).map((row) => row.name)).toEqual(["Employees", "Events", "Vendors"]);
    expect(authorizedChoices(schemaTableChoices(fetched, EMPLOYEES), EMPLOYEES).map((row) => row.id)).toEqual([EMPLOYEES, EVENTS, VENDORS]);
  });

  it("does not let an Events save replace the Employees selection", () => {
    const current = { base_id: BASE, base_name: "Operations", table_id: EMPLOYEES, table_name: "Employees", roster_table_id: EMPLOYEES, roster_base_id: BASE };
    const merged = mergePurposeSettings(current, "events", { baseId: BASE, baseName: "Operations", tableId: EVENTS, tableName: "Events" });
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(merged.settings.table_id).toBe(EMPLOYEES);
    expect(merged.settings.roster_table_id).toBe(EMPLOYEES);
    expect(merged.settings.events_table_id).toBe(EVENTS);
  });
});

describe("Airtable field mapping", () => {
  it("suggests the same name only and does not map role or an alias", () => {
    const suggested = suggestFieldMapping(rosterSchema, "roster");
    expect(suggested.first_name).toBe(FIRST);
    expect(suggested.email).toBe(EMAIL);
    expect(suggested.title).toBeUndefined();
    expect(Object.values(suggested)).not.toContain(ROLE);
    expect(Object.values(suggested)).not.toContain("fldGIVENNAME12345");
    expect(Object.values(suggested)).not.toContain(BADGE);
  });

  it("blocks a missing required field, a bad type, and a role destination", () => {
    const missing = assessFieldMapping("roster", { first_name: { field_id: FIRST, name: "First Name", type: "singleLineText" } }, rosterSchema);
    expect(missing.ok).toBe(false);
    expect(missing.problems.some((problem) => problem.code === "missing_required" && problem.destination === "email")).toBe(true);

    const badType = assessFieldMapping("roster", {
      first_name: { field_id: BADGE, name: "Badge Number", type: "number" },
      email: { field_id: EMAIL, name: "Email", type: "email" },
    }, rosterSchema);
    expect(badType.problems.some((problem) => problem.code === "incompatible_type")).toBe(true);

    const role = assessFieldMapping("roster", { role: { field_id: ROLE, name: "Role", type: "singleSelect" } }, rosterSchema);
    expect(role.problems.some((problem) => problem.code === "forbidden_destination")).toBe(true);
    expect(role.mapping.role).toBeUndefined();
  });

  it("flags an unrecognized choice and does not treat it as a role", () => {
    const fields = readSchemaFields([
      { id: FIRST, name: "First Name", type: "singleLineText" },
      { id: EMAIL, name: "Email", type: "email" },
      { id: TITLE, name: "Title", type: "singleSelect", options: { choices: [{ name: "Officer" }, { name: "Lead" }] } },
    ]);
    const mapping = {
      first_name: { field_id: FIRST, name: "First Name", type: "singleLineText" },
      email: { field_id: EMAIL, name: "Email", type: "email" },
      title: { field_id: TITLE, name: "Title", type: "singleSelect" },
    };
    const row = interpretRecord("roster", {
      id: "recAAAAAAAAAAAAAA",
      fields: { "First Name": "Ada", Email: "ada@example.com", Title: "Admin" },
    }, mapping, fields);
    expect(row.values.title).toBeUndefined();
    expect(row.problems.map((problem) => problem.code)).toContain("unrecognized_value");
    expect(assertAirtableCannotGrantRole("staff")).toBe("staff");
    expect(() => assertAirtableCannotGrantRole("admin")).toThrow(/cannot create owner, admin/);
  });
});

describe("roster sync plan", () => {
  const mapping = {
    first_name: { field_id: FIRST, name: "First Name", type: "singleLineText" },
    last_name: { field_id: "fldLASTNAME123456", name: "Last Name", type: "singleLineText" },
    email: { field_id: EMAIL, name: "Email", type: "email" },
    phone: { field_id: "fldPHONEFIELD1234", name: "Phone", type: "phoneNumber" },
    title: { field_id: TITLE, name: "Title", type: "singleLineText" },
  };
  const schema: SchemaField[] = Object.values(mapping).map((field) => ({ id: field.field_id, name: field.name, type: field.type }));

  function incoming(id: string, fields: Record<string, string>) {
    return interpretRecord("roster", { id, fields }, mapping, schema);
  }

  it("creates two people who share a name and keeps the count stable on the next sync", () => {
    const rows = [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Alex", "Last Name": "Kim", Email: "alex.one@example.com", Phone: "111" }),
      incoming("recBBBBBBBBBBBBBB", { "First Name": "Alex", "Last Name": "Kim", Email: "alex.two@example.com" }),
    ];
    const first = planRosterSync([], rows, { truncated: false });
    expect(first.creates.map((row) => row.email)).toEqual(["alex.one@example.com", "alex.two@example.com"]);
    expect(first.creates.every((row) => row.role === "staff")).toBe(true);
    const locals = first.creates.map((row, index) => person({
      membershipId: `m${index}`,
      userId: `u${index}`,
      email: row.email,
      firstName: row.firstName ?? "",
      airtableRecordId: row.airtableId,
      phone: row.phone ?? null,
    }));
    const second = planRosterSync(locals, rows, { truncated: false });
    expect(second.creates).toEqual([]);
    expect(locals.length + second.creates.length).toBe(locals.length);
  });

  it("links one legacy email and refuses a protected or ambiguous email", () => {
    const rows = [incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com", Phone: "999" })];
    const linked = planRosterSync([person({ phone: "" })], rows, { truncated: false });
    expect(linked.links).toHaveLength(1);
    expect(linked.links[0]?.membershipId).toBe("m1");
    expect(linked.links[0]?.phone).toBe("999");
    expect(linked.creates).toEqual([]);

    const owner = planRosterSync([person({ role: "owner" })], rows, { truncated: false });
    expect(owner.creates).toEqual([]);
    expect(owner.links).toEqual([]);
    expect(owner.protected.map((row) => row.role)).toEqual(["owner"]);
    expect(JSON.stringify(owner)).not.toContain('"role":"staff"');

    const ambiguous = planRosterSync([
      person({ membershipId: "m1", email: "ada@example.com" }),
      person({ membershipId: "m2", userId: "u2", email: "ada@example.com" }),
    ], rows, { truncated: false });
    expect(ambiguous.creates).toEqual([]);
    expect(ambiguous.links).toEqual([]);
    expect(ambiguous.conflicts[0]?.reason).toBe("email_matches_multiple_people");
  });

  it("does not demote a linked owner, clear a blank phone, or delete a missing person", () => {
    const local = person({ role: "admin", airtableRecordId: "recAAAAAAAAAAAAAA", phone: "555" });
    const plan = planRosterSync([local], [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com", Title: "Captain" }),
    ], { truncated: false });
    expect(plan.updates[0]?.protectedRole).toBe(true);
    expect(plan.updates[0]?.title).toBe("Captain");
    expect(plan.updates[0]?.phone).toBeUndefined();
    expect(Object.keys(plan.updates[0] ?? {})).not.toContain("role");
    expect(Object.keys(plan.updates[0] ?? {})).not.toContain("status");

    const missing = planRosterSync([
      local,
      person({ membershipId: "m9", userId: "u9", airtableRecordId: "recCCCCCCCCCCCCCC", role: "owner" }),
    ], [incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" })], { truncated: false });
    expect(missing.missingFromAirtable.map((row) => row.membershipId)).toEqual(["m9"]);
    expect(JSON.stringify(missing)).not.toContain("delete");
    const hidden = planRosterSync([
      person({ membershipId: "m9", userId: "u9", airtableRecordId: "recCCCCCCCCCCCCCC" }),
    ], [], { truncated: true });
    expect(hidden.missingFromAirtable).toEqual([]);
  });
});

describe("event sync plan", () => {
  const start = "fldSTARTDATE12345";
  const end = "fldENDDATE1234567";
  const title = "fldEVENTTITLE1234";
  const where = "fldLOCATION123456";
  const notes = "fldNOTESFIELD1234";
  const mapping = {
    title: { field_id: title, name: "Title", type: "singleLineText" },
    start: { field_id: start, name: "Start", type: "dateTime" },
    end: { field_id: end, name: "End", type: "dateTime" },
    location: { field_id: where, name: "Location", type: "singleLineText" },
    notes: { field_id: notes, name: "Notes", type: "multilineText" },
  };
  const schema: SchemaField[] = [
    ...Object.values(mapping).map((field) => ({ id: field.field_id, name: field.name, type: field.type })),
    { id: "fldSTATUSFIELD123", name: "Status", type: "singleSelect", choices: ["Approved"] },
  ];

  it("creates a draft, skips a manual event with the same title, and does not repeat", () => {
    const row = interpretRecord("events", {
      id: "recAAAAAAAAAAAAAA",
      fields: { Title: "Night watch", Start: "2026-12-01T18:00:00.000Z", End: "2026-12-01T22:00:00.000Z", Location: "Gate", Notes: "Bring lights", Status: "Approved" },
    }, mapping, schema);
    const manual: EventLocal = {
      id: "manual",
      airtableRecordId: null,
      name: "Night watch",
      startDate: "2026-12-01T18:00:00.000Z",
      endDate: "2026-12-01T22:00:00.000Z",
      location: "Gate",
      notes: null,
      status: "published",
      syncHash: null,
    };
    const first = planEventSync([manual], [row], { truncated: false });
    expect(first.creates).toHaveLength(1);
    expect(first.creates[0]?.status).toBe("draft");
    expect(first.updates).toEqual([]);
    expect(first.manualLeftAlone).toBe(1);
    expect(first.creates[0] && Object.keys(first.creates[0])).not.toContain("approved");
    const stored: EventLocal = {
      id: "ev1",
      airtableRecordId: "recAAAAAAAAAAAAAA",
      name: "Night watch",
      startDate: "2026-12-01T18:00:00.000Z",
      endDate: "2026-12-01T22:00:00.000Z",
      location: "Gate",
      notes: "Bring lights",
      status: "draft",
      syncHash: first.creates[0]?.hash ?? "",
    };
    const second = planEventSync([manual, stored], [row], { truncated: false });
    expect(second.creates).toEqual([]);
    expect(second.unchanged).toEqual(["recAAAAAAAAAAAAAA"]);
    stored.name = "Night watch edited";
    const conflict = planEventSync([stored], [row], { truncated: false });
    expect(conflict.updates).toEqual([]);
    expect(conflict.conflicts[0]?.reason).toBe("locally_modified");
    expect(eventSyncHash({ name: "Night watch", start: stored.startDate, end: stored.endDate, location: "Gate", notes: "Bring lights" })).toBe(first.creates[0]?.hash);
  });

  it("leaves an unsupported column out of the write", () => {
    const assessment = assessFieldMapping("events", mapping, schema);
    expect(assessment.unmappedFields).toContain("Status");
    expect(assessment.mapping.status).toBeUndefined();
  });
});
