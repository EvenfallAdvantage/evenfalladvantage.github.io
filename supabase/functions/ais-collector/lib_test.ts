import { assert, assertEquals } from "jsr:@std/assert@1";
import { ShipBuffer, decodeFrame, parseAisstream, parseDigitrafficLocations, parseDigitrafficVessels, subscription, validPos } from "./lib.ts";

const NOW = "2026-10-19T15:00:00.000Z";

Deno.test("parseAisstream position report", () => {
  const r = parseAisstream({ MessageType: "PositionReport", MetaData: { MMSI: 368207620, ShipName: "EXAMPLE VESSEL@@@ ", latitude: 25.76, longitude: -80.19 },
    Message: { PositionReport: { UserID: 368207620, Latitude: 25.7617, Longitude: -80.1918, Sog: 12.4, Cog: 86.7, TrueHeading: 87, NavigationalStatus: 0, Valid: true } } }, NOW);
  assertEquals(r?.pos, { mmsi: 368207620, lat: 25.7617, lon: -80.1918, sog: 12.4, cog: 86.7, heading: 87, nav_status: 0, name: "EXAMPLE VESSEL", source: "aisstream", ts: NOW });
});

Deno.test("parseAisstream drops invalid / not-available values", () => {
  const base = (b: Record<string, unknown>) => ({ MessageType: "PositionReport", MetaData: {}, Message: { PositionReport: { UserID: 368207620, Valid: true, ...b } } });
  assertEquals(parseAisstream(base({ Latitude: 91, Longitude: 181 }), NOW), null);
  assertEquals(parseAisstream(base({ Latitude: 0, Longitude: 0 }), NOW), null);
  assertEquals(parseAisstream(base({ Latitude: 1, Longitude: 1, Valid: false }), NOW), null);
  assertEquals(parseAisstream({ ...base({ Latitude: 1, Longitude: 1 }), Message: { PositionReport: { UserID: 12, Latitude: 1, Longitude: 1 } } }, NOW), null);
  const r = parseAisstream(base({ Latitude: 1, Longitude: 1, Sog: 102.3, Cog: 360, TrueHeading: 511 }), NOW)!.pos!;
  assertEquals([r.sog, r.cog, r.heading], [null, null, null]);
  assertEquals(parseAisstream({ MessageType: "SubscriptionConfirmation", Message: { CompressionEnabled: true } }, NOW), null);
});

Deno.test("parseAisstream static data", () => {
  const r = parseAisstream({ MessageType: "ShipStaticData", MetaData: { MMSI: 230000001 },
    Message: { ShipStaticData: { UserID: 230000001, Name: "TELLUS  ", CallSign: "SBGJ", Type: 80, Destination: "RIGA@@", Dimension: { A: 100, B: 24, C: 15, D: 3 } } } }, NOW);
  assertEquals(r?.stat, { mmsi: 230000001, name: "TELLUS", callsign: "SBGJ", ship_type: 80, length_m: 124, destination: "RIGA" });
});

Deno.test("digitraffic parsers", () => {
  const now = Date.parse(NOW);
  const fc = { features: [
    { mmsi: 414045000, geometry: { coordinates: [28.4, 59.78] }, properties: { mmsi: 414045000, sog: 0.2, cog: 139.1, navStat: 1, heading: 62, timestampExternal: now - 60_000 } },
    { mmsi: 219032007, geometry: { coordinates: [12, 55] }, properties: { mmsi: 219032007, timestampExternal: now - 3600_000 } },
    { mmsi: 1, geometry: { coordinates: [12, 55] }, properties: { mmsi: 1, timestampExternal: now } },
  ] };
  const rows = parseDigitrafficLocations(fc, now);
  assertEquals(rows.length, 1);
  assertEquals(rows[0].heading, 62);
  assertEquals(rows[0].source, "digitraffic");
  const v = parseDigitrafficVessels([{ mmsi: 266471000, name: "TELLUS", callSign: "SBGJ", shipType: 80, referencePointA: 100, referencePointB: 24, destination: "RIGA" }, { mmsi: 5 }]);
  assertEquals(v, [{ mmsi: 266471000, name: "TELLUS", callsign: "SBGJ", ship_type: 80, length_m: 124, destination: "RIGA" }]);
});

Deno.test("ShipBuffer keeps latest fix and merges static", () => {
  const b = new ShipBuffer();
  b.addPos({ mmsi: 230000001, lat: 1, lon: 1, name: "A", source: "aisstream" });
  b.addPos({ mmsi: 230000001, lat: 2, lon: 2, source: "aisstream" });
  b.addStat({ mmsi: 230000001, ship_type: 70 });
  b.addStat({ mmsi: 366000000, name: "ONLY STATIC" });
  const rows = b.rows();
  assertEquals(rows.length, 1);
  assertEquals([rows[0].lat, rows[0].name, rows[0].ship_type], [2, "A", 70]);
  assertEquals(b.staticOnly().map((s) => s.mmsi), [366000000]);
});

Deno.test("subscription shape and frame decode", () => {
  const s = subscription("k");
  assertEquals(s.BoundingBoxes, [[[-90, -180], [90, 180]]]);
  assert(s.FilterMessageTypes.includes("ShipStaticData"));
  assertEquals(decodeFrame(new TextEncoder().encode("{}").buffer), "{}");
  assert(validPos(10, 20) && !validPos(0, 0));
});
