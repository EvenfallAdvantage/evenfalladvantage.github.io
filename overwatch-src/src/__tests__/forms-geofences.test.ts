import { describe, it, expect } from "vitest";
import { resolveStaffTab, formsHref, GEOFENCES_HREF, STAFF_TABS } from "@/lib/personnel/staff-tabs";
import { resolveOpsTab } from "@/app/schedule/components/ops-tabs";
import { NAV_SECTIONS } from "@/components/layout/nav-items";

describe("Personnel Forms absorbs Public Reports", () => {
  it("no separate public-reports or geofences tab", () => {
    expect(STAFF_TABS).not.toContain("public-reports");
    expect(STAFF_TABS).not.toContain("geofences");
  });
  it("legacy ?tab=public-reports opens Forms → Public Reports", () => {
    expect(resolveStaffTab("public-reports")).toMatchObject({ tab: "forms", formsView: "public" });
  });
  it("forms view param", () => {
    expect(resolveStaffTab("forms", "public").formsView).toBe("public");
    expect(resolveStaffTab("forms").formsView).toBe("submissions");
    expect(formsHref("public")).toBe("/admin/staff?tab=forms&view=public");
  });
  it("approvals still resolve", () => {
    expect(resolveStaffTab("leave")).toMatchObject({ tab: "approvals", view: "leave" });
  });
});

describe("Geofences moved to Operations", () => {
  it("legacy Personnel link redirects", () => {
    expect(resolveStaffTab("geofences").redirect).toBe(GEOFENCES_HREF);
    expect(GEOFENCES_HREF).toBe("/schedule?tab=geofences");
  });
  it("Operations tab is manager-only", () => {
    expect(resolveOpsTab("geofences", true)).toBe("geofences");
    expect(resolveOpsTab("geofences", false)).toBe("map");
    expect(resolveOpsTab("swaps", false)).toBe("swaps");
    expect(resolveOpsTab(null, true)).toBe("map");
  });
  it("Personnel sidebar no longer lists them", () => {
    const personnel = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === "/admin/staff")!;
    const hrefs = personnel.children!.map((c) => c.href);
    expect(hrefs.some((h) => /geofences|public-reports/.test(h))).toBe(false);
  });
});
