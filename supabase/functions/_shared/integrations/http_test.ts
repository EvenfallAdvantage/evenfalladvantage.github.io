import { assertEquals } from "jsr:@std/assert@1";
import { callerRole, publicApiKey } from "./http.ts";

const USER_JWT = "user.access.token";
const REQUEST_KEY = "sb_publishable_from_the_app";
const ENV_KEY = "sb_publishable_from_the_function_env";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.supabase.co/functions/v1/integration-action", { headers });
}

function installFetch(status: number, body: unknown) {
  const calls: { url: string; authorization: string; apikey: string }[] = [];
  const previous = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      authorization: headers.get("authorization") ?? "",
      apikey: headers.get("apikey") ?? "",
    });
    return Promise.resolve(new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }));
  };
  return {
    calls,
    restore() { globalThis.fetch = previous; },
  };
}

Deno.test("publicApiKey keeps a publishable key and drops a secret", () => {
  assertEquals(publicApiKey("sb_publishable_app"), "sb_publishable_app");
  assertEquals(publicApiKey("aaa.bbb.ccc"), "aaa.bbb.ccc");
  assertEquals(publicApiKey("sb_secret_nope"), "");
  assertEquals(publicApiKey(""), "");
});

Deno.test("missing bearer never calls Auth or membership lookup", async () => {
  const net = installFetch(200, { id: "should-not-run" });
  let lookups = 0;
  const admin = { from() { lookups += 1; return {}; } };
  try {
    const caller = await callerRole(req(), admin as never, "company-1");
    assertEquals(caller, { authUserId: null, userId: null, role: null });
    assertEquals(net.calls.length, 0);
    assertEquals(lookups, 0);
  } finally {
    net.restore();
  }
});

Deno.test("getUser receives the request bearer and the app apikey, then the role is read", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", ENV_KEY);
  const net = installFetch(200, { id: "auth-user-1" });
  const tables: string[] = [];
  const admin = {
    from(table: string) {
      tables.push(table);
      const query = {
        select() { return query; },
        eq() { return query; },
        maybeSingle() {
          if (table === "users") return Promise.resolve({ data: { id: "user-1" }, error: null });
          return Promise.resolve({ data: { role: "admin" }, error: null });
        },
      };
      return query;
    },
  };
  try {
    const caller = await callerRole(req({
      authorization: `Bearer ${USER_JWT}`,
      apikey: REQUEST_KEY,
    }), admin as never, "company-1");
    assertEquals(caller, { authUserId: "auth-user-1", userId: "user-1", role: "admin" });
    assertEquals(net.calls.length, 1);
    assertEquals(net.calls[0].url, "https://example.supabase.co/auth/v1/user");
    assertEquals(net.calls[0].authorization, `Bearer ${USER_JWT}`);
    assertEquals(net.calls[0].apikey, REQUEST_KEY);
    assertEquals(net.calls[0].apikey === ENV_KEY, false);
    assertEquals(tables, ["users", "company_memberships"]);
  } finally {
    net.restore();
  }
});

Deno.test("Auth rejection does not look up a role", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", ENV_KEY);
  const net = installFetch(401, { message: "invalid" });
  let lookups = 0;
  const admin = { from() { lookups += 1; return {}; } };
  try {
    const caller = await callerRole(req({
      authorization: `Bearer ${USER_JWT}`,
      apikey: REQUEST_KEY,
    }), admin as never, "company-1");
    assertEquals(caller.authUserId, null);
    assertEquals(caller.role, null);
    assertEquals(lookups, 0);
    assertEquals(net.calls.length, 1);
  } finally {
    net.restore();
  }
});

Deno.test("a client secret key is not used as the Auth apikey", async () => {
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", ENV_KEY);
  const net = installFetch(401, { message: "invalid" });
  try {
    await callerRole(req({
      authorization: `Bearer ${USER_JWT}`,
      apikey: "sb_secret_from_browser",
    }), { from() { return {}; } } as never, "company-1");
    assertEquals(net.calls[0].apikey, ENV_KEY);
    assertEquals(net.calls[0].apikey.startsWith("sb_secret_"), false);
  } finally {
    net.restore();
  }
});
