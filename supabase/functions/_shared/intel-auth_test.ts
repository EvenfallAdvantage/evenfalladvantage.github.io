import { assertEquals } from "jsr:@std/assert@1";
import { _setUserLookupForTests, requireIntelUser, userRateLimited } from "./intel-auth.ts";

const cors = { "Access-Control-Allow-Origin": "*" };
const req = (auth?: string) => new Request("https://x/fn", { headers: auth ? { Authorization: auth } : {} });

Deno.test("401 without a bearer token", async () => {
  _setUserLookupForTests(async () => "u1");
  const r = await requireIntelUser(req(), cors);
  assertEquals(r?.status, 401);
  await r?.body?.cancel();
});

Deno.test("401 when the token is not a user session (e.g. anon key)", async () => {
  _setUserLookupForTests(async () => null);
  const r = await requireIntelUser(req("Bearer anon"), cors);
  assertEquals(r?.status, 401);
  await r?.body?.cancel();
});

Deno.test("passes a signed-in user, then rate limits per user", async () => {
  let calls = 0;
  _setUserLookupForTests(async () => { calls++; return "u2"; });
  assertEquals(await requireIntelUser(req("Bearer t"), cors, { limit: 2 }), null);
  assertEquals(await requireIntelUser(req("Bearer t"), cors, { limit: 2 }), null);
  const r = await requireIntelUser(req("Bearer t"), cors, { limit: 2 });
  assertEquals(r?.status, 429);
  await r?.body?.cancel();
  assertEquals(calls, 1); // token→user cached
  _setUserLookupForTests(null);
});

Deno.test("userRateLimited window resets", () => {
  _setUserLookupForTests(null);
  assertEquals(userRateLimited("a", 1, 1000, 0), false);
  assertEquals(userRateLimited("a", 1, 1000, 10), true);
  assertEquals(userRateLimited("a", 1, 1000, 2000), false);
});
