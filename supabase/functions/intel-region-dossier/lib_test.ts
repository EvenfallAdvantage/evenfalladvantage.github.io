import { assertEquals } from "jsr:@std/assert@1";
import { countrySparql, flagEmoji, parseCountry, parseNominatim, parsePhoton } from "./lib.ts";

Deno.test("parseNominatim: ok and blocked", () => {
  assertEquals(parseNominatim({ address: { country: "France", country_code: "fr", city: "Paris", state: "IDF" }, display_name: "Paris, France" }),
    { city: "Paris", state: "IDF", country: "France", country_code: "FR", display_name: "Paris, France" });
  assertEquals(parseNominatim({ error: "Unable to geocode" }), null);
  assertEquals(parseNominatim(null), null);
});

Deno.test("parsePhoton", () => {
  const r = parsePhoton({ features: [{ properties: { name: "Coffea", city: "Paris", state: "Île-de-France", country: "France", countrycode: "FR" } }] });
  assertEquals(r?.country_code, "FR");
  assertEquals(r?.display_name, "Coffea, Paris, Île-de-France, France");
  assertEquals(parsePhoton({ features: [] }), null);
});

Deno.test("flagEmoji + sparql guard", () => {
  assertEquals(flagEmoji("JP"), "🇯🇵");
  assertEquals(flagEmoji("x"), "");
  let threw = false; try { countrySparql('FR" } #'); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("parseCountry", () => {
  const r = parseCountry({ results: { bindings: [{
    name: { value: "Japan" }, capital: { value: "Tokyo" }, population: { value: "123802000" },
    areaKm: { value: "377973.68" }, hos: { value: "Naruhito" }, hog: { value: "Sanae Takaichi" },
    currencies: { value: "yen (JPY)" }, languages: { value: "Japanese" }, continent: { value: "Asia" },
  }] } }, "JP", "Japan");
  assertEquals(r?.country.area, 377974);
  assertEquals(r?.country.currencies, ["yen (JPY)"]);
  assertEquals(r?.country.flag_url, "https://flagcdn.com/jp.svg");
  assertEquals(r?.head_of_state?.name, "Naruhito");
  assertEquals(parseCountry({ results: { bindings: [] } }, "JP", "Japan"), null);
});
