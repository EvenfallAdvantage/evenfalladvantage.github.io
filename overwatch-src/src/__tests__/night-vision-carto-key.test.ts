import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guards the #75 regression: CARTO dark_all tiles without ?key= are an
// "API KEY REQUIRED" watermark.
describe("night mode CARTO tiles", () => {
  it("keeps the key query param on the dark_all URL", () => {
    const src = readFileSync(path.resolve(__dirname, "../components/tactical-map/hooks/use-night-vision.ts"), "utf8");
    const m = src.match(/https:\/\/basemaps\.cartocdn\.com\/dark_all\/[^"`]+/);
    expect(m?.[0]).toMatch(/\?key=cb1_[A-Za-z0-9_]+$/);
  });
});
