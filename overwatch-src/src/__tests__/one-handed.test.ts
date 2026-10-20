import { describe, it, expect } from "vitest";
import { staticProbeUrl } from "@/lib/health-probe";
import fs from "node:fs";
import path from "node:path";

describe("health probe", () => {
  it("targets a file that exists in public/ (exported as-is), cache-busted", () => {
    const u = staticProbeUrl(123);
    expect(u).toBe("/overwatch/manifest.json?probe=123");
    expect(fs.existsSync(path.join(__dirname, "../../public/manifest.json"))).toBe(true);
  });
  it("no longer probes the webpack chunk Turbopack doesn't emit", () => {
    const src = fs.readFileSync(path.join(__dirname, "../app/admin/health/page.tsx"), "utf8");
    expect(src).not.toContain("chunks/webpack.js");
  });
});
