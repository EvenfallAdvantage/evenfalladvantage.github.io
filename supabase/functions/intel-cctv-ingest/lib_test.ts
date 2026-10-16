import { assert, assertEquals } from "jsr:@std/assert@1";
import { chunk, SecretCache, toRows } from "./lib.ts";

Deno.test("toRows: dedupes, drops invalid coords, stamps attribution", () => {
  const rows = toRows([
    { id: "a", lat: 1, lng: 2, name: "A", city: "", country: "US", source: "S" },
    { id: "a", lat: 3, lng: 4, name: "A2", city: "", country: "US", source: "S" },
    { id: "b", lat: 95, lng: 0, name: "bad", city: "", country: "US", source: "S" },
    { id: "c", lat: NaN, lng: 0, name: "bad", city: "", country: "US", source: "S" },
  ], "attr", "2026-10-16T00:00:00Z");
  assertEquals(rows.length, 1);
  assertEquals([rows[0].lat, rows[0].name, rows[0].attribution, rows[0].online], [3, "A2", "attr", true]);
});

Deno.test("chunk", () => assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]));

Deno.test("SecretCache: hit, miss, expiry", async () => {
  let t = 0;
  const c = new SecretCache(1000, () => t);
  assert(!(await c.has("a".repeat(64))));
  await c.add("a".repeat(64));
  assert(await c.has("a".repeat(64)));
  assert(!(await c.has("b".repeat(64))));
  t = 1001;
  assert(!(await c.has("a".repeat(64))));
});
