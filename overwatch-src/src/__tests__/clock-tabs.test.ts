import { describe, it, expect } from "vitest";
import { resolveClockTab } from "@/lib/timeclock/clock-tabs";
import { NAV_SECTIONS, OFFICER_MOBILE_NAV_ITEMS } from "@/components/layout/nav-items";

describe("resolveClockTab", () => {
  it("defaults to clock", () => {
    expect(resolveClockTab(null, false)).toEqual({ tab: "clock" });
    expect(resolveClockTab("bogus", true)).toEqual({ tab: "clock" });
  });
  it("mass clock only for managers", () => {
    expect(resolveClockTab("mass-clock", true)).toEqual({ tab: "mass-clock" });
    expect(resolveClockTab("mass-clock", false)).toEqual({ tab: "clock" });
  });
  it("redirects old tasks/patrols tabs", () => {
    expect(resolveClockTab("tasks", false).redirect).toBe("/tasks");
    expect(resolveClockTab("patrols", true).redirect).toBe("/patrols");
  });
});

describe("Field Ops sidebar", () => {
  const field = NAV_SECTIONS.find((s) => s.label === "Field Ops")!;
  it("lists Patrols and Tasks as their own screens", () => {
    const hrefs = field.items.map((i) => i.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/timeclock", "/patrols", "/tasks"]));
  });
  it("keeps Patrols on the officer phone bar", () => {
    expect(OFFICER_MOBILE_NAV_ITEMS.some((i) => i.href === "/patrols")).toBe(true);
  });
});
