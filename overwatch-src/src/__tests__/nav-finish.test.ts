import { describe, it, expect } from "vitest";
import { NAV_SECTIONS, MOBILE_NAV_ITEMS, OFFICER_MOBILE_NAV_ITEMS } from "@/components/layout/nav-items";
import { resolveOpsTab, opsRedirect } from "@/app/schedule/components/ops-tabs";
import { resolveStaffTab, APPROVAL_VIEWS } from "@/lib/personnel/staff-tabs";

const items = NAV_SECTIONS.flatMap((s) => s.items);

describe("phone bar consistency", () => {
  it("shares slots 1, 3, 4, 5 across roles", () => {
    for (const i of [0, 2, 3, 4]) {
      expect(MOBILE_NAV_ITEMS[i].href).toBe(OFFICER_MOBILE_NAV_ITEMS[i].href);
      expect(MOBILE_NAV_ITEMS[i].title).toBe(OFFICER_MOBILE_NAV_ITEMS[i].title);
    }
    expect(MOBILE_NAV_ITEMS[1].href).toBe("/feed");
    expect(OFFICER_MOBILE_NAV_ITEMS[1].href).toBe("/patrols");
  });
});

describe("Armory under Tools", () => {
  it("lists Armory in Tools and redirects the old Ops tab", () => {
    const tools = items.find((i) => i.title === "Tools");
    expect(tools?.children?.some((c) => c.href === "/armory")).toBe(true);
    expect(opsRedirect("armory")).toBe("/armory");
    expect(resolveOpsTab("armory", true)).toBe("map");
  });
});

describe("Invoices in Command", () => {
  it("is a manager+ Command item, not a Tool", () => {
    const tools = items.find((i) => i.title === "Tools");
    expect(tools?.children?.some((c) => c.href === "/invoices")).toBe(false);
    const cmd = NAV_SECTIONS.find((s) => s.label === "Command")!;
    const inv = cmd.items.find((i) => i.href === "/invoices");
    expect(inv?.roles).toEqual(["owner", "admin", "manager"]);
  });
});

describe("Swaps in Approvals", () => {
  it("adds a swaps approvals view", () => {
    expect(APPROVAL_VIEWS).toContain("swaps");
    expect(resolveStaffTab("approvals", "swaps")).toMatchObject({ tab: "approvals", view: "swaps" });
  });
});

import { TOGGLEABLE_TABS, TOGGLEABLE_SECTIONS } from "@/lib/feature-flags";

describe("HQ Config feature visibility", () => {
  const navHrefs = new Set(items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]));
  it("every sidebar toggle points at a real nav entry", () => {
    for (const t of TOGGLEABLE_TABS.filter((t) => !t.href.startsWith("/schedule?"))) {
      expect(navHrefs.has(t.href), t.href).toBe(true);
    }
  });
  it("reflects the declutter moves", () => {
    const sec = (h: string) => TOGGLEABLE_TABS.find((t) => t.href === h)?.section;
    expect(sec("/armory")).toBe("Tools");
    expect(sec("/invoices")).toBe("Command");
    expect(sec("/schedule?tab=geofences")).toBe("Field Ops");
    expect(sec("/admin/staff?tab=forms")).toBe("Personnel");
    expect(TOGGLEABLE_TABS.some((t) => t.href.includes("public-reports"))).toBe(false);
    expect(TOGGLEABLE_SECTIONS).toEqual(["Field Ops", "Academy", "Tools", "Readiness", "Personnel", "Command"]);
  });
});
