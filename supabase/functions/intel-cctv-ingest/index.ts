/**
 * intel-cctv-ingest: scheduled fill of public.cctv_cameras.
 *
 * Called every 15 min by pg_cron (migration 20261016224147) with the
 * `x-ingest-secret` header. For each source in the shared registry: fetch +
 * parse, upsert rows, mark rows unseen for 35 min (two runs) offline
 * (cctv_mark_stale), record health in cctv_source_status. One failing source
 * never blocks others. Full (non-subset) runs also mark every online row of a
 * disabled source (e.g. NYC DOT, unkeyed 511 hosts) offline, so turned-off
 * sources stop being served at the DB level too, not only by intel-cctv's filter.
 *
 * Optional: ?source=<id>[,<id>] to run a subset; ?dry_run=1 to parse only.
 * Auth: x-ingest-secret is checked against Vault 'cctv_ingest_secret' via the
 * service_role-only rpc cctv_ingest_secret_matches (migration 20261016224117);
 * the function never sees the secret. Accepted values are cached 5 min (hash
 * only). No env-var fallback: Vault is the single source of truth, shared
 * with the pg_cron job. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform),
 *   optional CCTV_ENABLE_PENDING_SOURCES ("all" or comma ids) to enable the
 *   terms-pending sources. Key-gated sources (NPS, 511 hosts) stay off until
 *   their own function secret is set; names are listed per source in
 *   _shared/cctv/sources.ts (`secret:` field).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { disabledSourceIds, enabledSources, makeFetchers } from "../_shared/cctv/sources.ts";
import { chunk, SecretCache, staleCutoffIso, sweepTargets, toRows } from "./lib.ts";
const CHUNK = 500;

function rest(path: string, init: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
}

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  await res.body?.cancel();
}

const secretCache = new SecretCache(5 * 60_000);

async function authorized(candidate: string | null): Promise<boolean> {
  const c = (candidate ?? "").trim();
  if (c.length < 32 || c.length > 256) return false;
  if (await secretCache.has(c)) return true;
  const res = await rest("rpc/cctv_ingest_secret_matches", { method: "POST", body: JSON.stringify({ candidate: c }) });
  if (!res.ok) { console.warn("[intel-cctv-ingest] secret rpc", res.status); await res.body?.cancel(); return false; }
  const ok = (await res.json()) === true;
  if (ok) await secretCache.add(c);
  return ok;
}

Deno.serve(async (req) => {
  if (!(await authorized(req.headers.get("x-ingest-secret")))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const params = new URL(req.url).searchParams;
  const only = params.get("source")?.split(",").map((s) => s.trim()).filter(Boolean);
  const dryRun = params.get("dry_run") === "1";
  const pool = enabledSources(Deno.env.get("CCTV_ENABLE_PENDING_SOURCES"), (k) => Deno.env.get(k));
  const sources = only?.length ? pool.filter((s) => only.includes(s.id)) : pool;
  const fetchers = makeFetchers();

  const results = await Promise.all(sources.map(async (src) => {
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      const rows = toRows(await src.fetch(fetchers, src.secret ? Deno.env.get(src.secret) : undefined), src.attribution, nowIso);
      if (rows.length === 0) throw new Error("source returned 0 cameras (not marking stale)");
      let stale = 0;
      if (!dryRun) {
        for (const part of chunk(rows, CHUNK)) {
          await ok(await rest("cctv_cameras?on_conflict=id", {
            method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(part),
          }), "upsert");
        }
        const r = await rest("rpc/cctv_mark_stale", {
          method: "POST", body: JSON.stringify({ p_source: src.id, p_cutoff: staleCutoffIso(now) }),
        });
        if (!r.ok) throw new Error(`mark_stale: ${r.status}`);
        stale = Number(await r.json()) || 0;
        await ok(await rest("cctv_source_status?on_conflict=source", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ source: src.id, last_run_at: nowIso, last_ok_at: nowIso, camera_count: rows.length, last_error: null, updated_at: nowIso }),
        }), "status");
      }
      return { source: src.id, ok: true, count: rows.length, stale };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[intel-cctv-ingest]", src.id, msg);
      if (!dryRun) {
        await rest("cctv_source_status?on_conflict=source", {
          method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ source: src.id, last_run_at: nowIso, last_error: msg.slice(0, 500), updated_at: nowIso }),
        }).then((r) => r.body?.cancel()).catch(() => {});
      }
      return { source: src.id, ok: false, error: msg };
    }
  }));

  // Disabled sources: mark all their online rows offline (cutoff = now).
  const disabled: Record<string, number | string> = {};
  if (!dryRun) {
    const pending = Deno.env.get("CCTV_ENABLE_PENDING_SOURCES");
    const cutoff = new Date().toISOString();
    for (const id of sweepTargets(disabledSourceIds(pending, (k) => Deno.env.get(k)), only)) {
      try {
        const r = await rest("rpc/cctv_mark_stale", { method: "POST", body: JSON.stringify({ p_source: id, p_cutoff: cutoff }) });
        if (!r.ok) { await r.body?.cancel(); throw new Error(`mark_stale: ${r.status}`); }
        disabled[id] = Number(await r.json()) || 0;
      } catch (e) {
        disabled[id] = e instanceof Error ? e.message : String(e);
        console.warn("[intel-cctv-ingest] sweep", id, disabled[id]);
      }
    }
  }

  return new Response(JSON.stringify({ dry_run: dryRun, results, disabled_swept: disabled, timestamp: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
