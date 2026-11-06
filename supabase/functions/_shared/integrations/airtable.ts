/**
 * Airtable OAuth adapter (authorization code + PKCE).
 * Read scopes only. Tokens stay in the framework Vault row. This file never
 * reads integrations_config or a personal access token.
 *
 * The redirect URI is pinned. INTEGRATIONS_PUBLIC_BASE must not change it:
 * Airtable requires an exact match with the URI registered on the OAuth app.
 */
import { vendorJson } from "./vendor-fetch.ts";
import {
  AIRTABLE_BASE_ID,
  AIRTABLE_PREVIEW_LIMIT,
  AIRTABLE_RECORD_ID,
  AIRTABLE_TABLE_ID,
  normalizeAirtableRecord,
  planApplicantImport,
  readAirtableSettings,
  type ExistingApplicant,
  type NormalizedApplicant,
} from "./airtable-import.ts";
import { VendorError, type AdapterCtx, type TokenSet, type VendorAdapter } from "./types.ts";

export const AIRTABLE_REDIRECT_URI =
  "https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-oauth-callback/airtable";

export const AIRTABLE_SCOPES = "schema.bases:read data.records:read user.email:read";

const AUTHORIZE_URL = "https://airtable.com/oauth2/v1/authorize";
const TOKEN_URL = "https://airtable.com/oauth2/v1/token";
const API = "https://api.airtable.com/v0";

export interface ApplicantStore {
  lastTestOk(companyId: string): Promise<boolean>;
  listApplicants(companyId: string): Promise<ExistingApplicant[]>;
  insertApplicant(row: {
    companyId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    airtableRecordId: string;
    baseId: string;
    tableId: string;
  }): Promise<{ id: string } | { duplicateAirtableId: true }>;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

function clientId(env: AdapterCtx["env"]): string {
  return (env("AIRTABLE_CLIENT_ID") ?? "").trim();
}

function clientSecret(env: AdapterCtx["env"]): string {
  return (env("AIRTABLE_CLIENT_SECRET") ?? "").trim();
}

export function airtableConfigured(env: AdapterCtx["env"]): boolean {
  return clientId(env).length > 0 && clientSecret(env).length > 0;
}

/** RFC 7617 basic auth. Airtable's own example uses standard base64, not base64url. */
export function airtableBasicAuth(id: string, secret: string): string {
  return `Basic ${btoa(`${id}:${secret}`)}`;
}

function expiry(now: Date, seconds: number | undefined): string {
  const s = typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? seconds : 60 * 60;
  return new Date(now.getTime() + s * 1000).toISOString();
}

function bearer(token: string | undefined): HeadersInit {
  return { Authorization: `Bearer ${token ?? ""}` };
}

async function postToken(body: URLSearchParams, ctx: AdapterCtx): Promise<TokenSet> {
  const id = clientId(ctx.env);
  const secret = clientSecret(ctx.env);
  if (!id || !secret) throw new VendorError("Airtable OAuth app is not configured", 503);
  body.set("client_id", id);
  const r = await vendorJson<TokenResponse>(TOKEN_URL, {
    method: "POST",
    fetchImpl: ctx.fetch,
    headers: {
      Authorization: airtableBasicAuth(id, secret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!r.access_token || !r.refresh_token) throw new VendorError("Airtable token response was incomplete", 502);
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token,
    expires_at: expiry(ctx.now(), r.expires_in),
    ...(r.scope ? { scope: r.scope } : {}),
  };
}

function actionError(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function defaultStore(): Promise<ApplicantStore> {
  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return {
    async lastTestOk(companyId) {
      const { data, error } = await db.from("integration_connections").select("last_test_ok")
        .eq("company_id", companyId).eq("provider", "airtable").maybeSingle();
      if (error) throw error;
      return (data as { last_test_ok?: boolean } | null)?.last_test_ok === true;
    },
    async listApplicants(companyId) {
      const { data, error } = await db.from("applicants").select("id, email, custom_fields").eq("company_id", companyId);
      if (error) throw error;
      return ((data ?? []) as { id: string; email: string | null; custom_fields: Record<string, unknown> | null }[]).map((row) => ({
        id: row.id,
        email: row.email,
        airtableRecordId: typeof row.custom_fields?.airtable_record_id === "string" ? row.custom_fields.airtable_record_id : null,
      }));
    },
    async insertApplicant(row) {
      const { data, error } = await db.from("applicants").insert({
        id: crypto.randomUUID(),
        company_id: row.companyId,
        first_name: row.firstName || "Applicant",
        last_name: row.lastName,
        email: row.email,
        phone: row.phone ?? null,
        source: "airtable",
        status: "applied",
        custom_fields: {
          airtable_record_id: row.airtableRecordId,
          airtable_base_id: row.baseId,
          airtable_table_id: row.tableId,
        },
      }).select("id").maybeSingle();
      if (error?.code === "23505") return { duplicateAirtableId: true };
      if (error) throw error;
      const id = (data as { id?: string } | null)?.id;
      if (!id) throw new VendorError("Applicant insert did not return an id", 500);
      return { id };
    },
  };
}

export function createAirtableAdapter(store?: ApplicantStore): VendorAdapter {
  const applicants = () => store ? Promise.resolve(store) : defaultStore();

  return {
    provider: "airtable",
    label: "Airtable",
    authType: "oauth_code",
    scopes: AIRTABLE_SCOPES.split(" "),
    isConfigured: airtableConfigured,
    authorizeUrl({ state, codeChallenge, env }) {
      if (!airtableConfigured(env)) throw new VendorError("Airtable OAuth app is not configured", 503);
      if (!codeChallenge) throw new VendorError("PKCE is required", 400);
      const q = new URLSearchParams({
        response_type: "code",
        client_id: clientId(env),
        redirect_uri: AIRTABLE_REDIRECT_URI,
        scope: AIRTABLE_SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE_URL}?${q.toString()}`;
    },
    exchangeCode({ code, verifier }, ctx) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: AIRTABLE_REDIRECT_URI,
        code_verifier: verifier ?? "",
      });
      return postToken(body, ctx);
    },
    async refresh(tokens, ctx) {
      if (!tokens.refresh_token) throw new VendorError("no refresh token", 400);
      const next = await postToken(new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      }), ctx);
      // Airtable invalidates the previous refresh token. Persist only the new pair.
      return next;
    },
    async test(conn, ctx) {
      try {
        const who = await vendorJson<{ id?: string }>(`${API}/meta/whoami`, {
          fetchImpl: ctx.fetch,
          headers: bearer(conn.secrets.access_token),
        });
        if (!who.id) return { ok: false, detail: "Airtable did not confirm this account" };
        return { ok: true, externalAccountName: "Airtable" };
      } catch (e) {
        if (e instanceof VendorError && (e.status === 401 || e.status === 403)) {
          return { ok: false, detail: "Airtable rejected this connection" };
        }
        throw e;
      }
    },
    actions: {
      list_bases: {
        access: "manage",
        async run(conn, _input, ctx) {
          try {
            const data = await vendorJson<{ bases?: { id?: string; name?: string }[] }>(`${API}/meta/bases`, {
              fetchImpl: ctx.fetch,
              headers: bearer(conn.secrets.access_token),
            });
            const bases = (data.bases ?? [])
              .filter((b) => typeof b.id === "string" && AIRTABLE_BASE_ID.test(b.id))
              .map((b) => ({ id: b.id as string, name: typeof b.name === "string" ? b.name.slice(0, 200) : b.id as string }));
            return { ok: true, bases };
          } catch (e) {
            if (e instanceof VendorError && (e.status === 401 || e.status === 403)) return actionError("Airtable rejected this connection");
            throw e;
          }
        },
      },
      list_tables: {
        access: "manage",
        async run(conn, input, ctx) {
          const requested = typeof input.base_id === "string" ? input.base_id : readAirtableSettings(conn.settings).baseId;
          if (!AIRTABLE_BASE_ID.test(requested)) return actionError("Choose an Airtable base");
          try {
            const data = await vendorJson<{ tables?: { id?: string; name?: string }[] }>(`${API}/meta/bases/${requested}/tables`, {
              fetchImpl: ctx.fetch,
              headers: bearer(conn.secrets.access_token),
            });
            const tables = (data.tables ?? [])
              .filter((t) => typeof t.id === "string" && AIRTABLE_TABLE_ID.test(t.id))
              .map((t) => ({ id: t.id as string, name: typeof t.name === "string" ? t.name.slice(0, 200) : t.id as string }));
            return { ok: true, tables };
          } catch (e) {
            if (e instanceof VendorError && (e.status === 401 || e.status === 403 || e.status === 404)) {
              return actionError("That base is not available to this Airtable connection");
            }
            throw e;
          }
        },
      },
      preview_records: {
        access: "manage",
        async run(conn, _input, ctx) {
          const settings = readAirtableSettings(conn.settings);
          if (!settings.baseId || !settings.tableId) return actionError("Choose a base and table in HQ Config first");
          const url = `${API}/${settings.baseId}/${settings.tableId}?maxRecords=${AIRTABLE_PREVIEW_LIMIT}`;
          try {
            const data = await vendorJson<{ records?: { id?: string; fields?: unknown }[]; offset?: string }>(url, {
              fetchImpl: ctx.fetch,
              headers: bearer(conn.secrets.access_token),
            });
            const records = (data.records ?? []).slice(0, AIRTABLE_PREVIEW_LIMIT).map((rec) => normalizeAirtableRecord(rec));
            return { ok: true, records, truncated: Boolean(data.offset) || (data.records?.length ?? 0) > AIRTABLE_PREVIEW_LIMIT };
          } catch (e) {
            if (e instanceof VendorError && (e.status === 401 || e.status === 403 || e.status === 404)) {
              return actionError("Airtable could not read that table");
            }
            throw e;
          }
        },
      },
      import_applicants: {
        access: "manage",
        async run(conn, input, ctx) {
          const settings = readAirtableSettings(conn.settings);
          if (!settings.baseId || !settings.tableId) return actionError("Choose a base and table in HQ Config first");
          const rawIds = Array.isArray(input.record_ids) ? input.record_ids : [];
          if (rawIds.length === 0) return actionError("Select at least one record");
          if (rawIds.length > AIRTABLE_PREVIEW_LIMIT) return actionError(`Import at most ${AIRTABLE_PREVIEW_LIMIT} records at a time`);
          const recordIds = rawIds.filter((id): id is string => typeof id === "string" && AIRTABLE_RECORD_ID.test(id));
          if (recordIds.length !== rawIds.length) return actionError("One or more Airtable record ids are not valid");

          const db = await applicants();
          if (!(await db.lastTestOk(conn.company_id))) return actionError("Run Test connection before importing");

          const fetched: NormalizedApplicant[] = [];
          const skipped: { airtableId: string; reason: "not_in_airtable" }[] = [];
          for (const id of recordIds) {
            try {
              const rec = await vendorJson<{ id?: string; fields?: unknown }>(
                `${API}/${settings.baseId}/${settings.tableId}/${id}`,
                { fetchImpl: ctx.fetch, headers: bearer(conn.secrets.access_token) },
              );
              fetched.push(normalizeAirtableRecord(rec));
            } catch (e) {
              if (e instanceof VendorError && (e.status === 403 || e.status === 404)) {
                skipped.push({ airtableId: id, reason: "not_in_airtable" });
                continue;
              }
              if (e instanceof VendorError && e.status === 401) return actionError("Airtable rejected this connection");
              throw e;
            }
          }

          const existing = await db.listApplicants(conn.company_id);
          const plan = planApplicantImport(existing, fetched);
          const imported: { airtableId: string; email: string; applicantId: string }[] = [];
          const alreadyImported = [...plan.alreadyImported];
          for (const row of plan.toImport) {
            const inserted = await db.insertApplicant({
              companyId: conn.company_id,
              firstName: row.firstName,
              lastName: row.lastName,
              email: row.email,
              phone: row.phone,
              airtableRecordId: row.airtableId,
              baseId: settings.baseId,
              tableId: settings.tableId,
            });
            if ("duplicateAirtableId" in inserted) {
              alreadyImported.push({ airtableId: row.airtableId, email: row.email, applicantId: "" });
            } else {
              imported.push({ airtableId: row.airtableId, email: row.email, applicantId: inserted.id });
            }
          }
          return {
            ok: true,
            imported,
            alreadyImported,
            emailConflicts: plan.emailConflicts,
            skipped: [...plan.skipped, ...skipped],
          };
        },
      },
    },
  };
}

export const airtableAdapter = createAirtableAdapter();
