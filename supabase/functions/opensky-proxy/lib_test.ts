import { assert, assertEquals } from "jsr:@std/assert@1";
import { aircraftFlags, bboxToPointQuery, cacheKey, extractAircraft, FLAG_EMERGENCY, FLAG_MILITARY, parseBBox, toOpenSkyStates, upstreamUrls, type BBox } from "./lib.ts";

const LA: BBox = { lamin: 33, lamax: 35, lomin: -119, lomax: -117 };
const p = (q: string) => new URLSearchParams(q);

Deno.test("parseBBox validates", () => {
  assertEquals(parseBBox(p("lamin=33&lamax=35&lomin=-119&lomax=-117")), LA);
  assert("error" in parseBBox(p("lamin=33&lamax=35&lomin=-119")));
  assert("error" in parseBBox(p("lamin=x&lamax=35&lomin=-119&lomax=-117")));
  assert("error" in parseBBox(p("lamin=20&lamax=35&lomin=-119&lomax=-117")));
  assert("error" in parseBBox(p("lamin=35&lamax=33&lomin=-119&lomax=-117")));
  assert("error" in parseBBox(p("lamin=89&lamax=95&lomin=-119&lomax=-117")));
});

Deno.test("point query covers bbox, capped at 250nm", () => {
  const q = bboxToPointQuery(LA);
  assertEquals([q.lat, q.lon], [34, -118]);
  assert(q.radiusNm >= 75 && q.radiusNm <= 85, String(q.radiusNm));
  assertEquals(bboxToPointQuery({ lamin: 30, lamax: 40, lomin: -120, lomax: -110 }).radiusNm, 250);
  assertEquals(upstreamUrls(LA)[0].url, `https://api.adsb.lol/v2/lat/34/lon/-118/dist/${q.radiusNm}`);
  assertEquals(upstreamUrls(LA).length, 1); // adsb.fi (non-commercial terms) removed
});

Deno.test("cacheKey rounds", () => {
  assertEquals(cacheKey({ lamin: 33.04, lamax: 35.01, lomin: -119, lomax: -117 }), "33.0,35.0,-119.0,-117.0");
});

Deno.test("toOpenSkyStates maps units and indices like OpenSky", () => {
  const now = 1_792_093_352;
  const states = toOpenSkyStates([
    { hex: "A68485", flight: "SKW6277 ", lat: 34.23, lon: -118.87, alt_baro: 13850, alt_geom: 14500, gs: 356, track: 142.65, baro_rate: -1216, squawk: "3647", seen: 0.2, seen_pos: 0.19 },
    { hex: "abc123", lat: 33.94, lon: -118.4, alt_baro: "ground", gs: 5 },
    { hex: "out001", lat: 40, lon: -118, alt_baro: 1000 },
    { hex: "nopos1", alt_baro: 1000 },
  ], LA, now);
  assertEquals(states.length, 2);
  const s = states[0];
  assertEquals(s[0], "a68485");
  assertEquals(s[1], "SKW6277");
  assertEquals([s[5], s[6]], [-118.87, 34.23]);
  assertEquals(s[7], 4221.5);
  assertEquals(s[8], false);
  assertEquals(s[9], 183.14);
  assertEquals(s[10], 142.65);
  assertEquals(s[11], -6.18);
  assertEquals(s[13], 4419.6);
  assertEquals(s[4], now);
  assertEquals(states[1][8], true);
  assertEquals(states[1][7], 0);
});

Deno.test("extractAircraft handles `ac` and `aircraft` readsb shapes", () => {
  assertEquals(extractAircraft({ ac: [{ hex: "a" }] })?.length, 1);
  assertEquals(extractAircraft({ aircraft: [{ hex: "a" }, { hex: "b" }] })?.length, 2);
  assertEquals(extractAircraft({ msg: "err" }), null);
  assertEquals(extractAircraft(null), null);
});

Deno.test("military / emergency flags and accuracy fields are appended at 17-21", () => {
  assertEquals(aircraftFlags({ dbFlags: 1 }), FLAG_MILITARY);
  assertEquals(aircraftFlags({ dbFlags: 8 }), 0);
  assertEquals(aircraftFlags({ squawk: "7700" }), FLAG_EMERGENCY);
  assertEquals(aircraftFlags({ squawk: "1200", emergency: "none" }), 0);
  assertEquals(aircraftFlags({ emergency: "lifeguard", dbFlags: 3 }), FLAG_MILITARY | FLAG_EMERGENCY);
  const [s] = toOpenSkyStates([{ hex: "ae1234", lat: 34, lon: -118, alt_baro: 20000, dbFlags: 1, squawk: "7600", emergency: "nordo", nac_p: 6, nic: 5, t: "C17" }], LA, 0);
  assertEquals(s.slice(17), [FLAG_MILITARY | FLAG_EMERGENCY, 6, 5, "C17", "nordo"]);
  assertEquals(s[14], "7600");
  const [plain] = toOpenSkyStates([{ hex: "a1", lat: 34, lon: -118, alt_baro: 1000 }], LA, 0);
  assertEquals(plain.slice(17), [0, null, null, null, null]);
});
