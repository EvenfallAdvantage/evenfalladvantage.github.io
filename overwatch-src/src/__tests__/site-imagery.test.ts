import { describe, expect, it } from "vitest";
import {
  cloudLabel, cmrUrl, hlsTileUrl, imageryDays, parseCmr, pickDefaultDay, siteBox,
} from "@/lib/map/site-imagery";
import { decodeInfraLine, decodeInfraRow, densifyLine, infraContrastStyle, infraLimits, INFRA_MAX_CELLS, keepInfraFeature, lineInView, lineStyle, nearestLines } from "@/lib/map/infra-extract";

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
    expect(infraLimits(false)).toMatchObject({ maxCells: INFRA_MAX_CELLS, maxHeightM: 2_500_000, labels: true, minSubstationKv: 0 });
    const phone = infraLimits(true);
    expect(phone.maxCells).toBeLessThan(INFRA_MAX_CELLS);
    expect(phone.labels).toBe(false);
    expect(phone.powerMaxHeightM).toBeLessThan(infraLimits(false).powerMaxHeightM);
    expect(phone.maxLines).toBeLessThan(infraLimits(false).maxLines);
  });

  it("filters small substations on phones only", () => {
    const small = decodeInfraRow(["s", -97, 30, "Sub A", "138"])!;
    const big = decodeInfraRow(["s", -97, 30, "Sub B", "345"])!;
    const unknown = decodeInfraRow(["s", -97, 30, "Sub C"])!;
    const dc = decodeInfraRow(["d", -97, 30, "DC"])!;
    expect(small.kv).toBe(138);
    expect(keepInfraFeature(small, infraLimits(false))).toBe(true);
    expect(keepInfraFeature(small, infraLimits(true))).toBe(false);
    expect(keepInfraFeature(big, infraLimits(true))).toBe(true);
    expect(keepInfraFeature(unknown, infraLimits(true))).toBe(false);
    expect(keepInfraFeature(dc, infraLimits(true))).toBe(true);
    // Substations hide when zoomed out (lines do too); other kinds are untouched.
    expect(keepInfraFeature(big, infraLimits(false), 2_000_000)).toBe(false);
    expect(keepInfraFeature(big, infraLimits(false), 500_000)).toBe(true);
    expect(keepInfraFeature(dc, infraLimits(false), 2_000_000)).toBe(true);
  });

  it("decodes and styles transmission lines", () => {
    expect(decodeInfraLine([500, [[-97, 30], [-97.1, 30.2]]])).toEqual({ kv: 500, pts: [[-97, 30], [-97.1, 30.2]] });
    expect(decodeInfraLine([345, [[-97, 30]]])).toBeNull();
    expect(decodeInfraLine([345, [[-97, 30], [999, 1], [-96, 31]]])?.pts).toHaveLength(2);
    expect(decodeInfraLine("x")).toBeNull();
    expect(lineStyle(765).width).toBeGreaterThan(lineStyle(345).width);
    const view = { west: -98, south: 32, east: -96, north: 34 };
    expect(lineInView([[-97, 33], [-96.5, 33.5]], view)).toBe(true);
    expect(lineInView([[-90, 33], [-89, 33.5]], view)).toBe(false);
    expect(lineInView([[-100, 33], [-90, 33]], view)).toBe(true); // crosses the view
    expect(lineInView([[-90, 33], [-89, 33]], { west: 170, south: 0, east: -170, north: 10 })).toBe(true);
  });

  it("keeps the lines nearest the focus when over the cap", () => {
    const far = { id: "far", pts: [[-90, 33], [-89, 33]] as Array<[number, number]> };
    const near = { id: "near", pts: [[-97.1, 32.9], [-96.9, 32.7]] as Array<[number, number]> };
    const mid = { id: "mid", pts: [[-95, 33], [-94, 33]] as Array<[number, number]> };
    const focus = { lng: -97, lat: 32.8 };
    expect(nearestLines([far, mid, near], focus, 2).map((l) => l.id)).toEqual(["near", "mid"]);
    expect(nearestLines([far, near], focus, 5)).toHaveLength(2);
  });

  it("densifies long segments so lifted lines follow the ground", () => {
    const short = densifyLine([[-97, 30], [-97.01, 30]]);
    expect(short).toEqual([[-97, 30], [-97.01, 30]]);
    const long = densifyLine([[-97, 30], [-97, 30.3]], 0.03);
    expect(long[0]).toEqual([-97, 30]);
    expect(long.at(-1)).toEqual([-97, 30.3]);
    expect(long.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < long.length; i++) expect(long[i][1] - long[i - 1][1]).toBeLessThanOrEqual(0.0301);
  });

  it("draws dark under NVG/thermal and keeps kind colours otherwise", () => {
    const normal = infraContrastStyle(false);
    expect(normal.pointFill).toBeNull();
    expect(normal.lineColor).toBeNull();
    const nvg = infraContrastStyle(true);
    expect(nvg.pointFill).toBe("#000000");
    expect(nvg.lineColor).toBe("#000000");
    expect(nvg.lineWidthBoost).toBeGreaterThan(0);
    expect(nvg.pointOutline).toBe("#ffffff");
  });
});
