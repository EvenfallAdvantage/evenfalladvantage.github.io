/**
 * Isolated local Postgres proof for the roster phone migration.
 * Applies 20261106223000, then 20261106234500, against the fixture schema.
 * Does not connect to production.
 *
 *   node supabase/tests/airtable_roster_phone_it.mjs
 * Requires local Postgres and database ow_phone_it owned by the OS user.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import pg from "pg";

const { Client } = pg;
const root = dirname(fileURLToPath(import.meta.url));
const migDir = join(root, "../migrations");
const COMPANY = "10000000-0000-0000-0000-000000000001";
const OWNER = "10000000-0000-0000-0000-000000000002";
const OWNER_SUB = "10000000-0000-0000-0000-000000000003";
const BASE = "appPHONEBASE12345";
const TABLE = "tblROSTERPHONE001";
const PHONE_MSG = "Phone is already on another Overwatch account. That account was not changed, and this row was not saved. Accounts are not matched or merged by phone.";
const BUSY_MSG = "Another roster sync is updating this phone. This row was not saved. Run the sync again.";

function db() {
  return new Client({ host: "/var/run/postgresql", user: process.env.USER, database: "ow_phone_it" });
}

async function load(client, absolute) {
  await client.query(readFileSync(absolute, "utf8"));
}

async function session(client, { sub = OWNER_SUB, role = "authenticated", aal = "aal2" } = {}) {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [sub]);
  await client.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
  await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ aal, role })]);
}

async function sync(client, plan) {
  const { rows } = await client.query(
    "select public.apply_airtable_roster_sync($1::uuid, $2, $3, $4::jsonb) as result",
    [COMPANY, BASE, TABLE, JSON.stringify(plan)],
  );
  return rows[0].result;
}

async function reset(client) {
  await client.query(`
    truncate public.employee_external_ids, public.company_memberships, public.users,
      public.integration_connections, public.airtable_field_mappings, public.companies
    restart identity cascade
  `);
  await client.query(
    `insert into public.companies (id, settings) values ($1, '{}'::jsonb)`,
    [COMPANY],
  );
  await client.query(
    `insert into public.users (id, supabase_id, email, first_name, last_name, phone)
     values ($1, $2, 'owner@example.com', 'Olivia', 'Owner', null)`,
    [OWNER, OWNER_SUB],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status)
     values ('10000000-0000-0000-0000-000000000010', $1, $2, 'owner', 'active')`,
    [OWNER, COMPANY],
  );
  await client.query(
    `insert into public.integration_connections (company_id, provider, status, settings)
     values ($1, 'airtable', 'connected', $2::jsonb)`,
    [COMPANY, JSON.stringify({ roster_base_id: BASE, roster_table_id: TABLE })],
  );
  await client.query(
    `insert into public.airtable_field_mappings (company_id, purpose, base_id, table_id, mappings, confirmed_at)
     values ($1, 'roster', $2, $3, $4::jsonb, now())`,
    [COMPANY, BASE, TABLE, JSON.stringify({
      first_name: { field_id: "fldFIRSTNAME12345", name: "First", type: "singleLineText" },
      email: { field_id: "fldEMAILADDRESS12", name: "Email", type: "email" },
      phone: { field_id: "fldPHONEFIELD1234", name: "Phone", type: "phoneNumber" },
    })],
  );
}

async function userRow(client, id) {
  const { rows } = await client.query("select phone, first_name, email from public.users where id = $1", [id]);
  return rows[0] ?? null;
}

const checks = [];
function check(name, fn) {
  checks.push({ name, fn });
}

check("unauthenticated call is rejected", async (client) => {
  await session(client, { sub: "" });
  await assert.rejects(() => sync(client, {}), /Not authenticated/);
});

check("staff cannot apply the plan", async (client) => {
  const staff = "10000000-0000-0000-0000-000000000020";
  const sub = "10000000-0000-0000-0000-000000000021";
  await client.query(
    `insert into public.users (id, supabase_id, email, first_name, last_name) values ($1, $2, 'staff.caller@example.com', 'Sam', 'Staff')`,
    [staff, sub],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status)
     values ('10000000-0000-0000-0000-000000000022', $1, $2, 'staff', 'active')`,
    [staff, COMPANY],
  );
  await session(client, { sub });
  await assert.rejects(() => sync(client, {}), /Forbidden/);
});

check("owner without aal2 is rejected when the company requires MFA", async (client) => {
  await client.query(`update public.companies set settings = '{"require_mfa_admins":"true"}'::jsonb where id = $1`, [COMPANY]);
  await session(client, { aal: "aal1" });
  await assert.rejects(() => sync(client, {}), /Two-factor verification required/);
  await session(client, { aal: "aal2" });
  const result = await sync(client, {});
  assert.equal(result.created, 0);
  assert.equal(result.removed, 0);
});

check("authenticated and anon cannot execute the phone helpers", async (client) => {
  for (const role of ["authenticated", "anon"]) {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    await assert.rejects(
      () => client.query("select public.airtable_roster_phone_to_store($1::uuid, '5550100000')", [OWNER]),
      /permission denied/i,
    );
    await client.query("rollback");
  }
});

check("blank phones are stored as null and do not collide", async (client) => {
  await session(client);
  const result = await sync(client, {
    creates: [
      { airtable_id: "recBLANKPHONE0001", email: "blank.one@example.com", first_name: "Blank", last_name: "One", phone: "" },
      { airtable_id: "recBLANKPHONE0002", email: "blank.two@example.com", first_name: "Blank", last_name: "Two", phone: "   " },
      { airtable_id: "recBLANKPHONE0003", email: "blank.three@example.com", first_name: "Blank", last_name: "Three", phone: "call me" },
    ],
  });
  assert.equal(result.failed.create, 0);
  assert.equal(result.created, 3);
  const { rows } = await client.query(
    "select phone from public.users where email like 'blank.%@example.com' order by email",
  );
  assert.deepEqual(rows.map((row) => row.phone), [null, null, null]);
});

check("own formatted number is left unchanged and a different account's number is refused", async (client) => {
  const self = "10000000-0000-0000-0000-000000000030";
  const other = "10000000-0000-0000-0000-000000000031";
  await client.query(
    `insert into public.users (id, email, first_name, last_name, phone) values
      ($1, 'self.phone@example.com', 'Self', 'Phone', '(555) 010-4000'),
      ($2, 'other.phone@example.com', 'Other', 'Phone', '5550103002')`,
    [self, other],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status) values
      ('10000000-0000-0000-0000-000000000032', $1, $3, 'staff', 'active'),
      ('10000000-0000-0000-0000-000000000033', $2, $3, 'staff', 'active')`,
    [self, other, COMPANY],
  );
  await client.query(
    `insert into public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method) values
      ($3, $1, 'airtable', 'recSELFPHONE00001', 'email'),
      ($3, $2, 'airtable', 'recOTHRPHONE00001', 'email')`,
    [self, other, COMPANY],
  );
  await session(client);
  const own = await sync(client, {
    updates: [{
      airtable_id: "recSELFPHONE00001", membership_id: "10000000-0000-0000-0000-000000000032", user_id: self,
      first_name: "Renamed", phone: "555.010.4000",
    }],
  });
  assert.equal(own.failed.update, 0);
  assert.equal(own.updated, 1);
  assert.equal((await userRow(client, self)).phone, "(555) 010-4000");
  assert.equal((await userRow(client, self)).first_name, "Renamed");

  const exact = await sync(client, {
    updates: [{
      airtable_id: "recSELFPHONE00001", membership_id: "10000000-0000-0000-0000-000000000032", user_id: self,
      phone: "5550103002",
    }],
  });
  assert.equal(exact.failed.update, 1);
  assert.equal(exact.updated, 0);
  assert.equal(exact.failures[0].message, PHONE_MSG);
  assert.equal((await userRow(client, self)).phone, "(555) 010-4000");
  assert.equal((await userRow(client, other)).phone, "5550103002");
  assert.equal((await userRow(client, other)).first_name, "Other");

  const formatted = await sync(client, {
    updates: [{
      airtable_id: "recSELFPHONE00001", membership_id: "10000000-0000-0000-0000-000000000032", user_id: self,
      phone: "(555) 010-3002",
    }],
  });
  assert.equal(formatted.failed.update, 1);
  assert.equal(formatted.failures[0].message, PHONE_MSG);
  assert.doesNotMatch(formatted.failures[0].message, /users_phone_key|5550103002|other\.phone/);
  assert.equal((await userRow(client, self)).phone, "(555) 010-4000");
});

check("country code and extension digits are not folded into one number", async (client) => {
  const id = "10000000-0000-0000-0000-000000000034";
  await client.query(
    `insert into public.users (id, email, first_name, last_name, phone)
     values ($1, 'local.phone@example.com', 'Local', 'Phone', '5550107000')`,
    [id],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status)
     values ('10000000-0000-0000-0000-000000000035', $1, $2, 'staff', 'active')`,
    [id, COMPANY],
  );
  await client.query(
    `insert into public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method)
     values ($2, $1, 'airtable', 'recLOCALPHONE0001', 'email')`,
    [id, COMPANY],
  );
  await session(client);
  const result = await sync(client, {
    updates: [{
      airtable_id: "recLOCALPHONE0001", membership_id: "10000000-0000-0000-0000-000000000035", user_id: id,
      phone: "+1 5550107000",
    }],
  });
  assert.equal(result.failed.update, 0);
  assert.equal((await userRow(client, id)).phone, "+1 5550107000");
  const extension = await sync(client, {
    updates: [{
      airtable_id: "recLOCALPHONE0001", membership_id: "10000000-0000-0000-0000-000000000035", user_id: id,
      phone: "5550107000x12",
    }],
  });
  assert.equal(extension.failed.update, 0);
  assert.equal((await userRow(client, id)).phone, "5550107000x12");
});

check("a phone failure keeps the successful row and does not remove anyone", async (client) => {
  const taken = "10000000-0000-0000-0000-000000000040";
  const editor = "10000000-0000-0000-0000-000000000041";
  const absent = "10000000-0000-0000-0000-000000000042";
  await client.query(
    `insert into public.users (id, email, first_name, last_name, phone) values
      ($1, 'taken.phone@example.com', 'Taken', 'Phone', '5550103002'),
      ($2, 'editor.phone@example.com', 'Editor', 'Phone', '5550103001'),
      ($3, 'absent.phone@example.com', 'Absent', 'Phone', null)`,
    [taken, editor, absent],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status) values
      ('10000000-0000-0000-0000-000000000043', $1, $4, 'staff', 'active'),
      ('10000000-0000-0000-0000-000000000044', $2, $4, 'staff', 'active'),
      ('10000000-0000-0000-0000-000000000045', $3, $4, 'staff', 'active')`,
    [taken, editor, absent, COMPANY],
  );
  await client.query(
    `insert into public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method) values
      ($3, $1, 'airtable', 'recTAKENPHONE0001', 'email'),
      ($3, $2, 'airtable', 'recEDITPHONE00001', 'email')`,
    [taken, editor, COMPANY],
  );
  await session(client);
  const result = await sync(client, {
    creates: [{ airtable_id: "recNEWOKPHONE0001", email: "new.ok@example.com", first_name: "New", last_name: "Ok", phone: "5550108888" }],
    updates: [{
      airtable_id: "recEDITPHONE00001", membership_id: "10000000-0000-0000-0000-000000000044", user_id: editor,
      phone: "(555) 010-3002",
    }],
    removals: [{ membership_id: "10000000-0000-0000-0000-000000000045", user_id: absent }],
  });
  assert.equal(result.created, 1);
  assert.equal(result.failed.update, 1);
  assert.equal(result.removed, 0);
  assert.equal(result.failures[0].message, PHONE_MSG);
  assert.equal((await userRow(client, editor)).phone, "5550103001");
  assert.equal((await userRow(client, taken)).phone, "5550103002");
  const created = await client.query("select phone from public.users where email = 'new.ok@example.com'");
  assert.equal(created.rows[0].phone, "5550108888");
  const still = await client.query(
    "select 1 from public.company_memberships where id = '10000000-0000-0000-0000-000000000045'",
  );
  assert.equal(still.rowCount, 1);
});

check("owner and admin rows are not removed or rewritten by a phone plan", async (client) => {
  const admin = "10000000-0000-0000-0000-000000000050";
  await client.query(
    `insert into public.users (id, email, first_name, last_name, phone)
     values ($1, 'admin.phone@example.com', 'Ada', 'Admin', '5550101111')`,
    [admin],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status)
     values ('10000000-0000-0000-0000-000000000051', $1, $2, 'admin', 'active')`,
    [admin, COMPANY],
  );
  await session(client);
  const removed = await sync(client, {
    removals: [
      { membership_id: "10000000-0000-0000-0000-000000000010", user_id: OWNER },
      { membership_id: "10000000-0000-0000-0000-000000000051", user_id: admin },
    ],
  });
  assert.equal(removed.removed, 0);
  assert.equal(removed.failed.remove, 2);
  assert.match(removed.failures[0].message, /cannot remove an owner, admin, or manager/);
  const result = await sync(client, {
    creates: [
      { airtable_id: "recNEWSTAFFPHONE1", email: "new.staff@example.com", first_name: "New", last_name: "Staff", phone: "5550103333" },
      { airtable_id: "recADMINPHONE0001", email: "admin.phone@example.com", first_name: "Changed", last_name: "Name", phone: "5550102222" },
    ],
  });
  assert.equal(result.created, 1);
  assert.equal(result.failed.create, 1);
  assert.match(result.failures[0].message, /cannot change an owner, admin, or manager/);
  assert.equal((await userRow(client, admin)).phone, "5550101111");
  assert.equal((await userRow(client, admin)).first_name, "Ada");
  const roles = await client.query(
    "select role::text from public.company_memberships where company_id = $1 order by role::text",
    [COMPANY],
  );
  assert.deepEqual(roles.rows.map((row) => row.role), ["admin", "owner", "staff"]);
});

check("two creates of one new email keep a single account and its original phone", async (client) => {
  await session(client);
  const one = db();
  const two = db();
  await one.connect();
  await two.connect();
  try {
    await session(one);
    await session(two);
    await one.query("set statement_timeout = '5s'");
    await two.query("set statement_timeout = '5s'");
    const plan = (id, phone) => ({
      creates: [{ airtable_id: id, email: "race.person@example.com", first_name: "Race", last_name: "Person", phone }],
    });
    const [left, right] = await Promise.all([
      sync(one, plan("recRACEPHONE00001", "5550101001")),
      sync(two, plan("recRACEPHONE00002", "5550101002")),
    ]);
    const created = (left.created ?? 0) + (right.created ?? 0);
    assert.equal(created, 1);
    const { rows } = await client.query(
      "select phone from public.users where lower(email) = 'race.person@example.com'",
    );
    assert.equal(rows.length, 1);
    assert.ok(rows[0].phone === "5550101001" || rows[0].phone === "5550101002");
    const memberships = await client.query(
      `select count(*)::int as n from public.company_memberships cm
       join public.users u on u.id = cm.user_id
       where lower(u.email) = 'race.person@example.com'`,
    );
    assert.equal(memberships.rows[0].n, 1);
  } finally {
    await one.end();
    await two.end();
  }
});

check("opposite phone batches finish without waiting on each other's locks", async (client) => {
  const first = "10000000-0000-0000-0000-000000000060";
  const second = "10000000-0000-0000-0000-000000000061";
  await client.query(
    `insert into public.users (id, email, first_name, last_name, phone) values
      ($1, 'batch.one@example.com', 'Batch', 'One', '5550000001'),
      ($2, 'batch.two@example.com', 'Batch', 'Two', '5550000002')`,
    [first, second],
  );
  await client.query(
    `insert into public.company_memberships (id, user_id, company_id, role, status) values
      ('10000000-0000-0000-0000-000000000062', $1, $3, 'staff', 'active'),
      ('10000000-0000-0000-0000-000000000063', $2, $3, 'staff', 'active')`,
    [first, second, COMPANY],
  );
  await client.query(
    `insert into public.employee_external_ids (company_id, user_id, provider, external_employee_id, match_method) values
      ($3, $1, 'airtable', 'recBATCHPHONE0001', 'email'),
      ($3, $2, 'airtable', 'recBATCHPHONE0002', 'email')`,
    [first, second, COMPANY],
  );
  const holder = db();
  const worker = db();
  await holder.connect();
  await worker.connect();
  const started = Date.now();
  try {
    await holder.query("begin");
    await holder.query("select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('airtable-roster-phone:' || $1, 0))", ["5551110001"]);
    await session(worker);
    await worker.query("set statement_timeout = '3s'");
    const result = await sync(worker, {
      updates: [
        { airtable_id: "recBATCHPHONE0002", membership_id: "10000000-0000-0000-0000-000000000063", user_id: second, phone: "5551110002" },
        { airtable_id: "recBATCHPHONE0001", membership_id: "10000000-0000-0000-0000-000000000062", user_id: first, phone: "5551110001" },
      ],
    });
    assert.ok(Date.now() - started < 3000, "contended sync waited on the lock");
    assert.equal(result.updated, 1);
    assert.equal(result.failed.update, 1);
    assert.equal(result.failures[0].message, BUSY_MSG);
    assert.equal((await userRow(client, second)).phone, "5551110002");
    assert.equal((await userRow(client, first)).phone, "5550000001");
  } finally {
    await holder.query("rollback");
    await holder.end();
    await worker.end();
  }

  const left = db();
  const right = db();
  await left.connect();
  await right.connect();
  const bothStarted = Date.now();
  try {
    await session(left);
    await session(right);
    await left.query("set statement_timeout = '5s'");
    await right.query("set statement_timeout = '5s'");
    const update = (userId, membershipId, airtableId, phone) => ({
      airtable_id: airtableId, membership_id: membershipId, user_id: userId, phone,
    });
    const [a, b] = await Promise.all([
      sync(left, { updates: [
        update(first, "10000000-0000-0000-0000-000000000062", "recBATCHPHONE0001", "5552220001"),
        update(second, "10000000-0000-0000-0000-000000000063", "recBATCHPHONE0002", "5552220002"),
      ] }),
      sync(right, { updates: [
        update(second, "10000000-0000-0000-0000-000000000063", "recBATCHPHONE0002", "5552220002"),
        update(first, "10000000-0000-0000-0000-000000000062", "recBATCHPHONE0001", "5552220001"),
      ] }),
    ]);
    assert.ok(Date.now() - bothStarted < 5000, "opposite batches did not finish");
    const failed = (a.failed?.update ?? 0) + (b.failed?.update ?? 0);
    const updated = (a.updated ?? 0) + (b.updated ?? 0);
    assert.ok(updated + failed === 4, `unexpected update accounting ${updated}+${failed}`);
    for (const failure of [...(a.failures ?? []), ...(b.failures ?? [])]) {
      assert.equal(failure.message, BUSY_MSG);
      assert.doesNotMatch(failure.message, /users_phone_key|555222/);
    }
  } finally {
    await left.end();
    await right.end();
  }
});

check("digit lookup cost on a 4000 row users table", async (client) => {
  await client.query(`
    insert into public.users (id, email, first_name, last_name, phone)
    select gen_random_uuid(), 'load.' || g || '@example.com', 'Load', g::text, '555' || lpad(g::text, 7, '0')
    from generate_series(1, 4000) g
  `);
  await client.query("select regexp_replace(phone, '[^0-9]', '', 'g') from public.users where phone is not null");
  const explained = await client.query(`
    explain (analyze, format json)
    select exists (
      select 1 from public.users u
      where u.phone is not null
        and regexp_replace(u.phone, '[^0-9]', '', 'g') = '5550009999'
    )
  `);
  const plan = explained.rows[0]["QUERY PLAN"][0];
  const ms = plan["Execution Time"];
  console.log(`digit lookup on ${4000}+ users: ${ms} ms (no expression index)`);
  assert.ok(ms < 250, `lookup took ${ms} ms`);
});

async function main() {
  const client = db();
  await client.connect();
  try {
    await client.query("drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;");
    await load(client, join(root, "airtable_roster_phone_fixture.sql"));
    await load(client, join(migDir, "20261106223000_airtable_roster_reconcile.sql"));
    const before = await client.query(
      "select to_regprocedure('public.airtable_roster_phone_to_store(uuid, text)') as helper",
    );
    assert.equal(before.rows[0].helper, null);
    await load(client, join(migDir, "20261106234500_airtable_roster_phone_conflict.sql"));
    const after = await client.query(
      "select pg_get_functiondef('public.airtable_roster_phone_to_store(uuid, text)'::regprocedure) as def",
    );
    assert.match(after.rows[0].def, /pg_try_advisory_xact_lock/);
    assert.doesNotMatch(after.rows[0].def, /(?<!try_)pg_advisory_xact_lock\(/);
    let failed = 0;
    for (const { name, fn } of checks) {
      await reset(client);
      try {
        await fn(client);
        console.log(`ok  ${name}`);
      } catch (error) {
        failed += 1;
        console.error(`FAIL ${name}`);
        console.error(error);
      }
    }
    if (failed) {
      console.error(`${failed} database check(s) failed`);
      process.exitCode = 1;
    } else {
      console.log(`${checks.length} database checks passed`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
