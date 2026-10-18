import { assertEquals } from "jsr:@std/assert@1";
import { getCorsHeaders, isAllowedOrigin } from "./cors.ts";

Deno.test("cors: site origins (www and bare domain) are allowed", () => {
  for (const o of ["https://www.evenfalladvantage.com", "https://evenfalladvantage.com", "https://evenfalladvantage.github.io", "http://localhost:3000"]) {
    assertEquals(isAllowedOrigin(o), true, o);
    assertEquals(getCorsHeaders(o)["Access-Control-Allow-Origin"], o);
  }
});

Deno.test("cors: look-alike and other origins are not reflected", () => {
  for (const o of ["https://evil-evenfalladvantage.com", "https://evenfalladvantage.com.evil.io", "http://evenfalladvantage.com", "https://sub.evenfalladvantage.com", null]) {
    assertEquals(isAllowedOrigin(o), false, String(o));
    assertEquals(getCorsHeaders(o)["Access-Control-Allow-Origin"], undefined);
  }
});
