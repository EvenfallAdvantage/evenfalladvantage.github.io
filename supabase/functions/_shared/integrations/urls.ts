/**
 * Public URLs for OAuth redirects and webhooks.
 *
 * Decision #6: a custom domain (e.g. https://api.evenfalladvantage.com/integrations)
 * fronts the Edge Functions. Set INTEGRATIONS_PUBLIC_BASE to that base once DNS
 * and the proxy exist; until then everything falls back to the Supabase
 * function URLs. The value registered with each vendor must match exactly.
 *
 *   custom:   <base>/oauth/callback/<provider>      <base>/webhook/<provider>
 *   fallback: <SUPABASE_URL>/functions/v1/integration-oauth-callback/<provider>
 *             <SUPABASE_URL>/functions/v1/integration-webhook/<provider>
 */

type Env = (name: string) => string | undefined;

const PROVIDER_RE = /^[a-z][a-z0-9_]{1,31}$/;
export const isProviderSlug = (p: string | null | undefined): p is string => !!p && PROVIDER_RE.test(p);

function customBase(env: Env): string | null {
  const raw = (env("INTEGRATIONS_PUBLIC_BASE") ?? "").trim().replace(/\/+$/, "");
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

function supabaseFunctions(env: Env): string {
  const base = (env("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("SUPABASE_URL missing");
  return `${base}/functions/v1`;
}

export function oauthCallbackUrl(provider: string, env: Env): string {
  if (!isProviderSlug(provider)) throw new Error("bad provider");
  const c = customBase(env);
  return c ? `${c}/oauth/callback/${provider}` : `${supabaseFunctions(env)}/integration-oauth-callback/${provider}`;
}

export function webhookUrl(provider: string, env: Env): string {
  if (!isProviderSlug(provider)) throw new Error("bad provider");
  const c = customBase(env);
  return c ? `${c}/webhook/${provider}` : `${supabaseFunctions(env)}/integration-webhook/${provider}`;
}

/** The provider is always the last path segment, whichever host forwarded the call. */
export function providerFromPath(url: string): string | null {
  const seg = new URL(url).pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return isProviderSlug(seg) ? seg : null;
}

/** Where to send the browser after OAuth. Only same-app relative paths are allowed. */
export function appRedirect(env: Env, provider: string, result: "ok" | "error", redirectAfter?: string | null, reason?: string): string {
  const app = (env("OVERWATCH_APP_URL") ?? "https://www.evenfalladvantage.com/overwatch").replace(/\/+$/, "");
  const path = redirectAfter && /^\/[A-Za-z0-9/_-]*$/.test(redirectAfter) && !redirectAfter.startsWith("//")
    ? redirectAfter
    : "/admin/settings";
  const q = new URLSearchParams({ integration: provider, result });
  if (reason) q.set("reason", reason.slice(0, 60));
  return `${app}${path}?${q.toString()}#hq-integrations`;
}
