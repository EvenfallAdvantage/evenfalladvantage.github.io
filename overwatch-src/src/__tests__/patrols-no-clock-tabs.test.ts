import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("/patrols", () => {
  it("no longer renders the leftover Clock / Mass Clock tab row", () => {
    const src = readFileSync(join(__dirname, "../app/patrols/page.tsx"), "utf8");
    expect(src).not.toContain('href="/timeclock"');
    expect(src).not.toContain("Mass Clock");
  });
});
