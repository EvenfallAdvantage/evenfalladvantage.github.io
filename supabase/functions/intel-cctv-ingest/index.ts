/**
 * intel-cctv-ingest: scheduled fill of public.cctv_cameras.
 *
 * Called every 15 min by pg_cron (migration 20261016210500) with the
 * `x-ingest-secret` header. For each source in the shared registry: fetch +
 * parse, upsert rows, mark rows unseen for 24h offline (cctv_mark_stale),
 * record health in cctv_source_status. One failing source never blocks others.
 *
 * Optional: ?source=<id>[,<id>] to run a subset; ?dry_run=1 to parse only.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (platform), CCTV_INGEST_SECRET.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CCTV_SOURCES, makeGetJson } from "../_shared/cctv/sources.ts";
import { chunk, secretMatches, toRows } from "./lib.ts";

const STALE_AFTER_MS = 24 * 3600_000;
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

Deno.serve(async (req) => {
  if (!secretMatches(req.headers.get("x-ingest-secret"), Deno.env.get("CCTV_INGEST_SECRET"))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const params = new URL(req.url).searchParams;
  const only = params.get("source")?.split(",").map((s) => s.trim()).filter(Boolean);
  const dryRun = params.get("dry_run") === "1";
  const sources = only?.length ? CCTV_SOURCES.filter((s) => only.includes(s.id)) : CCTV_SOURCES;
  const getJson = makeGetJson();

  const results = await Promise.all(sources.map(async (src) => {
    const now = new Date();
    const nowIso = now.toISOString();
    try {
      const rows = toRows(await src.fetch(getJson), src.attribution, nowIso);
      if (rows.length === 0) throw new Error("source returned 0 cameras (not marking stale)");
      let stale = 0;
      if (!dryRun) {
        for (const part of chunk(rows, CHUNK)) {
          await ok(await rest("cctv_cameras?on_conflict=id", {
            method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(part),
          }), "upsert");
        }
        const r = await rest("rpc/cctv_mark_stale", {
          method: "POST", body: JSON.stringify({ p_source: src.id, p_cutoff: new Date(now.getTime() - STALE_AFTER_MS).toISOString() }),
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

  return new Response(JSON.stringify({ dry_run: dryRun, results, timestamp: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
