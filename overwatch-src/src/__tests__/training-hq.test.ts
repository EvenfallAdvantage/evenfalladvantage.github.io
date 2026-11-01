import { describe, it, expect } from "vitest";
import { visibleTrainingTabs, resolveTrainingTab, trainingHqHref } from "@/lib/training/hq-tabs";
import { NAV_SECTIONS } from "@/components/layout/nav-items";

describe("Training HQ tabs", () => {
  it("managers get training admin tabs only", () => {
    expect(visibleTrainingTabs("manager", true)).toEqual(["modules", "questions", "progress"]);
  });
  it("admins of a training provider get both groups", () => {
    expect(visibleTrainingTabs("admin", true)).toEqual(["modules", "questions", "progress", "courses", "classes", "students", "assessments"]);
    expect(visibleTrainingTabs("admin", false)).toEqual(["modules", "questions", "progress"]);
  });
  it("instructors at a provider get instructor tabs", () => {
    expect(visibleTrainingTabs("instructor", true)).toContain("courses");
    expect(visibleTrainingTabs("staff", true)).toEqual([]);
  });
  it("resolves ?tab and falls back", () => {
    const v = visibleTrainingTabs("admin", true);
    expect(resolveTrainingTab("classes", v)).toBe("classes");
    expect(resolveTrainingTab("bogus", v)).toBe("modules");
    expect(resolveTrainingTab("courses", visibleTrainingTabs("manager", false))).toBe("modules");
    expect(resolveTrainingTab(null, [])).toBeNull();
    expect(trainingHqHref("courses")).toBe("/admin/training?tab=courses");
  });
});

describe("nav", () => {
  const items = NAV_SECTIONS.flatMap((s) => s.items);
  it("has a single Training HQ entry", () => {
    expect(items.filter((i) => i.href === "/admin/training")).toHaveLength(1);
    expect(items.some((i) => i.href === "/admin/instructor")).toBe(false);
    expect(items.find((i) => i.href === "/admin/training")?.title).toBe("Training HQ");
  });
  it("orders Academy learn → practice → prove → reference", () => {
    const academy = items.find((i) => i.href === "/academy")!;
    expect(academy.children!.map((c) => c.href)).toEqual(["/academy", "/courses", "/training/scenarios", "/certifications", "/knowledge-base", "/state-laws"]);
  });
});
