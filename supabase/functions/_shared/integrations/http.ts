/** Request plumbing shared by the integration-* Edge Functions. */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../cors.ts";
import type { AdapterCtx } from "./types.ts";

export const env = (n: string) => Deno.env.get(n);

export function serviceClient() {
  return createClient(env("SUPABASE_URL") ?? "", env("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function jsonResponder(req: Request) {
  const cors = getCorsHeaders(req.headers.get("origin"));
  return {
    cors,
    json: (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }),
  };
}

export function adapterCtx(fn: string): AdapterCtx {
  return {
    fetch: (i, init) => fetch(i, init),
    env,
    now: () => new Date(),
    // eslint-disable-next-line no-console -- server log, values pre-redacted by callers
    log: (msg, meta) => console.log(`[${fn}] ${msg}`, meta ?? {}),
  };
}

/**
 * Scheduled callers (pg_cron via pg_net) send x-integrations-cron-secret.
 * The secret lives only in Vault ('integrations_cron_secret'); the database
 * compares it (service-role-only RPC, sha256 digests) and returns a boolean.
 * Missing header, short header or any RPC error -> false (caller returns 401).
 */
export async function isCronCall(req: Request, admin: ReturnType<typeof serviceClient>): Promise<boolean> {
  const candidate = req.headers.get("x-integrations-cron-secret");
  if (!candidate || candidate.length < 32 || candidate.length > 256) return false;
  try {
    const { data, error } = await admin.rpc("integration_cron_secret_matches", { candidate });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Resolve the signed-in caller and their role in company_id.
 * Returns null user when the JWT is missing/invalid. Only an active membership
 * counts, matching public.my_company_role().
 */
export async function callerRole(req: Request, admin: ReturnType<typeof serviceClient>, companyId: string): Promise<{ authUserId: string | null; userId: string | null; role: string | null }> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { authUserId: null, userId: null, role: null };
  const userClient = createClient(env("SUPABASE_URL") ?? "", env("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { authUserId: null, userId: null, role: null };
  const { data: me } = await admin.from("users").select("id").eq("supabase_id", user.id).maybeSingle();
  const userId = (me as { id?: string } | null)?.id ?? null;
  if (!userId) return { authUserId: user.id, userId: null, role: null };
  const { data: mem } = await admin.from("company_memberships").select("role")
    .eq("company_id", companyId).eq("user_id", userId).eq("status", "active").maybeSingle();
  return { authUserId: user.id, userId, role: (mem as { role?: string } | null)?.role ?? null };
}
