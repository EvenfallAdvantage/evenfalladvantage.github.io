import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkCompanyMfa, requireCompanyMfa, type RpcClient } from "./mfa-guard.ts";

const fake = (answers: Record<string, unknown>, calls: unknown[] = []): RpcClient => ({
  rpc: (fn, args) => {
    calls.push([fn, args]);
    const v = answers[args.p_company_id as string];
    return Promise.resolve(v instanceof Error ? { data: null, error: v } : { data: v, error: null });
  },
});

Deno.test("flag off / aal2 (mfa_ok true) proceeds", async () => {
  const calls: unknown[] = [];
  assertEquals(await requireCompanyMfa(fake({ c1: true }, calls), "c1", {}), null);
  assertEquals(calls, [["mfa_ok", { p_company_id: "c1" }]]);
});

Deno.test("flag on + aal1 (mfa_ok false) -> 403 mfa_required", async () => {
  const res = await requireCompanyMfa(fake({ c1: false }), "c1", {});
  assertEquals(res?.status, 403);
  assertEquals((await res!.json()).code, "mfa_required");
});

Deno.test("null / non-boolean result is treated as not ok", async () => {
  assertEquals(await checkCompanyMfa(fake({ c1: null }), ["c1"]), "mfa_required");
  assertEquals(await checkCompanyMfa(fake({ c1: "true" }), ["c1"]), "mfa_required");
});

Deno.test("rpc error fails closed with 503", async () => {
  const res = await requireCompanyMfa(fake({ c1: new Error("boom") }), "c1", {});
  assertEquals(res?.status, 503);
});

Deno.test("no caller token / no company fails closed", async () => {
  assertEquals(await checkCompanyMfa(null, ["c1"]), "error");
  assertEquals(await checkCompanyMfa(fake({}), []), "error");
});

Deno.test("multiple companies: all must pass, deduped", async () => {
  const calls: unknown[] = [];
  assertEquals(await checkCompanyMfa(fake({ a: true, b: false }, calls), ["a", "a", "b"]), "mfa_required");
  assertEquals(calls.length, 2);
  assertEquals(await checkCompanyMfa(fake({ a: true, b: true }), ["a", "b"]), "ok");
});
