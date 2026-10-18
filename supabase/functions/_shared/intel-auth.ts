/**
 * Shared gate for the public-data intel proxies (intel-*, intel-osint-*,
 * opensky-proxy): require a signed-in Overwatch user and apply a basic
 * per-user rate limit.
 *
 * The functions deploy with verify_jwt=false so browser CORS preflight works;
 * this enforces auth in code instead, the same way roster-invite does.
 *
 * Rate limiting is in-memory per edge isolate (best effort): Supabase may run
 * several isolates, so the effective ceiling can be a small multiple of the
 * configured limit. It exists to stop a single account hammering upstream
 * free APIs, not as a hard quota.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

export interface IntelAuthOptions {
  /** Requests allowed per user per window. Default 120. */
  limit?: number;
  /** Window length in ms. Default 60 s. */
  windowMs?: number;
}

type UserLookup = (authHeader: string) => Promise<string | null>;

const USER_CACHE_MS = 60_000;
const userCache = new Map<string, { userId: string; until: number }>();
const rate = new Map<string, { count: number; resetAt: number }>();

function json(body: unknown, status: number, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", ...extra } });
}

/** Default lookup: validate the bearer JWT with Supabase Auth. */
const supabaseLookup: UserLookup = async (authHeader) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !anon) return null;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
};

let lookup: UserLookup = supabaseLookup;
/** Test hook: swap the user lookup (pass null to restore the default). */
export function _setUserLookupForTests(fn: UserLookup | null): void {
  lookup = fn ?? supabaseLookup;
  userCache.clear();
  rate.clear();
}

/** Returns true when this user is over the limit (and counts the request). */
export function userRateLimited(userId: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (rate.size > 5_000) {
    for (const [k, v] of rate) if (now > v.resetAt) rate.delete(k);
  }
  const e = rate.get(userId);
  if (!e || now > e.resetAt) {
    rate.set(userId, { count: 1, resetAt: now + windowMs });
    return false;
  }
  e.count++;
  return e.count > limit;
}

/**
 * Call right after the OPTIONS short-circuit:
 *   const denied = await requireIntelUser(req, corsHeaders);
 *   if (denied) return denied;
 * Returns a 401/429 Response to send back, or null when the caller may proceed.
 */
export async function requireIntelUser(
  req: Request,
  cors: Record<string, string>,
  opts: IntelAuthOptions = {},
): Promise<Response | null> {
  const limit = opts.limit ?? 120;
  const windowMs = opts.windowMs ?? 60_000;
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  // The anon key is a JWT too, but getUser() rejects it (no `sub`), so it
  // can't be used to bypass this gate.
  if (!token) return json({ error: "Sign in required" }, 401, cors);

  const now = Date.now();
  let userId: string | null = null;
  const cached = userCache.get(token);
  if (cached && cached.until > now) {
    userId = cached.userId;
  } else {
    try {
      userId = await lookup(authHeader);
    } catch (e) {
      console.warn("[intel-auth] lookup failed", e);
      userId = null;
    }
    if (userId) {
      if (userCache.size > 5_000) userCache.clear();
      userCache.set(token, { userId, until: now + USER_CACHE_MS });
    }
  }
  if (!userId) return json({ error: "Sign in required" }, 401, cors);

  if (userRateLimited(userId, limit, windowMs, now)) {
    return json({ error: "Rate limit exceeded" }, 429, cors, { "Retry-After": String(Math.ceil(windowMs / 1000)) });
  }
  return null;
}
