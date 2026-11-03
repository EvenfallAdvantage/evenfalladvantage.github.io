import { describe, it, expect } from "vitest";
import { certBucket, groupCertsByPerson, bucketCounts } from "@/lib/dashboard/compliance";
import { visibleQuickActionKeys, toolVisible, dashboardColumns, dashboardSections } from "@/lib/dashboard/layout";
import { workweekStart, sumWorkedHours, countdownLabel } from "@/lib/dashboard/week";
import { approvalBadges } from "@/app/feed/components/action-required";

const cert = (userId: string, days: number, certType = "Guard Card") => ({
  certId: `${userId}-${certType}-${days}`, userId, userName: userId.toUpperCase(), certType, expiryDate: "2026-12-01", daysUntilExpiry: days,
});

describe("compliance grouping", () => {
  it("buckets by days", () => {
    expect([-3, 0, 12, 30, 31, 60, 61, 90].map(certBucket)).toEqual(["expired", "expired", "d30", "d30", "d60", "d60", "d90", "d90"]);
  });
  it("groups one row per person, most urgent first", () => {
    const g = groupCertsByPerson([cert("a", 50), cert("b", -2), cert("a", 10, "CPR"), cert("c", 80)]);
    expect(g.map((p) => p.userId)).toEqual(["b", "a", "c"]);
    expect(g[1].certs.map((c) => c.daysUntilExpiry)).toEqual([10, 50]);
    expect(g[0].expired).toBe(1);
  });
  it("counts buckets", () => {
    expect(bucketCounts([cert("a", -1), cert("a", 5), cert("b", 45), cert("c", 75)])).toEqual({ expired: 1, d30: 1, d60: 1, d90: 1 });
  });
});

describe("feature visibility", () => {
  it("hides quick actions whose page is hidden", () => {
    expect(visibleQuickActionKeys("leadership")).toContain("approvals");
    expect(visibleQuickActionKeys("leadership", ["/admin/staff?tab=approvals"])).not.toContain("approvals");
    expect(visibleQuickActionKeys("officer", ["/patrols"])).not.toContain("patrols");
  });
  it("hides manager-only tools from officers and hidden tools from everyone", () => {
    expect(toolVisible("/invoices", "staff")).toBe(false);
    expect(toolVisible("/invoices", "manager")).toBe(true);
    expect(toolVisible("/invoices", "owner", ["/invoices"])).toBe(false);
  });
  it("approval badges link each queue and skip hidden tabs", () => {
    const a = { timesheets: 2, timeCorrections: 0, leaveRequests: 1, formReviews: 4 };
    const all = approvalBadges(a);
    expect(all.map((b) => b.key)).toEqual(["timesheets", "corrections", "leave", "forms"]);
    const some = approvalBadges(a, ["/admin/staff?tab=forms"]);
    expect(some.length).toBe(all.length - 1);
    expect(approvalBadges(a, ["/admin/staff?tab=approvals"]).every((b) => !b.href.includes("approvals"))).toBe(true);
  });
});

describe("layout", () => {
  it("columns contain exactly the single-column sections", () => {
    for (const v of ["officer", "leadership"] as const) {
      const c = dashboardColumns(v);
      expect(c.rows.flat().sort()).toEqual([...dashboardSections(v)].sort());
    }
  });
});

describe("pinned briefing", () => {
  it("is the first, full-width section in both role layouts at every breakpoint", () => {
    for (const v of ["officer", "leadership"] as const) {
      expect(dashboardSections(v)[0]).toBe("pinned-briefing");
      expect(dashboardColumns(v).rows[0]).toEqual(["pinned-briefing"]);
    }
  });
});

describe("my week", () => {
  it("finds the workweek start", () => {
    const wed = new Date(2026, 10, 4, 15); // Wed Nov 4 2026
    expect(workweekStart(wed, 0).getDate()).toBe(1);
    expect(workweekStart(wed, 1).getDate()).toBe(2);
    expect(workweekStart(wed, 3).getDate()).toBe(4);
  });
  it("sums closed timesheets minus breaks", () => {
    expect(sumWorkedHours([
      { clock_in: "2026-11-02T08:00:00Z", clock_out: "2026-11-02T16:30:00Z", break_minutes: 30 },
      { clock_in: "2026-11-03T08:00:00Z", clock_out: null },
    ])).toBe(8);
  });
  it("labels countdowns", () => {
    const n = 1_000_000_000_000;
    expect(countdownLabel(n - 1, n)).toBe("Starting now");
    expect(countdownLabel(n + 45 * 60e3, n)).toBe("In 45m");
    expect(countdownLabel(n + 5 * 3600e3, n)).toBe("In 5h");
    expect(countdownLabel(n + 3 * 864e5, n)).toBe("In 3d");
  });
});
