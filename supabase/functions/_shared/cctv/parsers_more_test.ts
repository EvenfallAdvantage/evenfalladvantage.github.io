import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  fetchArcgisAll, parseAustin, parseDriveBC, parseHongKong, parseIllinois, parseIowa, parseNzta, parseTfl, parseTripCheck,
} from "./parsers_more.ts";
import { CCTV_SOURCES, disabledSourceIds, enabledSources } from "./sources.ts";

Deno.test("Illinois: snapshot https, skips TooOld, direction suffix", () => {
  const cams = parseIllinois({ features: [
    { attributes: { OBJECTID: 1, CameraLocation: "Hillside 9", CameraDirection: "WB", y: 41.88, x: -87.91, SnapShot: "https://cctv.travelmidwest.com/a.jpg", TooOld: "false" } },
    { attributes: { OBJECTID: 2, y: 41.8, x: -87.9, SnapShot: "https://x/b.jpg", TooOld: "true" } },
    { attributes: { OBJECTID: 3, y: 41.8, x: -87.9, SnapShot: "http://x/c.jpg" } },
  ] });
  assertEquals(cams.length, 1);
  assertEquals([cams[0].id, cams[0].name, cams[0].source], ["il-1", "Hillside 9 (WB)", "Travel Midwest (IL)"]);
});

Deno.test("Iowa: uses lat/lng attrs (not web-mercator geometry)", () => {
  const [c] = parseIowa({ features: [{ attributes: { device_id: 5, Desc_: "US 30", ImageURL: "https://a/b.jpeg", VideoURL: "https://v/p.m3u8", latitude: 42.0, longitude: -93.6 }, geometry: { x: -1e7, y: 5e6 } }] });
  assertEquals([c.id, c.lat, c.lng, c.stream_url], ["ia-b", 42.0, -93.6, "https://v/p.m3u8"]);
});

Deno.test("TripCheck: builds RoadCams URL, rejects odd filenames", () => {
  const cams = parseTripCheck({ features: [
    { attributes: { cameraId: 9, filename: "I5_x.jpg", latitude: 45.5, longitude: -122.6, title: "I-5", route: "I-5" } },
    { attributes: { cameraId: 10, filename: "../evil.jpg", latitude: 45.5, longitude: -122.6 } },
    { attributes: { cameraId: 11, filename: "I-5@Goshen_pid1504.jpg", latitude: 45.5, longitude: -122.6 } },
  ] });
  assertEquals(cams.length, 2);
  assertEquals(cams[0].feed_url, "https://tripcheck.com/RoadCams/cams/I5_x.jpg");
  assertEquals(cams[1].feed_url, "https://tripcheck.com/RoadCams/cams/I-5%40Goshen_pid1504.jpg");
});

Deno.test("DriveBC: GeoJSON point, strips cache-buster, skips off/stale", () => {
  const cams = parseDriveBC([
    { id: 1027, name: "Needles", links: { imageDisplay: "/images/1027.jpg?t=1" }, location: { coordinates: [-118.1, 49.87] }, is_on: true, marked_stale: false, region_name: "Southern Interior" },
    { id: 1, links: { imageDisplay: "/images/1.jpg" }, location: { coordinates: [-118, 49] }, is_on: false },
    { id: 2, links: { imageDisplay: "/images/2.jpg" }, location: { coordinates: [-118, 49] }, is_on: true, marked_stale: true },
  ]);
  assertEquals(cams.length, 1);
  assertEquals([cams[0].lat, cams[0].lng, cams[0].feed_url], [49.87, -118.1, "https://www.drivebc.ca/images/1027.jpg"]);
});

Deno.test("Hong Kong XML", () => {
  const xml = `<image-list><image><key>H429F</key><region>HK Island</region><district>Southern</district>
    <description>Aberdeen Praya Rd &amp; Fish Market</description><latitude>22.24845</latitude><longitude>114.1505</longitude>
    <url>https://tdcctv.data.one.gov.hk/H429F.JPG</url></image><image><key>X</key><latitude>0</latitude><longitude>0</longitude><url>https://a</url></image></image-list>`;
  const cams = parseHongKong(xml);
  assertEquals(cams.length, 1);
  assertEquals([cams[0].id, cams[0].name, cams[0].city], ["hk-H429F", "Aberdeen Praya Rd & Fish Market", "Southern"]);
  assertEquals(parseHongKong(null), []);
});

Deno.test("Austin: TURNED_ON only", () => {
  const cams = parseAustin([
    { camera_id: "670", location_name: " BRODIE LN ", camera_status: "TURNED_ON", screenshot_address: "https://cctv.austinmobility.io/image/670.jpg", location: { coordinates: [-97.82, 30.23] } },
    { camera_id: "1", camera_status: "VOID", screenshot_address: "https://a", location: { coordinates: [-97.8, 30.2] } },
  ]);
  assertEquals(cams.map((c) => [c.id, c.name]), [["atx-670", "BRODIE LN"]]);
});

Deno.test("TfL: imageUrl from additionalProperties, skips unavailable", () => {
  const mk = (id: string, avail: string) => ({ id: `JamCams_${id}`, commonName: "A406", lat: 51.5, lon: -0.1, additionalProperties: [
    { key: "available", value: avail }, { key: "imageUrl", value: `https://s3/${id}.jpg` }, { key: "videoUrl", value: `https://s3/${id}.mp4` }] });
  const cams = parseTfl([mk("00002.00865", "true"), mk("x", "false")]);
  assertEquals(cams.length, 1);
  assertEquals([cams[0].id, cams[0].feed_url, cams[0].stream_url], ["tfl-00002.00865", "https://s3/00002.00865.jpg", "https://s3/00002.00865.mp4"]);
});

Deno.test("NZTA: string coords, skips Offline", () => {
  const cams = parseNzta({ features: [
    { properties: { ExternalId: 706, Name: "SH1", Offline: 0, ImageUrl: "https://www.trafficnz.info/camera/706.jpg", Latitude: "-43.44", Longitude: "172.61" } },
    { properties: { ExternalId: 7, Offline: 1, ImageUrl: "https://a", Latitude: "-43", Longitude: "172" } },
  ] });
  assertEquals(cams.map((c) => [c.id, c.lat]), [["nz-706", -43.44]]);
});

Deno.test("fetchArcgisAll pages until exceededTransferLimit is false", async () => {
  const urls: string[] = [];
  const get = (u: string) => {
    urls.push(u);
    const page = urls.length;
    // server caps at 2 per page even though 5 were requested
    return Promise.resolve({ features: [{ attributes: { n: page } }, { attributes: { n: page } }], exceededTransferLimit: page < 3 });
  };
  const r = await fetchArcgisAll(get, "https://x/FeatureServer/0", 5);
  assertEquals(r.features.length, 6);
  assert(urls[1].includes("resultOffset=2&") && urls[2].includes("resultOffset=4&") && urls[0].includes("outSR=4326"));
});

Deno.test("registry: unique ids, attribution on all, terms-pending gated", () => {
  const ids = CCTV_SOURCES.map((s) => s.id);
  assertEquals(new Set(ids).size, ids.length);
  assert(CCTV_SOURCES.every((s) => s.attribution.length > 0));
  const def = enabledSources(undefined).map((s) => s.id);
  // IL / IA / OR terms approved: on by default.
  assert(def.includes("Iowa DOT") && def.includes("Travel Midwest (IL)") && def.includes("ODOT TripCheck"));
  assert(def.includes("TfL JamCams"));
  const keyed = CCTV_SOURCES.filter((s) => s.secret).length;
  assertEquals(enabledSources("all").length, CCTV_SOURCES.length - 1 - keyed); // all but NYC DOT and unkeyed
});

Deno.test("registry: NYC DOT needs an explicit opt-in (agreement required)", () => {
  assert(!enabledSources(undefined).some((s) => s.id === "NYC DOT"));
  assert(!enabledSources("all").some((s) => s.id === "NYC DOT"));
  assert(enabledSources("all,NYC DOT").some((s) => s.id === "NYC DOT"));
  assert(disabledSourceIds(undefined).has("NYC DOT"));
  assert(!disabledSourceIds("NYC DOT").has("NYC DOT"));
});
