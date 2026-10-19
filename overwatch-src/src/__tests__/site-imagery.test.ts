import { describe, expect, it } from "vitest";
import {
  cloudLabel, cmrUrl, hlsTileUrl, imageryDays, parseCmr, pickDefaultDay, siteBox,
} from "@/lib/map/site-imagery";
import { infraLimits, INFRA_MAX_CELLS } from "@/lib/map/infra-extract";

const granule = (start: string, cloud?: string | number) => ({
  umm: {
    TemporalExtent: { RangeDateTime: { BeginningDateTime: start } },
    AdditionalAttributes: cloud === undefined ? [] : [{ Name: "CLOUD_COVERAGE", Values: [String(cloud)] }],
  },
});

describe("site imagery", () => {
  it("builds a ~12 km box and refuses polar or junk sites", () => {
    const b = siteBox(39.04, -77.45)!;
    expect(b.north - b.south).toBeCloseTo(12 / 111.32, 3);
    expect(b.east - b.west).toBeGreaterThan(b.north - b.south); // wider in degrees away from the equator
    expect(siteBox(88, 0)).toBeNull();
    expect(siteBox(Number.NaN, 0)).toBeNull();
    expect(siteBox(10, 181)).toBeNull();
  });

  it("queries CMR for the right collection, box and window", () => {
    const url = cmrUrl("L30", { west: -77.5, south: 39, east: -77.4, north: 39.1 }, new Date("2026-10-18T12:34:56.789Z"), 90);
    expect(url).toContain("collection_concept_id=C2021957657-LPCLOUD");
    expect(url).toContain("bounding_box=-77.5,39,-77.4,39.1");
    expect(url).toContain("temporal=2026-07-20T00:00:00Z,2026-10-18T12:34:56Z");
    expect(url.startsWith("https://cmr.earthdata.nasa.gov/")).toBe(true);
  });

  it("parses granules defensively", () => {
    const out = parseCmr({ items: [granule("2026-10-09T16:12:26.357Z", "84"), granule("bad"), granule("2026-10-08T16:02:40Z"), null, granule("2026-10-07T00:00:00Z", 140)] }, "S30");
    expect(out).toEqual([
      { product: "S30", day: "2026-10-09", cloud: 84 },
      { product: "S30", day: "2026-10-08", cloud: null },
      { product: "S30", day: "2026-10-07", cloud: 100 },
    ]);
    expect(parseCmr(null, "S30")).toEqual([]);
    expect(parseCmr({ items: "x" }, "L30")).toEqual([]);
  });

  it("folds granules per day, newest first, and picks the clearest product", () => {
    const days = imageryDays([
      { product: "S30", day: "2026-10-08", cloud: 40 },
      { product: "L30", day: "2026-10-08", cloud: 5 },
      { product: "S30", day: "2026-10-09", cloud: 84 },
      { product: "S30", day: "2026-10-01", cloud: 10 },
      { product: "S30", day: "2026-10-01", cloud: 12 },
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-10-09", "2026-10-08", "2026-10-01"]);
    expect(days[1]).toMatchObject({ product: "L30", products: ["L30", "S30"], cloud: 5 });
    expect(pickDefaultDay(days)?.day).toBe("2026-10-08");
    expect(pickDefaultDay(days, 1)?.day).toBe("2026-10-09");
    expect(pickDefaultDay([])).toBeNull();
  });

  it("builds keyless GIBS tile URLs and rejects bad days", () => {
    expect(hlsTileUrl("S30", "2026-10-09")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/2026-10-09/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png",
    );
    expect(() => hlsTileUrl("S30", "2026-10-09/../../x")).toThrow();
    expect(cloudLabel(null)).toBe("cloud ?");
    expect(cloudLabel(3.6)).toBe("4% cloud");
  });
});

describe("infra limits", () => {
  it("degrades on phones", () => {
    expect(infraLimits(false)).toEqual({ maxCells: INFRA_MAX_CELLS, maxHeightM: 2_500_000, labels: true });
    const phone = infraLimits(true);
    expect(phone.maxCells).toBeLessThan(INFRA_MAX_CELLS);
    expect(phone.labels).toBe(false);
  });
});
