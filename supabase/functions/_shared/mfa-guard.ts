/**
 * Server-side 2FA (AAL2) check for service-key admin Edge Functions.
 *
 * Service-role queries bypass RLS, so the database's restrictive
 * `mfa_required_*` policies don't protect these functions. Each admin
 * function calls this AFTER its role check and BEFORE acting.
 *
 * It asks the database, as the caller, `public.mfa_ok(company_id)`, the same
 * function the RLS policies use. It returns true when the caller's verified JWT
 * has aal2, or when the company hasn't turned on `require_mfa_admins`, or when
 * the caller isn't an owner/admin there. That keeps one source of truth, and
 * the aal claim comes from the JWT that PostgREST verified, never from the
 * request body.
 *
 * Fails closed: if the check itself errors, the action is refused.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

export type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
};

export const MFA_REQUIRED_BODY = {
  error: "Two-factor authentication is required for this action. Verify with your authenticator app and try again.",
  code: "mfa_required",
} as const;

/** Client that runs RPCs as the caller (anon key + caller's bearer token). */
export function callerRpcClient(req: Request): RpcClient | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false },
  }) as unknown as RpcClient;
}

/** "ok" | "mfa_required" | "error" for every company id (all must pass). */
export async function checkCompanyMfa(client: RpcClient | null, companyIds: string[]): Promise<"ok" | "mfa_required" | "error"> {
  if (!client) return "error";
  const ids = [...new Set(companyIds.filter(Boolean))];
  if (ids.length === 0) return "error";
  for (const id of ids) {
    const { data, error } = await client.rpc("mfa_ok", { p_company_id: id });
    if (error) return "error";
    if (data !== true) return "mfa_required";
  }
  return "ok";
}

/** null = proceed; otherwise a ready 403/503 Response to return. */
export async function requireCompanyMfa(
  client: RpcClient | null,
  companyIds: string | string[],
  headers: HeadersInit,
): Promise<Response | null> {
  const r = await checkCompanyMfa(client, Array.isArray(companyIds) ? companyIds : [companyIds]);
  if (r === "ok") return null;
  if (r === "mfa_required") return new Response(JSON.stringify(MFA_REQUIRED_BODY), { status: 403, headers });
  return new Response(JSON.stringify({ error: "Couldn't verify two-factor status. Please try again." }), { status: 503, headers });
}
