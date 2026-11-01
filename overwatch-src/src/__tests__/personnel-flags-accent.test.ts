import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hiddenStaffTabs, staffTabFlag, STAFF_TABS } from "@/lib/personnel/staff-tabs";
import { TOGGLEABLE_TABS } from "@/lib/feature-flags";

describe("Personnel feature visibility", () => {
  it("maps hiddenTabs keys to Personnel tabs, never Roster", () => {
    const hidden = hiddenStaffTabs(["/admin/staff?tab=forms", "/admin/staff?tab=roster", "/invoices"]);
    expect([...hidden]).toEqual(["forms"]);
  });
  it("offers a toggle for every Personnel tab except Roster", () => {
    for (const t of STAFF_TABS.filter((t) => t !== "roster")) {
      expect(TOGGLEABLE_TABS.some((x) => x.href === staffTabFlag(t)), t).toBe(true);
    }
  });
});

describe("accent wiring", () => {
  const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
  it("exposes the HQ accent as a Tailwind colour", () => {
    expect(css).toContain("--color-brand: var(--brand-accent");
  });
  it("dark text-primary follows the accent, not a fixed orange", () => {
    expect(css).not.toContain(".dark .text-primary, .dark.text-primary { color: oklch(0.82 0.12 75); }");
  });
});
