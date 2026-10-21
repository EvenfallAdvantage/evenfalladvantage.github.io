import { assertEquals } from "jsr:@std/assert@1";
import { overallStatus, timed } from "./lib.ts";

const ok = { ok: true, ms: 1 }, bad = { ok: false, ms: 1 };
Deno.test("overall: all ok", () => assertEquals(overallStatus({ database: ok, auth: ok, storage: ok }), "ok"));
Deno.test("overall: auth down is degraded", () => assertEquals(overallStatus({ database: ok, auth: bad, storage: ok }), "degraded"));
Deno.test("overall: database down is down", () => assertEquals(overallStatus({ database: bad, auth: ok, storage: ok }), "down"));
Deno.test("timed: throw → not ok", async () => assertEquals((await timed(() => Promise.reject(new Error("x")))).ok, false));
Deno.test("timed: timeout → not ok", async () => assertEquals((await timed(() => new Promise((r) => setTimeout(() => r(true), 200)), 20)).ok, false));
Deno.test("timed: success", async () => assertEquals((await timed(() => Promise.resolve(true))).ok, true));
