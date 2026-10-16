import { assertEquals } from "jsr:@std/assert@1";
import { caltransUrl, parseCaltrans, parseSingapore } from "./lib.ts";

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

Deno.test("parseSingapore", () => {
  const cams = parseSingapore({ items: [{ cameras: [{ camera_id: "2701", location: { latitude: 1.44, longitude: 103.77 }, image: "https://images.data.gov.sg/a.jpg" }, { camera_id: "x" }] }] });
  assertEquals(cams.length, 1);
  assertEquals(cams[0].id, "sin-2701");
});
