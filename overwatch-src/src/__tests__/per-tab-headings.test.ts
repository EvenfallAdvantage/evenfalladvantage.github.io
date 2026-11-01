import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "../app", p), "utf8");

describe("per-tab page headings", () => {
  it.each([
    ["timeclock/page.tsx", ["\"MASS CLOCK\""]],
    ["schedule/page.tsx", ["\"TACTICAL MAP\"", "\"SHIFT SWAPS\"", "\"GEOFENCES\""]],
    ["patrols/page.tsx", ["\"CHECKPOINTS\"", "\"PATROL ROUTES\"", "\"PATROL ACTIVITY\""]],
    ["courses/page.tsx", ["\"LIVE SESSIONS\""]],
    ["admin/training/page.tsx", ["\"QUESTION BANK\"", "\"STAFF PROGRESS\""]],
    ["admin/staff/page.tsx", ["\"ROSTER\"", "\"APPROVALS\"", "\"ONBOARDING\""]],
    ["forms/page.tsx", ["\"FIELD REPORTS\""]],
  ])("%s gives each tab its own heading", (file, titles) => {
    const src = read(file as string);
    for (const t of titles as string[]) expect(src).toContain(t);
  });
});
