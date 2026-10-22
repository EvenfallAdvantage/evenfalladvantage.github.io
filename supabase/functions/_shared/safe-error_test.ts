import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { internalErrorResponse } from "./safe-error.ts";

Deno.test("500 body never contains the error message or stack", async () => {
  const origErr = console.error; console.error = () => {};
  try {
    const err = new Error("stripe: No such price: price_SECRET at /var/task/index.ts:42");
    const res = internalErrorResponse("t", err, { "Content-Type": "application/json" });
    assertEquals(res.status, 500);
    const text = await res.text();
    assertEquals(text.includes("price_SECRET") || text.includes("index.ts") || text.includes("at "), false);
    assertEquals(typeof JSON.parse(text).ref, "string");
  } finally { console.error = origErr; }
});
