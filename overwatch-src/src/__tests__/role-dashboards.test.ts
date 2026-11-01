import { describe, it, expect } from "vitest";
import { dashboardVariant, dashboardSections, quickActionKeys, QUICK_ACTION_HREFS } from "@/lib/dashboard/layout";

describe("role-based dashboards", () => {
  it("picks variant by role", () => {
    expect(dashboardVariant("staff")).toBe("officer");
    expect(dashboardVariant(undefined)).toBe("officer");
    expect(dashboardVariant("manager")).toBe("leadership");
    expect(dashboardVariant("admin")).toBe("leadership");
    expect(dashboardVariant("owner")).toBe("leadership");
  });
  it("officer home is shift-focused, no leadership widgets", () => {
    const s = dashboardSections("officer");
    expect(s.slice(0, 4)).toEqual(["onboarding", "pinned-briefing", "my-post", "duty-status"]);
    for (const x of ["action-required", "kpis", "compliance-overtime", "intel"] as const) expect(s).not.toContain(x);
  });
  it("leadership home leads with approvals and KPIs", () => {
    const s = dashboardSections("leadership");
    expect(s.slice(0, 3)).toEqual(["onboarding", "action-required", "kpis"]);
    expect(s).not.toContain("my-post");
  });
  it("quick actions differ by role and have hrefs", () => {
    expect(quickActionKeys("officer")).toContain("clock");
    expect(quickActionKeys("officer")).not.toContain("approvals");
    expect(quickActionKeys("leadership")).toContain("approvals");
    for (const v of ["officer", "leadership"] as const) {
      const k = quickActionKeys(v);
      expect(k).toHaveLength(6);
      for (const key of k) expect(QUICK_ACTION_HREFS[key]).toMatch(/^\//);
    }
    expect(QUICK_ACTION_HREFS.approvals).toBe("/admin/staff?tab=approvals&view=timesheets");
  });
});
