import { describe, expect, it } from "vitest";
import { parseCoordinateQuery } from "@/lib/map/coordinate-parser";

describe("parseCoordinateQuery (ported from gods-eye-view)", () => {
  it("parses decimal pairs in lat, lng order", () => {
    expect(parseCoordinateQuery("40.7128, -74.0060")).toMatchObject({ lat: 40.7128, lon: -74.006 });
    expect(parseCoordinateQuery("40.7128 -74.0060")).toMatchObject({ lat: 40.7128, lon: -74.006 });
  });
  it("honours hemisphere letters in either order", () => {
    expect(parseCoordinateQuery("74.006 W, 40.7128 N")).toMatchObject({ lat: 40.7128, lon: -74.006 });
    expect(parseCoordinateQuery("S 33.86, E 151.21")).toMatchObject({ lat: -33.86, lon: 151.21 });
  });
  it("parses geo: URIs and DMS", () => {
    expect(parseCoordinateQuery("geo:37.786971,-122.399677")).toMatchObject({ lat: 37.786971, lon: -122.399677 });
    const d = parseCoordinateQuery(`40°44'54.3"N 73°59'08.4"W`)!;
    expect(d.lat).toBeCloseTo(40.74842, 4);
    expect(d.lon).toBeCloseTo(-73.98567, 4);
    expect(parseCoordinateQuery("51°30'N, 0°07'W")!.lat).toBeCloseTo(51.5, 5);
  });
  it("declines anything ambiguous or out of range", () => {
    for (const q of ["12junk, 34oops", "-40N, 74W", "40 N, 50 N", "91, 10", "10, 181", "Times Square", "geo:1,2,3", "40°75'N 73°W", ""]) {
      expect(parseCoordinateQuery(q), q).toBeNull();
    }
  });
  it("labels results", () => {
    expect(parseCoordinateQuery("40.7128, -74.006")!.label).toBe("40.7128° N, 74.0060° W");
  });
});
