import { assertEquals } from "jsr:@std/assert@1";
import { countrySparql, flagEmoji, parseCountry, nearbyPlacesSparql, parseNearby, parsePhoton, pickPlace, trimExtract, articleNear, haversineKm, titleCandidates } from "./lib.ts";

Deno.test("parsePhoton", () => {
  const r = parsePhoton({ features: [{ properties: { name: "Coffea", type: "house", city: "Paris", state: "Île-de-France", country: "France", countrycode: "FR" } }] });
  assertEquals(r?.country_code, "FR");
  assertEquals(r?.display_name, "Paris, Île-de-France, France");
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

Deno.test("parsePhoton: skips local-script POI, keeps place-type name", () => {
  const tokyo = parsePhoton({ features: [{ properties: { name: "日本大学鶴ヶ丘高等学校", type: "house", district: "Suginami", city: "Tokyo", country: "Japan", countrycode: "JP" } }] });
  assertEquals(tokyo?.display_name, "Suginami, Tokyo, Japan");
  const town = parsePhoton({ features: [{ properties: { name: "Sainte-Montaine", type: "city", county: "Cher", country: "France", countrycode: "FR" } }] });
  assertEquals(town?.display_name, "Sainte-Montaine, Cher, France");
});

const wd = (rows: [string, string, number, number][]) => ({ results: { bindings: rows.map(([label, slug, pop, dist]) => ({
  label: { value: label }, article: { value: `https://en.wikipedia.org/wiki/${slug}` }, pop: { value: String(pop) }, dist: { value: String(dist) },
})) } });

Deno.test("pickPlace: Washington DC → Washington, D.C. (not state / metro / diocese)", () => {
  const hits = parseNearby(wd([
    ["Syro-Malankara Catholic Eparchy", "Syro-Malankara_Eparchy", 317238626, 3.2],
    ["Washington metropolitan area", "Washington_metropolitan_area", 6385162, 2.1],
    ["Washington, D.C.", "Washington,_D.C.", 689545, 1.4],
    ["Arlington", "Arlington,_Virginia", 238643, 6.4],
  ]));
  assertEquals(pickPlace(hits, "Washington")?.title, "Washington, D.C.");
  assertEquals(pickPlace(hits, undefined)?.title, "Washington, D.C.");
});

Deno.test("pickPlace: Paris, Tokyo, accents, nothing near", () => {
  const paris = parseNearby(wd([["First French Empire", "First_French_Empire", 44e6, 1.6], ["Paris metropolitan area", "Paris_metropolitan_area", 13e6, 5.8], ["Paris", "Paris", 2.1e6, 0]]));
  assertEquals(pickPlace(paris, "Paris")?.title, "Paris");
  const tokyo = parseNearby(wd([["Greater Tokyo Area", "Greater_Tokyo_Area", 37.9e6, 4], ["Tokyo", "Tokyo", 14.2e6, 4], ["Tokyo", "Tokyo_Proper", 9.6e6, 11.2]]));
  assertEquals(pickPlace(tokyo, "Tokyo")?.title, "Tokyo");
  const aub = parseNearby(wd([["Aubigny-sur-Nère", "Aubigny-sur-N%C3%A8re", 5451, 6.8]]));
  assertEquals(pickPlace(aub, "Aubigny-sur-Nere")?.title, "Aubigny-sur-Nère");
  assertEquals(pickPlace([], "Nowhere"), null);
  assertEquals(parseNearby(null), []);
});

Deno.test("nearbyPlacesSparql: lon-lat order + guard", () => {
  const q = nearbyPlacesSparql(38.9, -77.03);
  assertEquals(q.includes('Point(-77.03 38.9)'), true);
  assertEquals(q.includes('radius "3"'), true);
  assertEquals(q.includes("LIMIT 15"), true);
  assertEquals(q.includes("ORDER BY"), false);
  let threw = false; try { nearbyPlacesSparql(NaN, 0); } catch { threw = true; }
  assertEquals(threw, true);
});

Deno.test("trimExtract: sentence, word, short", () => {
  assertEquals(trimExtract("Short."), "Short.");
  assertEquals(trimExtract(undefined), undefined);
  const s = "A".repeat(300) + ". " + "Bbbb ".repeat(100);
  assertEquals(trimExtract(s), "A".repeat(300) + ".");
  const w = "word ".repeat(200);
  const r = trimExtract(w)!;
  assertEquals(r.endsWith("word…"), true);
  assertEquals(r.length <= 501, true);
});

Deno.test("parsePhoton: city-type feature with no city field (New York)", () => {
  const r = parsePhoton({ features: [{ properties: { name: "New York", type: "city", state: "New York", country: "United States", countrycode: "US" } }] });
  assertEquals(r?.city, "New York");
});

Deno.test("haversineKm", () => {
  const d = haversineKm(48.8566, 2.3522, 51.5072, -0.1276);
  assertEquals(d > 330 && d < 350, true);
  assertEquals(haversineKm(1, 1, 1, 1), 0);
});

Deno.test("articleNear: coords within 30 km, rejects disambiguation / far / no coords", () => {
  const paris = { type: "standard", extract: "Paris is…", coordinates: { lat: 48.8567, lon: 2.3522 } };
  assertEquals(articleNear(paris, 48.86, 2.35), true);
  assertEquals(articleNear(paris, 47.49, 2.44), false); // Aubigny click ≠ Paris
  assertEquals(articleNear({ type: "disambiguation", extract: "Washington may refer to" }, 38.9, -77.03), false);
  assertEquals(articleNear({ type: "standard", extract: "x" }, 0, 0), false);
  assertEquals(articleNear(null, 0, 0), false);
  // Washington (state) article is ~400 km from the White House
  assertEquals(articleNear({ type: "standard", extract: "x", coordinates: { lat: 47.5, lon: -120.5 } }, 38.8977, -77.0365), false);
});

Deno.test("titleCandidates: Washington → 'Washington, District of Columbia'; NY → 'New York, New York'", () => {
  assertEquals(titleCandidates("Washington", "District of Columbia"), ["Washington", "Washington, District of Columbia", "Washington, Washington", "Washington City"]);
  assertEquals(titleCandidates("New York", "New York"), ["New York", "New York, New York", "New York City"]);
  assertEquals(titleCandidates("", "X"), []);
  assertEquals(titleCandidates(undefined, undefined), []);
});
