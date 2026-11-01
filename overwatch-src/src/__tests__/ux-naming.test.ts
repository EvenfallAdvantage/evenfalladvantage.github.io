import { describe, it, expect } from "vitest";
import { NAV_SECTIONS, MOBILE_NAV_ITEMS, OFFICER_MOBILE_NAV_ITEMS } from "@/components/layout/nav-items";
import { actionRequiredHref } from "@/app/feed/components/action-required";

type Item = { title: string; href: string; roles?: string[]; children?: Item[] };
const flat = (items: Item[]): Item[] => items.flatMap((i) => [i, ...flat(i.children ?? [])]);
const all = flat(NAV_SECTIONS.flatMap((s) => s.items as Item[]));

describe("one name per screen", () => {
  it("uses canonical labels in the sidebar and mobile bars", () => {
    const titles = [...all, ...(MOBILE_NAV_ITEMS as Item[]), ...(OFFICER_MOBILE_NAV_ITEMS as Item[])];
    for (const i of titles) {
      if (i.href === "/timeclock") expect(i.title).toBe("Clock");
      if (i.href === "/incidents") expect(i.title).toBe("Incidents");
      if (i.href === "/patrols") expect(i.title).toBe("Patrols");
      if (i.href === "/admin/staff?tab=forms") expect(i.title).toBe("Forms");
    }
    expect(titles.some((i) => /Watch|^Reports?$/.test(i.title))).toBe(false);
  });

  it("adds HQ Config and Analytics with roles", () => {
    expect(all.find((i) => i.href === "/admin/settings")).toMatchObject({ title: "HQ Config", roles: ["owner", "admin"] });
    expect(all.find((i) => i.href === "/admin/analytics")).toMatchObject({ title: "Analytics", roles: ["owner", "admin", "manager"] });
  });
});

describe("actionRequiredHref", () => {
  const z = { timesheets: 0, timeCorrections: 0, leaveRequests: 0, formReviews: 0 };
  it("deep-links to the first non-empty approvals queue", () => {
    expect(actionRequiredHref({ ...z, timesheets: 1, leaveRequests: 2 })).toBe("/admin/staff?tab=approvals&view=timesheets");
    expect(actionRequiredHref({ ...z, timeCorrections: 1 })).toBe("/admin/staff?tab=approvals&view=corrections");
    expect(actionRequiredHref({ ...z, leaveRequests: 1 })).toBe("/admin/staff?tab=approvals&view=leave");
    expect(actionRequiredHref({ ...z, formReviews: 3 })).toBe("/admin/staff?tab=forms");
  });
});
