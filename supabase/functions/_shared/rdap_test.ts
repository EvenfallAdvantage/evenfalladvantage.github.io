import { assertEquals } from "jsr:@std/assert@1";
import { parseRdapAutnum, parseRdapNetwork, ptrName } from "./rdap.ts";

const NET = {
  handle: "NET-8-8-8-0-2", name: "GOGL", type: "DIRECT ALLOCATION",
  startAddress: "8.8.8.0", endAddress: "8.8.8.255",
  cidr0_cidrs: [{ v4prefix: "8.8.8.0", length: 24 }],
  links: [{ rel: "self", href: "https://rdap.arin.net/registry/ip/8.8.8.0" }],
  entities: [{
    roles: ["registrant"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Google LLC"]]],
    entities: [{ roles: ["abuse"], vcardArray: ["vcard", [["email", {}, "text", "network-abuse@google.com"]]] }],
  }],
};

Deno.test("parseRdapNetwork", () => {
  const n = parseRdapNetwork(NET);
  assertEquals(n.cidr, ["8.8.8.0/24"]);
  assertEquals(n.org, "Google LLC");
  assertEquals(n.abuse_email, "network-abuse@google.com");
  assertEquals(n.registry_url, "https://rdap.arin.net/registry/ip/8.8.8.0");
});

Deno.test("parseRdapAutnum", () => {
  const a = parseRdapAutnum({ handle: "AS15169", startAutnum: 15169, name: "GOOGLE", entities: NET.entities });
  assertEquals(a.number, 15169);
  assertEquals(a.org, "Google LLC");
});

Deno.test("ptrName", () => {
  assertEquals(ptrName("8.8.4.4"), "4.4.8.8.in-addr.arpa");
  assertEquals(ptrName("::1"), null);
});
