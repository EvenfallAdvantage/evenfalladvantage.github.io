import { assert, assertEquals } from "jsr:@std/assert@1";
import { FIVE11, five11Url, parse511, parseDigitraffic, parseNps } from "./parsers_keyed.ts";
import { CCTV_SOURCES, disabledSourceIds, enabledSources, redactUrl, type Fetchers } from "./sources.ts";

Deno.test("Digitraffic: one row per active preset, skips removed stations", () => {
  const cams = parseDigitraffic({ features: [
    { geometry: { coordinates: [23.99, 60.05, 0] }, properties: { id: "C01503", name: "kt51_Inkoo", collectionStatus: "GATHERING",
      presets: [{ id: "C0150301", inCollection: true }, { id: "C0150302", inCollection: false }, { id: "../x", inCollection: true }] } },
    { geometry: { coordinates: [24, 61] }, properties: { collectionStatus: "REMOVED_PERMANENTLY", presets: [{ id: "C1" }] } },
    { geometry: { coordinates: [0, 0] }, properties: { presets: [{ id: "C2" }] } },
  ] });
  assertEquals(cams.map((c) => c.id), ["fi-C0150301", "fi-x"]);
  assertEquals(cams[0].feed_url, "https://weathercam.digitraffic.fi/C0150301.jpg");
  assertEquals([cams[0].name, cams[0].lat, cams[0].lng, cams[0].country], ["kt51 Inkoo", 60.05, 23.99, "FI"]);
  assertEquals(parseDigitraffic(null), []);
});

Deno.test("NPS: active + located only, image or page link, https only", () => {
  const cams = parseNps({ data: [
    { id: "A-1", title: "Old Faithful", status: "Active", latitude: 44.46, longitude: -110.83, url: "https://www.nps.gov/yell/cam.htm",
      images: [{ url: "http://x/a.jpg" }, { url: "https://x/b.jpg" }], relatedParks: [{ fullName: "Yellowstone National Park" }] },
    { id: "B", status: "Inactive", latitude: 40, longitude: -100, url: "https://x" },
    { id: "C", status: "Active", latitude: "", longitude: "", url: "https://x" },
    { id: "D", status: "Active", latitude: 40, longitude: -100, url: "http://insecure", images: [] },
  ] });
  assertEquals(cams.length, 1);
  assertEquals([cams[0].id, cams[0].feed_url, cams[0].external_url, cams[0].city],
    ["nps-A-1", "https://x/b.jpg", "https://www.nps.gov/yell/cam.htm", "Yellowstone National Park"]);
});

Deno.test("511: Views[] shape, skips disabled/http views", () => {
  const cams = parse511([
    { Id: 7, Latitude: 33.75, Longitude: -84.39, Location: "I-75 @ 10th St", Roadway: "I-75",
      Views: [{ Id: 70, Url: "https://511ga.org/map/Cctv/70", Status: "Enabled", Description: "NB" },
        { Id: 71, Url: "https://511ga.org/map/Cctv/71", Status: "Disabled" }, { Id: 72, Url: "http://x" }] },
  ], "511 Georgia", "ga", "Georgia", "US");
  assertEquals(cams.length, 1);
  assertEquals([cams[0].id, cams[0].name, cams[0].city, cams[0].source], ["ga-70", "I-75 @ 10th St (NB)", "I-75", "511 Georgia"]);
});

Deno.test("511: flat Url shape (older v2)", () => {
  const [c] = parse511([{ ID: "loc/5", Latitude: 43.6, Longitude: -79.4, Name: "QEW", Url: "https://511on.ca/map/Cctv/5" }],
    "511 Ontario", "on", "Ontario", "CA");
  assertEquals([c.id, c.name, c.country], ["on-loc5", "QEW", "CA"]);
  assertEquals(parse511({ not: "array" }, "x", "x", "x", "US"), []);
});

Deno.test("511 hosts: url encodes key; one request per run", async () => {
  assertEquals(five11Url("https://511ga.org", "a b&c"), "https://511ga.org/api/v2/get/cameras?key=a%20b%26c&format=json");
  const src = CCTV_SOURCES.find((s) => s.id === "511 Georgia")!;
  const seen: string[] = [];
  const f: Fetchers = { json: (u) => { seen.push(u); return Promise.resolve([]); }, text: () => Promise.resolve(null) };
  await src.fetch(f, "k");
  assertEquals(seen.length, 1);
  assertEquals(FIVE11.map((h) => h.secret), ["GA511_API_KEY", "WI511_API_KEY", "ID511_API_KEY", "ONTARIO511_API_KEY", "ALBERTA511_API_KEY"]);
});

Deno.test("registry: keyed sources off until their own secret is set", () => {
  const keyed = ["NPS Webcams", ...FIVE11.map((h) => h.id)];
  const off = enabledSources(undefined).map((s) => s.id);
  assert(keyed.every((id) => !off.includes(id)));
  assert(off.includes("Digitraffic (FI)"));
  const env = (k: string) => (k === "GA511_API_KEY" ? "x" : k === "WI511_API_KEY" ? "  " : undefined);
  const on = enabledSources(undefined, env).map((s) => s.id);
  assert(on.includes("511 Georgia") && !on.includes("511 Wisconsin") && !on.includes("NPS Webcams"));
  assert(disabledSourceIds(undefined).has("511 Georgia"));
  assert(!disabledSourceIds(undefined, env).has("511 Georgia"));
  assert(CCTV_SOURCES.filter((s) => keyed.includes(s.id)).every((s) => s.attribution.length > 0 && s.secret));
});

Deno.test("redactUrl hides keys in logs", () => {
  assertEquals(redactUrl("https://a/x?key=SECRET&format=json"), "https://a/x?key=***&format=json");
  assertEquals(redactUrl("https://a/x?limit=1&api_key=S"), "https://a/x?limit=1&api_key=***");
});
