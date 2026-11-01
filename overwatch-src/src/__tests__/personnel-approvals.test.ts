import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveStaffTab, approvalsHref, STAFF_TABS } from "@/lib/personnel/staff-tabs";
import { NAV_SECTIONS } from "@/components/layout/nav-items";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("Personnel approvals tab routing", () => {
  it.each(["timesheets", "corrections", "leave"])("redirects legacy ?tab=%s to Approvals", (t) => {
    expect(resolveStaffTab(t)).toEqual({ tab: "approvals", view: t });
  });
  it("honours ?tab=approvals&view=", () => {
    expect(resolveStaffTab("approvals", "leave")).toEqual({ tab: "approvals", view: "leave" });
    expect(resolveStaffTab("approvals", "bogus")).toEqual({ tab: "approvals", view: "timesheets" });
    expect(resolveStaffTab("approvals")).toEqual({ tab: "approvals", view: "timesheets" });
  });
  it("keeps other tabs and defaults unknown to roster", () => {
    expect(resolveStaffTab("applicants").tab).toBe("applicants");
    expect(resolveStaffTab(null).tab).toBe("roster");
    expect(resolveStaffTab("nope").tab).toBe("roster");
    expect(STAFF_TABS).not.toContain("timesheets");
  });
  it("builds canonical links", () => {
    expect(approvalsHref("corrections")).toBe("/admin/staff?tab=approvals&view=corrections");
  });
  it("sidebar shows one Approvals entry instead of three", () => {
    const personnel = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.title === "Personnel");
    const hrefs = (personnel?.children ?? []).map((c) => c.href);
    expect(hrefs).toContain("/admin/staff?tab=approvals");
    expect(hrefs.some((h) => /tab=(timesheets|corrections|leave)\b/.test(h))).toBe(false);
  });
  it("Leave page no longer approves team requests; links to Approvals", () => {
    const page = src("app/time-off/page.tsx");
    expect(page).not.toMatch(/reviewTimeOffRequest|removeConflictingShifts|"team"/);
    expect(page).toContain('approvalsHref("leave")');
    // Personnel leave tab still owns review + shift-conflict cleanup.
    const leaveTab = src("app/admin/staff/components/leave-tab.tsx");
    expect(leaveTab).toMatch(/reviewTimeOffRequest/);
    expect(leaveTab).toMatch(/removeConflictingShifts/);
  });
});
