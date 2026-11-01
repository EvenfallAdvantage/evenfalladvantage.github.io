import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("dashboard section spacing", () => {
  it("uses flex gap (space-y margins are ignored on display:contents wrappers)", () => {
    const src = readFileSync(join(__dirname, "../app/feed/page.tsx"), "utf8");
    expect(src).toContain('className="contents"');
    expect(src).toContain('className="flex flex-col gap-6" data-dashboard');
    expect(src).not.toContain('className="space-y-6" data-dashboard');
  });
});
