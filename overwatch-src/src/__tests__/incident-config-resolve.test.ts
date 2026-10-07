import { describe, it, expect } from "vitest";
import {
  effectiveIncidentTypes, effectiveIncidentStatuses, fieldsForType, parseChoices, choicesToText,
  missingRequiredFields, pickFieldValues, reorderUpdates, statusDefsOrDefaults, slugKey, DEFAULT_TYPE_OPTIONS,
} from "@/lib/incident-config-resolve";
import type { IncidentType, IncidentField } from "@/lib/supabase/db-incident-config";

const t = (key: string, sortOrder: number, isActive = true) => ({ id: key, companyId: "c", key, label: key.toUpperCase(), color: "#000", sortOrder, isActive, createdAt: "", updatedAt: "" }) as unknown as IncidentType;
const f = (fieldKey: string, incidentTypeKey: string | null, extra: Partial<IncidentField> = {}) =>
  ({ id: fieldKey, companyId: "c", fieldKey, label: fieldKey, fieldType: "text", required: false, options: {}, sortOrder: 0, incidentTypeKey, ...extra }) as unknown as IncidentField;

describe("incident config resolver", () => {
  it("falls back to built-in types and keeps current value", () => {
    expect(effectiveIncidentTypes([])).toEqual(DEFAULT_TYPE_OPTIONS);
    const r = effectiveIncidentTypes([t("b", 2), t("a", 1), t("off", 0, false)], "legacy");
    expect(r.map((x) => x.key)).toEqual(["a", "b", "legacy"]);
  });
  it("statuses fall back to defaults", () => {
    expect(effectiveIncidentStatuses([]).map((s) => s.key)).toContain("open");
    const d = statusDefsOrDefaults([], "c");
    expect(d.length).toBeGreaterThan(0);
    expect(d.every((s) => s.id.startsWith("default-"))).toBe(true);
  });
  it("filters fields by type", () => {
    const r = fieldsForType([f("all", null), f("theft_only", "theft"), f("other", "trespass")], "theft");
    expect(r.map((x) => x.fieldKey)).toEqual(["all", "theft_only"]);
  });
  it("parses choices", () => {
    const c = parseChoices("Yes\nNo, Maybe\nyes\n\n");
    expect(c.map((x) => x.value)).toEqual(["yes", "no", "maybe"]);
    expect(parseChoices(choicesToText(c)).map((x) => x.value)).toEqual(["yes", "no", "maybe"]);
  });
  it("required and pick", () => {
    const fs = [f("a", null, { required: true }), f("b", null, { required: true, fieldType: "checkbox" } as Partial<IncidentField>)];
    expect(missingRequiredFields(fs, { a: "x", b: false })).toHaveLength(1);
    expect(pickFieldValues([fs[0]], { a: "x", stale: 1 })).toEqual({ a: "x" });
  });
  it("reorders and slugs", () => {
    const items = [{ id: "1", sortOrder: 0 }, { id: "2", sortOrder: 0 }, { id: "3", sortOrder: 0 }];
    expect(reorderUpdates(items, 2, -1)).toEqual([{ id: "3", sortOrder: 1 }, { id: "2", sortOrder: 2 }]);
    expect(reorderUpdates(items, 0, -1)).toEqual([]);
    expect(slugKey("Noise Complaint!")).toBe("noise_complaint");
  });
});
