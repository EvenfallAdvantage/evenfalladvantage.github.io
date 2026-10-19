import { describe, it, expect } from "vitest";
import { aboveBasemapIndex, wantsGlobeLighting, BLACK_MARBLE_URL } from "@/lib/map/city-lights";

describe("city lights", () => {
  it("needs globe lighting for Dark basemap or city lights", () => {
    expect(wantsGlobeLighting({})).toBe(false);
    expect(wantsGlobeLighting({ cityLights: true })).toBe(true);
    expect(wantsGlobeLighting({ nightVision: true })).toBe(true);
  });
  it("inserts just above the basemap", () => {
    expect(aboveBasemapIndex(5, [0])).toBe(1);
    expect(aboveBasemapIndex(5, [0, 1])).toBe(2);
    expect(aboveBasemapIndex(5, [-1])).toBe(1);
    expect(aboveBasemapIndex(0, [])).toBe(0);
  });
  it("uses the public GIBS Black Marble WMTS", () => {
    expect(BLACK_MARBLE_URL).toMatch(/^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/VIIRS_Black_Marble\//);
  });
});
