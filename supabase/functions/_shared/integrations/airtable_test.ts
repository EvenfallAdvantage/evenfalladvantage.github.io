import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { airtableBasicAuth, AIRTABLE_REDIRECT_URI, AIRTABLE_SCOPES, createAirtableAdapter, type ApplicantStore } from "./airtable.ts";
import { planApplicantImport, normalizeAirtableRecord, AIRTABLE_PREVIEW_LIMIT, type ExistingApplicant } from "./airtable-import.ts";
import { getAdapter } from "./registry.ts";
import type { AdapterCtx, LiveConnection } from "./types.ts";

const NOW = new Date("2026-11-06T17:00:00Z");
const ENV = {
  AIRTABLE_CLIENT_ID: "ovr_client",
  AIRTABLE_CLIENT_SECRET: "ovr_secret",
  INTEGRATIONS_PUBLIC_BASE: "https://api.evenfalladvantage.com/integrations",
  SUPABASE_URL: "https://example.supabase.co",
};

function envOf(extra: Record<string, string> = ENV) {
  return (n: string) => extra[n];
}

function ctxWith(handler: (url: string, init?: RequestInit) => Response, calls: { method: string; url: string; init?: RequestInit }[] = []): AdapterCtx {
  return {
    fetch: (url, init) => {
      calls.push({ method: init?.method ?? "GET", url, init });
      return Promise.resolve(handler(url, init));
    },
    env: envOf(),
    now: () => NOW,
    log: () => {},
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Repeated-character record ids are fixtures. gitleaks:allow is on each use
// beside the word "airtable" because that rule treats any 17-character token there as a key.

function conn(over: Partial<LiveConnection> = {}): LiveConnection {
  return {
    id: "c1", company_id: "co-1", provider: "airtable", status: "connected", auth_type: "oauth_code",
    vault_secret_id: "v1", access_expires_at: null, external_account_id: null,
    settings: { base_id: "appABCDEFGHIJKLMN", table_id: "tblABCDEFGHIJKLMN", base_name: "Hiring", table_name: "Applicants" },
    secrets: { access_token: "at_1", refresh_token: "rt_1" },
    ...over,
  };
}

const adapter = createAirtableAdapter();

Deno.test("registry exposes airtable without the mock flag", () => {
  assertEquals(getAdapter("airtable", envOf({}))?.provider, "airtable");
  assertEquals(getAdapter("airtable", envOf({}))?.authType, "oauth_code");
  assertEquals(getAdapter("gusto", envOf({})), null);
});

Deno.test("authorize URL is the pinned redirect, PKCE, and read scopes only", () => {
  const url = new URL(adapter.authorizeUrl!({
    state: "state-value",
    redirectUri: "https://api.evenfalladvantage.com/integrations/oauth/callback/airtable",
    codeChallenge: "challenge-value",
    env: envOf(),
  }));
  assertEquals(url.origin + url.pathname, "https://airtable.com/oauth2/v1/authorize");
  assertEquals(url.searchParams.get("redirect_uri"), AIRTABLE_REDIRECT_URI);
  assertEquals(url.searchParams.get("code_challenge_method"), "S256");
  assertEquals(url.searchParams.get("code_challenge"), "challenge-value");
  assertEquals(url.searchParams.get("state"), "state-value");
  assertEquals(url.searchParams.get("response_type"), "code");
  assertEquals(url.searchParams.get("scope"), AIRTABLE_SCOPES);
  assert(!url.searchParams.get("scope")!.includes("write"));
  assert(!url.searchParams.get("scope")!.includes("webhook"));
  assertEquals(url.searchParams.get("client_id"), "ovr_client");
  assert(!url.toString().includes("ovr_secret"));
});

Deno.test("authorize refuses to start without the platform client or PKCE", () => {
  assertEquals(adapter.isConfigured!(envOf({})), false);
  assertEquals(adapter.isConfigured!(envOf()), true);
  let threw = false;
  try {
    adapter.authorizeUrl!({ state: "s", redirectUri: AIRTABLE_REDIRECT_URI, env: envOf({}) });
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test("code exchange uses basic auth and the pinned redirect", async () => {
  const calls: { method: string; url: string; init?: RequestInit }[] = [];
  const ctx = ctxWith(() => json({ access_token: "at_new", refresh_token: "rt_new", expires_in: 3600, scope: AIRTABLE_SCOPES }), calls);
  const tokens = await adapter.exchangeCode!({
    code: "code-1",
    redirectUri: "https://api.evenfalladvantage.com/integrations/oauth/callback/airtable",
    verifier: "verifier-1",
    query: new URLSearchParams(),
  }, ctx);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].method, "POST");
  assertEquals(calls[0].url, "https://airtable.com/oauth2/v1/token");
  assertEquals(calls[0].init?.headers && (calls[0].init.headers as Record<string, string>).Authorization, airtableBasicAuth("ovr_client", "ovr_secret"));
  const body = String(calls[0].init?.body);
  assertStringIncludes(body, "grant_type=authorization_code");
  assertStringIncludes(body, `redirect_uri=${encodeURIComponent(AIRTABLE_REDIRECT_URI)}`);
  assertStringIncludes(body, "code_verifier=verifier-1");
  assert(!body.includes("ovr_secret"));
  assertEquals(tokens.access_token, "at_new");
  assertEquals(tokens.refresh_token, "rt_new");
  assertEquals(tokens.expires_at, "2026-11-06T18:00:00.000Z");
});

Deno.test("refresh stores the rotated refresh token and drops the old one", async () => {
  const calls: { method: string; url: string; init?: RequestInit }[] = [];
  const ctx = ctxWith(() => json({ access_token: "at_2", refresh_token: "rt_2", expires_in: 3600 }), calls);
  const next = await adapter.refresh!({ access_token: "at_1", refresh_token: "rt_1" }, ctx);
  assertEquals(next.access_token, "at_2");
  assertEquals(next.refresh_token, "rt_2");
  assertEquals(next.refresh_token === "rt_1", false);
  const body = String(calls[0].init?.body);
  assertStringIncludes(body, "grant_type=refresh_token");
  assertStringIncludes(body, "refresh_token=rt_1");
  assertEquals((calls[0].init?.headers as Record<string, string>).Authorization, airtableBasicAuth("ovr_client", "ovr_secret"));
});

Deno.test("test connection is a whoami GET and does not mark success on 401", async () => {
  const calls: { method: string; url: string }[] = [];
  const ok = await adapter.test(conn(), ctxWith(() => json({ id: "usr_test" }), calls));
  assertEquals(ok, { ok: true, externalAccountName: "Airtable" });
  assertEquals(calls.map((c) => [c.method, c.url]), [["GET", "https://api.airtable.com/v0/meta/whoami"]]);
  const bad = await adapter.test(conn(), ctxWith(() => json({ error: "no" }, 401)));
  assertEquals(bad.ok, false);
});

Deno.test("list bases, list tables, and preview are read-only and capped", async () => {
  const calls: { method: string; url: string; init?: RequestInit }[] = [];
  const ctx = ctxWith((url) => {
    if (url.endsWith("/meta/bases")) return json({ bases: [{ id: "appABCDEFGHIJKLMN", name: "Hiring" }, { id: "not-a-base", name: "skip" }] });
    if (url.endsWith("/tables")) return json({ tables: [{ id: "tblABCDEFGHIJKLMN", name: "Applicants", fields: [{ name: "SSN" }] }] });
    return json({
      records: [{ id: "recEEEEEEEEEEEEEE", fields: { "First Name": "Ada", "Last Name": "Lovelace", Email: "ada@example.com", Phone: "555", SSN: "should-not-leak" } }],
      offset: "next-page",
    });
  }, calls);
  const bases = await adapter.actions.list_bases.run(conn(), {}, ctx) as { ok: boolean; bases: { id: string; name: string }[] };
  const tables = await adapter.actions.list_tables.run(conn(), { base_id: "appABCDEFGHIJKLMN" }, ctx) as { ok: boolean; tables: { id: string; name: string }[] };
  const preview = await adapter.actions.preview_records.run(conn(), {}, ctx) as { ok: boolean; truncated: boolean; records: { email: string; airtableId: string; firstName: string; lastName: string; phone?: string }[] };
  assertEquals(bases.bases.map((b) => b.id), ["appABCDEFGHIJKLMN"]);
  assertEquals(tables.tables, [{ id: "tblABCDEFGHIJKLMN", name: "Applicants" }]);
  assertEquals("fields" in tables.tables[0], false);
  assertEquals(preview.truncated, true);
  assertEquals(preview.records, [{ airtableId: "recEEEEEEEEEEEEEE", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "555" }]); // gitleaks:allow
  assert(calls.every((c) => c.method === "GET"));
  assert(calls.every((c) => !c.url.includes("offset=")));
  assertStringIncludes(calls[2].url, `maxRecords=${AIRTABLE_PREVIEW_LIMIT}`);
  assert(!JSON.stringify(preview).includes("should-not-leak"));
  assert(!JSON.stringify(preview).includes("at_1"));
});

Deno.test("import re-reads records with GET, dedupes, and flags email conflicts", async () => {
  const calls: { method: string; url: string }[] = [];
  const inserted: string[] = [];
  const existing: ExistingApplicant[] = [
    { id: "already", email: "ada@example.com", airtableRecordId: "recAAAAAAAAAAAAAA" }, // gitleaks:allow
    { id: "mail", email: "grace@example.com", airtableRecordId: null },
  ];
  const store: ApplicantStore = {
    lastTestOk: () => Promise.resolve(true),
    listApplicants: (companyId) => {
      assertEquals(companyId, "co-1");
      return Promise.resolve(existing);
    },
    insertApplicant: (row) => {
      assertEquals(row.companyId, "co-1");
      inserted.push(row.email);
      return Promise.resolve({ id: "new-id" });
    },
  };
  const local = createAirtableAdapter(store);
  const ctx = ctxWith((url) => {
    if (url.endsWith("/recBBBBBBBBBBBBBB")) return json({ id: "recBBBBBBBBBBBBBB", fields: { Email: "new@example.com", Name: "New Person" } });
    if (url.endsWith("/recAAAAAAAAAAAAAA")) return json({ id: "recAAAAAAAAAAAAAA", fields: { Email: "ada@example.com", "First Name": "Ada" } });
    if (url.endsWith("/recCCCCCCCCCCCCCC")) return json({ id: "recCCCCCCCCCCCCCC", fields: { Email: "Grace@example.com", "First Name": "Grace" } });
    return json({ error: "missing" }, 404);
  }, calls);
  const result = await local.actions.import_applicants.run(conn(), {
    record_ids: ["recBBBBBBBBBBBBBB", "recAAAAAAAAAAAAAA", "recCCCCCCCCCCCCCC", "recDDDDDDDDDDDDDD"],
  }, ctx) as {
    ok: boolean;
    imported: { email: string }[];
    alreadyImported: { airtableId: string }[];
    emailConflicts: { airtableId: string; email: string; existingApplicantId: string | null }[];
    skipped: { airtableId: string; reason: string }[];
  };
  assertEquals(result.ok, true);
  assertEquals(inserted, ["new@example.com"]);
  assertEquals(result.imported.map((r) => r.email), ["new@example.com"]);
  assertEquals(result.alreadyImported.map((r) => r.airtableId), ["recAAAAAAAAAAAAAA"]); // gitleaks:allow
  assertEquals(result.emailConflicts, [{ airtableId: "recCCCCCCCCCCCCCC", email: "grace@example.com", existingApplicantId: "mail" }]); // gitleaks:allow
  assertEquals(result.skipped, [{ airtableId: "recDDDDDDDDDDDDDD", reason: "not_in_airtable" }]); // gitleaks:allow
  assert(calls.every((c) => c.method === "GET"));
  assert(calls.every((c) => c.url.startsWith("https://api.airtable.com/v0/appABCDEFGHIJKLMN/tblABCDEFGHIJKLMN/rec")));
});

Deno.test("import refuses when the connection has not passed test", async () => {
  const store: ApplicantStore = {
    lastTestOk: () => Promise.resolve(false),
    listApplicants: () => Promise.reject(new Error("should not list")),
    insertApplicant: () => Promise.reject(new Error("should not insert")),
  };
  const local = createAirtableAdapter(store);
  let fetched = 0;
  const ctx = ctxWith(() => {
    fetched++;
    return json({});
  });
  const result = await local.actions.import_applicants.run(conn(), { record_ids: ["recAAAAAAAAAAAAAA"] }, ctx) as { ok: boolean; error?: string };
  assertEquals(result.ok, false);
  assertStringIncludes(result.error ?? "", "Test connection");
  assertEquals(fetched, 0);
});

Deno.test("saved Employees table does not filter the authorized schema", async () => {
  const calls: string[] = [];
  const ctx = ctxWith((url) => {
    calls.push(url);
    if (url.includes("offset=page-2")) return json({ bases: [{ id: "appSECONDBASE1234", name: "Second", permissionLevel: "edit" }] });
    if (url.endsWith("/meta/bases")) {
      return json({
        bases: [{ id: "appOPERATIONS1234", name: "Operations", permissionLevel: "read" }, { id: "appHIRING12345678", name: "Hiring", permissionLevel: "none" }],
        offset: "page-2",
      });
    }
    return json({ tables: [
      { id: "tblEMPLOYEES12345", name: "Employees", fields: [{ name: "SSN" }] },
      { id: "tblEVENTS12345678", name: "Events" },
      { id: "tblVENDORS1234567", name: "Vendors" },
    ] });
  }, []);
  const saved = conn({ settings: { base_id: "appOPERATIONS1234", table_id: "tblEMPLOYEES12345", table_name: "Employees", roster_table_id: "tblEMPLOYEES12345" } });
  const bases = await adapter.actions.list_bases.run(saved, {}, ctx) as { bases: { name: string }[] };
  const tables = await adapter.actions.list_tables.run(saved, { base_id: "appOPERATIONS1234" }, ctx) as { tables: { name: string }[] };
  assertEquals(bases.bases.map((b) => b.name), ["Operations", "Second"]);
  assertEquals(tables.tables.map((t) => t.name), ["Employees", "Events", "Vendors"]);
  assertEquals(calls.some((url) => url.includes("tblEMPLOYEES12345")), false);
});

Deno.test("roster sync does not run without confirmation", async () => {
  let fetched = 0;
  const result = await adapter.actions.sync_roster.run(conn(), {}, ctxWith(() => {
    fetched++;
    return json({});
  })) as { ok: boolean; error?: string };
  assertEquals(result.ok, false);
  assertStringIncludes(result.error ?? "", "Confirm the sync");
  assertEquals(fetched, 0);
});

Deno.test("planApplicantImport does not silently duplicate a batch email", () => {
  const plan = planApplicantImport([], [
    normalizeAirtableRecord({ id: "recAAAAAAAAAAAAAA", fields: { Email: "a@example.com", Name: "A One" } }),
    normalizeAirtableRecord({ id: "recBBBBBBBBBBBBBB", fields: { Email: "A@example.com", Name: "A Two" } }),
    normalizeAirtableRecord({ id: "recCCCCCCCCCCCCCC", fields: { Name: "No Mail" } }),
  ]);
  assertEquals(plan.toImport.map((r) => r.airtableId), ["recAAAAAAAAAAAAAA"]); // gitleaks:allow
  assertEquals(plan.emailConflicts[0].existingApplicantId, null);
  assertEquals(plan.skipped[0].reason, "missing_email");
});
