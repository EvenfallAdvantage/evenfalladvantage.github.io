import { assert, assertEquals } from "jsr:@std/assert@1";
import { attributionFor, bboxCacheKey, caltransUrl, gridStep, parseBBoxQuery, parseCaltrans, parseNyc, parseSingapore, wrapLng } from "./lib.ts";

Deno.test("caltransUrl: bare district in path, zero-padded file", () => {
  assertEquals(caltransUrl(7), "https://cwwp2.dot.ca.gov/data/d7/cctv/cctvStatusD07.json");
  assertEquals(caltransUrl(11), "https://cwwp2.dot.ca.gov/data/d11/cctv/cctvStatusD11.json");
});

Deno.test("parseCaltrans reads location nested under cctv, skips out-of-service", () => {
  const body = { data: [
    { cctv: { index: "1", inService: "true", location: { latitude: "32.77", longitude: "-117.16", locationName: "SR-163 Friars", nearbyPlace: "San Diego" }, imageData: { static: { currentImageURL: "https://cwwp2.dot.ca.gov/x.jpg" } } } },
    { cctv: { index: "2", inService: "false", location: { latitude: "32.7", longitude: "-117.1" }, imageData: { static: { currentImageURL: "https://cwwp2.dot.ca.gov/y.jpg" } } } },
    { cctv: { index: "3", location: { latitude: "", longitude: "" }, imageData: { static: { currentImageURL: "https://a/z.jpg" } } } },
    { location: { latitude: "32", longitude: "-117" } },
  ] };
  const cams = parseCaltrans(body, 11);
  assertEquals(cams.length, 1);
  assertEquals(cams[0], { id: "cal-d11-1", lat: 32.77, lng: -117.16, name: "SR-163 Friars", city: "San Diego", country: "US", feed_url: "https://cwwp2.dot.ca.gov/x.jpg", source: "Caltrans" });
  assertEquals(parseCaltrans({}, 1), []);
});

Deno.test("parseNyc", () => {
  const cams = parseNyc([
    { id: "a", name: "CPW @ 86", latitude: 40.78, longitude: -73.97, area: "Manhattan", isOnline: "true", imageUrl: "https://webcams.nyctmc.org/api/cameras/a/image" },
    { id: "b", latitude: 40.7, longitude: -73.9, isOnline: "false", imageUrl: "https://x" },
    { id: "c", latitude: 0, longitude: 0, imageUrl: "https://x" },
  ]);
  assertEquals(cams.map((c) => [c.id, c.city]), [["nyc-a", "Manhattan, New York"]]);
  assertEquals(parseNyc({ error: 1 }), []);
});

Deno.test("parseSingapore", () => {
  const cams = parseSingapore({ items: [{ cameras: [{ camera_id: "2701", location: { latitude: 1.44, longitude: 103.77 }, image: "https://images.data.gov.sg/a.jpg" }, { camera_id: "x" }] }] });
  assertEquals(cams.length, 1);
  assertEquals(cams[0].id, "sin-2701");
});

const q = (s: string) => new URLSearchParams(s);

Deno.test("parseBBoxQuery: absent -> null (legacy region mode)", () => {
  assertEquals(parseBBoxQuery(q("region=all")), null);
});

Deno.test("parseBBoxQuery: validation", () => {
  assert("error" in (parseBBoxQuery(q("bbox=1,2,3")) as object));
  assert("error" in (parseBBoxQuery(q("bbox=a,2,3,4")) as object));
});

Deno.test("parseBBoxQuery: rounds outward to grid, clamps limit/zoom", () => {
  const r = parseBBoxQuery(q("bbox=-122.43,37.71,-122.35,37.81&zoom=12&limit=99999")) as { west: number; south: number; east: number; north: number; zoom: number; limit: number };
  const step = gridStep(12);
  assert(r.west <= -122.43 && r.east >= -122.35 && r.south <= 37.71 && r.north >= 37.81);
  assert(Math.abs(r.west / step - Math.round(r.west / step)) < 1e-3);
  assertEquals(r.zoom, 12);
  assertEquals(r.limit, 5000);
  // nearby viewport -> same cache key
  const r2 = parseBBoxQuery(q("bbox=-122.429,37.712,-122.351,37.809&zoom=12&limit=99999")) as typeof r;
  assertEquals(bboxCacheKey(r), bboxCacheKey(r2));
});

Deno.test("parseBBoxQuery: antimeridian + world", () => {
  const dl = parseBBoxQuery(q("bbox=170,-25,195,-5&zoom=6")) as { west: number; east: number };
  assert(dl.west > dl.east, JSON.stringify(dl));
  assertEquals(wrapLng(195), -165);
  const world = parseBBoxQuery(q("bbox=-200,-90,200,90&zoom=1")) as { west: number; east: number };
  assertEquals([world.west, world.east], [-180, 180]);
});

Deno.test("attributionFor", () => {
  assertEquals(attributionFor({ Caltrans: 3, X: 1 }, { Caltrans: "Caltrans CWWP2" }), { Caltrans: "Caltrans CWWP2", X: "X" });
});
