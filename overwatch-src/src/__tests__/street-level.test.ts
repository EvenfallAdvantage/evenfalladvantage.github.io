import { describe, it, expect } from "vitest";
import { clampBBox, parsePanoramax, parseKartaview, parseMapillary, dedupeAndCap, mapillaryUrl, streetBudget } from "@/lib/map/street-level";

describe("street-level providers", () => {
  it("clamps the query box around the centre", () => {
    const b = clampBBox([-1, -1, 1, 1], 0.02);
    expect(b[2] - b[0]).toBeCloseTo(0.02); expect((b[0] + b[2]) / 2).toBeCloseTo(0);
  });
  it("parses Panoramax STAC items", () => {
    const p = parsePanoramax({ features: [{ id: "abc", geometry: { coordinates: [2.3, 48.8] }, assets: { thumb: { href: "https://x/t.jpg" }, sd: { href: "https://x/s.jpg" } }, properties: { datetime: "2025-01-01T00:00:00Z", license: "CC-BY-SA-4.0", "view:azimuth": 90 }, providers: [{ name: "alice" }] }, { id: "bad", geometry: { coordinates: [1, 1] }, assets: { thumb: { href: "http://insecure" } } }] });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ provider: "panoramax", lat: 48.8, lng: 2.3, heading: 90, author: "alice", imageUrl: "https://x/s.jpg" });
  });
  it("uses only KartaView photos reported as blurred, and the processed image", () => {
    const base = { id: "1", lat: "40", lng: "-73", heading: "10", shotDate: "2018-08-20 13:20:51.000", sequenceId: "9", sequenceIndex: 3, fileurlProc: "https://storage9.openstreetcam.org/files/photo/x/proc/a.jpg" };
    const p = parseKartaview({ result: { data: [
      { ...base, autoImgProcessingStatus: "FINISHED", autoImgProcessingResult: "BLURRED" },
      { ...base, id: "2", autoImgProcessingStatus: "NEW", autoImgProcessingResult: null },
      { ...base, id: "3", autoImgProcessingStatus: "FINISHED", autoImgProcessingResult: "BLURRED", fileurlProc: "https://evil.example/a.jpg" },
    ] } });
    expect(p.map((x) => x.id)).toEqual(["1"]);
    expect(p[0].imageUrl).toContain("/proc/");
    expect(p[0].pageUrl).toBe("https://kartaview.org/details/9/3");
  });
  it("parses Mapillary Graph API images", () => {
    const p = parseMapillary({ data: [{ id: "77", geometry: { coordinates: [-73, 40] }, captured_at: 1700000000000, compass_angle: 45, thumb_1024_url: "https://scontent/x.jpg", creator: { username: "bob" } }] });
    expect(p[0]).toMatchObject({ provider: "mapillary", author: "bob", heading: 45, license: "CC BY-SA 4.0" });
    expect(mapillaryUrl([0, 0, 0.01, 0.01], 50, "TOKEN")).toContain("access_token=TOKEN");
  });
  it("dedupes and keeps the nearest within budget", () => {
    const mk = (id: string, lat: number) => ({ provider: "panoramax" as const, id, lat, lng: 0, heading: 0, takenAt: null, thumbUrl: "", imageUrl: "", pageUrl: "", author: null, license: "" });
    const out = dedupeAndCap([mk("a", 0.001), mk("b", 0.001), mk("c", 0.0005), mk("d", 0.01)], 2, 0, 0);
    expect(out.map((x) => x.id)).toEqual(["c", "a"]);
    expect(streetBudget(true)).toBeLessThan(streetBudget(false));
  });
});
