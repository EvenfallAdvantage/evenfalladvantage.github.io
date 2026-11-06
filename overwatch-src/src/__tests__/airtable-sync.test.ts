import { describe, expect, it } from "vitest";
import {
  AIRTABLE_SYNC_MAX_RECORDS,
  assertAirtableCannotGrantRole,
  assessFieldMapping,
  authorizedChoices,
  eventSyncHash,
  interpretRecord,
  mergePurposeSettings,
  planEventSync,
  planRosterSync,
  readSchemaFields,
  rosterConfirmDescription,
  rosterCounts,
  rosterPlanToken,
  rosterSyncPayload,
  sameFieldMap,
  schemaTableChoices,
  suggestFieldMapping,
  takeAirtableRecords,
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

  it("does not demote a linked owner or clear a blank phone", () => {
    const local = person({ role: "admin", airtableRecordId: "recAAAAAAAAAAAAAA", phone: "555" }); // gitleaks:allow
    const plan = planRosterSync([local], [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com", Title: "Captain" }),
    ], { truncated: false });
    expect(plan.updates[0]?.protectedRole).toBe(true);
    expect(plan.updates[0]?.title).toBe("Captain");
    expect(plan.updates[0]?.phone).toBeUndefined();
    expect(Object.keys(plan.updates[0] ?? {})).not.toContain("role");
    expect(Object.keys(plan.updates[0] ?? {})).not.toContain("status");
    expect(Object.keys(plan.updates[0] ?? {})).not.toContain("email");
    expect(plan.protected.map((row) => row.reason)).toEqual(["role_unchanged"]);
    expect(plan.removals).toEqual([]);
  });

  it("resolves duplicate source emails the same way regardless of order", () => {
    const upper = incoming("recBBBBBBBBBBBBBB", { "First Name": "Ada", "Last Name": "L", Email: "Ada@Example.com" });
    const lower = incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" });
    const forward = planRosterSync([], [lower, upper], { truncated: false });
    const reverse = planRosterSync([], [upper, lower], { truncated: false });
    expect(forward.creates.map((row) => row.airtableId)).toEqual(["recAAAAAAAAAAAAAA"]);
    expect(reverse.creates.map((row) => row.airtableId)).toEqual(["recAAAAAAAAAAAAAA"]);
    expect(forward.conflicts.map((row) => row.airtableId)).toEqual(["recBBBBBBBBBBBBBB"]);
    expect(reverse.conflicts).toEqual(forward.conflicts);
    expect(forward.removalHold).toBe("conflicts");
    expect(rosterPlanToken(forward)).toBe(rosterPlanToken(reverse));
    expect(forward.read.rawRead).toBe(2);
    expect(forward.read.invalidId + forward.read.duplicateRecord + forward.read.seen).toBe(forward.read.rawRead);
    expect(forward.read.valid).toBe(1);
    expect(forward.read.duplicateEmail).toBe(1);
    expect(forward.read.conflict).toBe(1);
    expect(forward.read.remove).toBe(0);
  });

  it("keeps a linked record with a blank email and holds removals when a duplicate email conflicts", () => {
    const linked = planRosterSync([
      person({ membershipId: "m-linked", userId: "u-linked", email: null, phone: "555", airtableRecordId: "recAAAAAAAAAAAAAA" }), // gitleaks:allow
      person({ membershipId: "m-none", userId: "u-none", email: null, airtableRecordId: null, role: "staff" }),
    ], [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "", Phone: "no-digits", Title: "Captain" }),
      incoming("recBBBBBBBBBBBBBB", { "First Name": "Blank", Email: " " }),
    ], { truncated: false });
    expect(linked.creates).toEqual([]);
    expect(linked.attaches).toEqual([]);
    expect(linked.skipped.map((row) => row.reason)).toEqual(["missing_email"]);
    expect(linked.updates.map((row) => row.membershipId)).toEqual(["m-linked"]);
    expect(linked.updates[0]?.title).toBe("Captain");
    expect(linked.updates[0]?.phone).toBeUndefined();
    expect(Object.keys(linked.updates[0] ?? {})).not.toContain("email");
    expect(linked.removals.map((row) => row.membershipId)).toEqual(["m-none"]);

    const duplicated = planRosterSync([
      person({ membershipId: "m1", userId: "u1", email: "ada@example.com" }),
      person({ membershipId: "m-other", userId: "u-other", email: "other@example.com", role: "staff" }),
    ], [
      incoming("recBBBBBBBBBBBBBB", { "First Name": "Ada", "Last Name": "L", Email: "Ada@Example.com" }),
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" }),
    ], { truncated: false });
    expect(duplicated.links.map((row) => row.membershipId)).toEqual(["m1"]);
    expect(duplicated.conflicts.map((row) => row.reason)).toEqual(["duplicate_email_in_airtable"]);
    expect(duplicated.removals).toEqual([]);
    expect(duplicated.held.map((row) => row.membershipId)).toEqual(["m-other"]);
    expect(duplicated.removalHold).toBe("conflicts");
    expect(rosterConfirmDescription(rosterCounts(linked), { truncated: false, removalHold: linked.removalHold })).toMatch(/not added/);
  });

  it("keeps a linked person with the same email and attaches someone from another company", () => {
    const linked = planRosterSync([
      person({ airtableRecordId: "recAAAAAAAAAAAAAA", email: "ada@example.com" }), // gitleaks:allow
    ], [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "Lovelace", Email: "Ada@Example.com", Phone: "555" }),
    ], { truncated: false });
    expect(linked.conflicts).toEqual([]);
    expect(linked.creates).toEqual([]);
    expect(linked.updates).toEqual([]);
    expect(linked.unchanged).toEqual(["recAAAAAAAAAAAAAA"]);
    expect(linked.removals).toEqual([]);

    const other = planRosterSync([], [
      incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com", Title: "Officer" }),
    ], { truncated: false, identities: [{ userId: "u-other", email: "ADA@example.com" }] });
    expect(other.creates).toEqual([]);
    expect(other.attaches).toEqual([expect.objectContaining({ userId: "u-other", email: "ada@example.com", role: "staff", title: "Officer" })]);
    expect(other.attaches[0] && Object.keys(other.attaches[0])).not.toContain("firstName");
    expect(rosterSyncPayload(other).attaches[0]).toEqual({
      airtable_id: "recAAAAAAAAAAAAAA",
      user_id: "u-other",
      email: "ada@example.com",
      title: "Officer",
    });
  });

  it("does not merge duplicate identities and conflicts when another account owns the email", () => {
    const duplicates = planRosterSync([
      person({ membershipId: "m1", userId: "u1", email: "ada@example.com" }),
      person({ membershipId: "m2", userId: "u2", email: "Ada@example.com" }),
    ], [incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" })], { truncated: false });
    expect(duplicates.creates).toEqual([]);
    expect(duplicates.links).toEqual([]);
    expect(duplicates.attaches).toEqual([]);
    expect(duplicates.conflicts[0]?.reason).toBe("email_matches_multiple_people");
    expect(duplicates.removals).toEqual([]);
    expect(duplicates.held.map((row) => row.membershipId)).toEqual([]);

    const owned = planRosterSync([
      person({ membershipId: "m1", userId: "u1", airtableRecordId: "recAAAAAAAAAAAAAA", email: "ada@example.com" }), // gitleaks:allow
    ], [incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" })], {
      truncated: false,
      identities: [{ userId: "u-other", email: "ada@example.com" }],
    });
    expect(owned.updates).toEqual([]);
    expect(owned.conflicts[0]?.reason).toBe("email_owned_by_other_user");
    expect(owned.removals).toEqual([]);
  });

  it("preserves owner, admin, and manager and still removes other absent people", () => {
    const incomingRow = incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com" });
    const present = person({ membershipId: "m1", userId: "u1", email: "ada@example.com", airtableRecordId: "recAAAAAAAAAAAAAA" }); // gitleaks:allow
    for (const role of ["owner", "admin", "manager"] as const) {
      const plan = planRosterSync([
        person({ membershipId: "m-protected", userId: "u-protected", role, email: `${role}@example.com`, status: "active" }),
        person({ membershipId: "m-manual", userId: "u-manual", role: "staff", email: "manual@example.com", airtableRecordId: null, status: "inactive" }),
        person({ membershipId: "m-linked", userId: "u-linked", role: "lead", email: "linked@example.com", airtableRecordId: "recCCCCCCCCCCCCCC", status: "active" }), // gitleaks:allow
        present,
      ], [incomingRow], { truncated: false });
      expect(plan.removals.map((row) => row.membershipId).sort()).toEqual(["m-linked", "m-manual"]);
      expect(plan.removals.every((row) => row.role !== role)).toBe(true);
      expect(plan.protected.some((row) => row.membershipId === "m-protected" && row.reason === "absent_preserved")).toBe(true);
      expect(plan.removalHold).toBeNull();
      const payload = JSON.stringify(rosterSyncPayload(plan));
      expect(payload).not.toContain("m-protected");
      expect(payload).not.toContain('"role"');
      expect(payload).not.toContain('"status"');
      expect(payload).not.toContain(`${role}@example.com`);
    }
  });

  it("does not change status for an inactive person who is still in Airtable", () => {
    const plan = planRosterSync([
      person({ status: "inactive", phone: "", airtableRecordId: null }),
    ], [incoming("recAAAAAAAAAAAAAA", { "First Name": "Ada", "Last Name": "L", Email: "ada@example.com", Phone: "999", Title: "Officer" })], { truncated: false });
    expect(plan.links).toHaveLength(1);
    expect(Object.keys(plan.links[0] ?? {})).not.toContain("status");
    expect(Object.keys(plan.links[0] ?? {})).not.toContain("role");
    expect(plan.removals).toEqual([]);
  });

  it("removes regular people from an empty table and removes nobody from a partial read", () => {
    const staff = person({ membershipId: "m-staff", userId: "u-staff", email: "staff@example.com", role: "staff" });
    const owner = person({ membershipId: "m-owner", userId: "u-owner", email: "owner@example.com", role: "owner" });
    const empty = planRosterSync([staff, owner], [], { truncated: false });
    expect(empty.removals.map((row) => row.membershipId)).toEqual(["m-staff"]);
    expect(empty.protected.map((row) => row.membershipId)).toEqual(["m-owner"]);
    expect(empty.removalHold).toBeNull();

    const partial = planRosterSync([staff, owner], [], { truncated: true });
    expect(partial.removals).toEqual([]);
    expect(partial.held).toEqual([]);
    expect(partial.missingFromAirtable).toEqual([]);
    expect(partial.removalHold).toBe("truncated");
    expect(rosterConfirmDescription(rosterCounts(partial), { truncated: true, removalHold: partial.removalHold })).toMatch(/nobody is removed/i);

    const capped = planRosterSync([staff], [], { truncated: false, rosterTruncated: true });
    expect(capped.removals).toEqual([]);
    expect(capped.removalHold).toBe("roster_truncated");
  });
});

describe("Airtable record pages", () => {
  it("reads a 597 row Employees table inside the 1000 cap and still blocks a partial page", () => {
    expect(AIRTABLE_SYNC_MAX_RECORDS).toBe(1000);
    const full = [
      ...Array.from({ length: 5 }, (_, page) => ({ records: Array.from({ length: 100 }, (_, i) => page * 100 + i), offset: `p${page + 1}` })),
      { records: Array.from({ length: 97 }, (_, i) => 500 + i) },
    ];
    const read = takeAirtableRecords(full);
    expect(read.records).toHaveLength(597);
    expect(read.truncated).toBe(false);
    const over = takeAirtableRecords(Array.from({ length: 11 }, () => ({ records: Array.from({ length: 100 }, () => 1), offset: "more" })));
    expect(over.records).toHaveLength(1000);
    expect(over.truncated).toBe(true);
  });

  it("keeps paging until the cap and treats a leftover offset as truncated", () => {
    const page = (n: number, offset?: string) => ({ records: Array.from({ length: n }, (_, i) => i), offset });
    const complete = takeAirtableRecords([page(100, "p2"), page(20)], 300);
    expect(complete.records).toHaveLength(120);
    expect(complete.truncated).toBe(false);
    const capped = takeAirtableRecords([page(100, "p2"), page(100, "p3"), page(100, "p4"), page(100, "p5")], 300);
    expect(capped.records).toHaveLength(300);
    expect(capped.truncated).toBe(true);
    const stopped = takeAirtableRecords([page(50, "still-more")], 300);
    expect(stopped.truncated).toBe(true);
    expect(takeAirtableRecords([], 300)).toEqual({ records: [], truncated: false });
  });
});

describe("saved field map", () => {
  it("treats a different on-screen field as not the saved mapping", () => {
    const saved = { email: { field_id: "fldEMAILADDRESS12", name: "Email", type: "email" } };
    expect(sameFieldMap(saved, { email: { field_id: "fldEMAILADDRESS12", name: "Email", type: "singleLineText" } })).toBe(true);
    expect(sameFieldMap(saved, { email: { field_id: "fldOTHERFIELD1234", name: "Email", type: "email" } })).toBe(false);
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
      airtableRecordId: "recAAAAAAAAAAAAAA", // gitleaks:allow
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
