import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  cleanPolygonGeometry, coneHazard, cycloneSeverity, kmlFromKmz, kmlLongestLine, kmlPolygons, parseEonetVolcanoes,
  parseFirmsCsv, parseKinds, parseNhcStorms, parsePerimeters, parseUsgs, parseWwa, perimeterSeverity, quakeSeverity, trackHazard, TtlCache,
} from "./lib.ts";

const sq = (x: number, y: number) => [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]];

Deno.test("parseKinds defaults and filters unknown", () => {
  assertEquals(parseKinds(null), ["warnings", "quakes", "fires", "perimeters", "tropical"]);
  assertEquals(parseKinds("tropical, bogus,WARNINGS"), ["warnings", "tropical"]);
});

Deno.test("parseWwa keeps land W/A/Y, drops marine/frost/statements, merges segments", () => {
  const f = (props: Record<string, string>, g = sq(-100, 35)) => ({ type: "Feature", properties: { onset: "2026-10-18T10:00:00-05:00", ends: "2026-10-18T20:00:00-05:00", issuance: "2026-10-18T09:00:00-05:00", wfo: "KOUN", url: "https://api.weather.gov/alerts/x", ...props }, geometry: { type: "Polygon", coordinates: g } });
  const out = parseWwa({ features: [
    f({ prod_type: "Tornado Warning", sig: "W", phenom: "TO", cap_id: "a" }),
    f({ prod_type: "Tornado Warning", sig: "W", phenom: "TO", cap_id: "a" }, sq(-99, 35)),
    f({ prod_type: "Flood Watch", sig: "A", phenom: "FA", cap_id: "b" }),
    f({ prod_type: "Wind Advisory", sig: "Y", phenom: "WI", cap_id: "c" }),
    f({ prod_type: "Small Craft Advisory", sig: "Y", phenom: "SC", cap_id: "d" }),
    f({ prod_type: "Frost Advisory", sig: "Y", phenom: "FR", cap_id: "e" }),
    f({ prod_type: "Special Weather Statement", sig: " ", phenom: "", cap_id: "f" }),
  ] });
  assertEquals(out.map((h) => [h.title, h.kind, h.severity]), [["Tornado Warning", "warning", 4], ["Flood Watch", "watch", 2], ["Wind Advisory", "advisory", 1]]);
  assertEquals(out[0].geometry.type, "MultiPolygon");
  assertEquals(out[0].starts_at, "2026-10-18T15:00:00.000Z");
  assertEquals(out[0].ends_at, "2026-10-19T01:00:00.000Z");
});

Deno.test("cleanPolygonGeometry rounds and rejects junk", () => {
  const g = cleanPolygonGeometry({ type: "Polygon", coordinates: [[[1.23456, 2.34567], [2, 2], [2, 3], [1.23456, 2.34567]]] });
  assertEquals(g, { type: "Polygon", coordinates: [[[1.235, 2.346], [2, 2], [2, 3], [1.235, 2.346]]] });
  assertEquals(cleanPolygonGeometry({ type: "Point", coordinates: [1, 2] }), null);
  assertEquals(cleanPolygonGeometry({ type: "Polygon", coordinates: [[[1, 2]]] }), null);
});

Deno.test("parseUsgs + severity", () => {
  const out = parseUsgs({ features: [{ id: "us1", geometry: { coordinates: [-120.5, 36.1, 8] }, properties: { mag: 5.2, place: "10 km N of X", time: 1760000000000, url: "https://e", tsunami: 0 } }, { id: "bad", geometry: { coordinates: [] }, properties: {} }] });
  assertEquals(out.length, 1);
  assertEquals(out[0].title, "M5.2 10 km N of X");
  assertEquals(out[0].severity, 3);
  assertEquals([quakeSeverity(3), quakeSeverity(4.1), quakeSeverity(6.5)], [1, 2, 4]);
});

Deno.test("parseFirmsCsv keeps the strongest fires when sampling", () => {
  const csv = "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,version,bright_ti5,frp,daynight\n" +
    "10,20,300,0,0,2026-10-18,0130,N,n,2,280,5,N\n" +
    "11,21,300,0,0,2026-10-18,0931,N,h,2,280,150,N\n" +
    "x,21,300,0,0,2026-10-18,0931,N,h,2,280,150,N\n";
  const out = parseFirmsCsv(csv, 1);
  assertEquals(out.length, 1);
  assertEquals(out[0].geometry, { type: "Point", coordinates: [21, 11] });
  assertEquals(out[0].severity, 3);
  assertEquals(out[0].starts_at, "2026-10-18T09:31:00.000Z");
});

Deno.test("parsePerimeters", () => {
  const out = parsePerimeters({ features: [{ properties: { poly_IncidentName: "Mukluk", poly_GISAcres: 7339.1, attr_PercentContained: 40, attr_UniqueFireIdentifier: "2026-AK-1", poly_DateCurrent: 1788906192000 }, geometry: { type: "MultiPolygon", coordinates: [sq(-150, 65)] } }, { properties: { poly_IncidentName: "Out", poly_GISAcres: 50000, attr_PercentContained: 100 }, geometry: { type: "Polygon", coordinates: sq(-120, 40) } }] });
  assertEquals(out[0].title, "Mukluk Fire · 7,339 ac · 40% contained");
  assertEquals(out[0].severity, 2);
  assertEquals(out[1].severity, 1); // fully contained
  assertEquals([perimeterSeverity(10), perimeterSeverity(20000), perimeterSeverity(200000)], [1, 3, 4]);
});

Deno.test("NHC storms, KMZ cone and track (real Hurricane Trudy advisory 20A fixtures)", async () => {
  const storm = { id: "ep212026", name: "Trudy", classification: "HU", intensity: "90", pressure: "970", latitudeNumeric: 18.9, longitudeNumeric: -106.6, movementDir: 320, movementSpeed: 10, lastUpdate: "2026-10-18T12:00:00.000Z", publicAdvisory: { url: "https://www.nhc.noaa.gov/text/MIATCPEP1.shtml" } };
  const { storms, points } = parseNhcStorms({ activeStorms: [storm, { id: "bad", latitudeNumeric: NaN }] });
  assertEquals(storms.length, 1);
  assertEquals(points[0].title, "Hurricane Trudy · 104 mph · 970 mb");
  assertEquals(points[0].severity, 3);
  const cone = await kmlFromKmz(await Deno.readFile(new URL("./fixtures/cone.kmz", import.meta.url)));
  assert(cone);
  const rings = kmlPolygons(cone);
  assertEquals(rings.length, 1);
  assert(rings[0].length > 20);
  const c = coneHazard(storms[0], rings, 3);
  assertEquals(c?.kind, "cyclone_cone");
  const track = await kmlFromKmz(await Deno.readFile(new URL("./fixtures/track.kmz", import.meta.url)));
  assert(track);
  const line = kmlLongestLine(track);
  assertEquals(line?.[0], [-106.6, 18.9]);
  assertEquals(line?.length, 7);
  assertEquals(trackHazard(storms[0], line, 3)?.geometry.type, "LineString");
  assertEquals(await kmlFromKmz(new Uint8Array([1, 2, 3])), null);
});

Deno.test("cycloneSeverity", () => {
  assertEquals([cycloneSeverity("TD", 30), cycloneSeverity("TS", 50), cycloneSeverity("HU", 80), cycloneSeverity("HU", 120)], [1, 2, 3, 4]);
});

Deno.test("parseEonetVolcanoes uses the latest geometry", () => {
  const out = parseEonetVolcanoes({ events: [{ id: "E1", title: "Etna", geometry: [{ coordinates: [15, 37.7], date: "2026-10-01T00:00:00Z" }, { coordinates: [15.004, 37.75], date: "2026-10-10T00:00:00Z" }] }] });
  assertEquals(out[0].geometry, { type: "Point", coordinates: [15.004, 37.75] });
});

Deno.test("TtlCache expiry and stale fallback", () => {
  const c = new TtlCache<number>();
  c.set("a", 1, 1000, 0);
  assertEquals(c.get("a", 500), 1);
  assertEquals(c.get("a", 1500), undefined);
  assertEquals(c.stale("a"), 1);
});
