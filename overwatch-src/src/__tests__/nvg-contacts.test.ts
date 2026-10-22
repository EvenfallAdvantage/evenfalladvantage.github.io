import { describe, expect, it } from "vitest";
import { NVG_CONTACT, contactKind } from "@/lib/map/nvg-contacts";
import { applyNvgContacts } from "@/components/tactical-map/hooks/use-nvg-contacts";

const prop = (v: unknown) => ({ getValue: () => v });
const C = {
  Color: {
    WHITE: "white",
    fromCssColorString: (c: string) => ({ c, withAlpha: (a: number) => ({ c, a }) }),
    equals: (a: { c: string }, b: { c: string }) => a?.c === b?.c,
  },
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ent(id: string, extra: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e: any = { id, ...extra };
  // Mimic Cesium: assigning a raw value wraps it in a property.
  for (const g of ["billboard", "point", "model"]) if (e[g]) e[g] = new Proxy({}, {
    set: (t: Record<string, unknown>, k: string, v) => { t[k] = typeof v === "object" && v && "getValue" in v ? v : prop(v); return true; },
    get: (t: Record<string, unknown>, k: string) => t[k],
  });
  if (extra.billboard) e.billboard.scale = extra.billboard.scale;
  if (extra.point) { e.point.pixelSize = 6; e.point.outlineWidth = 1; }
  if (extra.model) { e.model.color = { c: "#050805" }; e.model.silhouetteSize = 2.5; e.model.minimumPixelSize = 40; }
  return e;
}

describe("NVG contact visibility", () => {
  it("targets aircraft, ships and satellite markers only", () => {
    expect(contactKind("plane-abc")).toBe("plane");
    expect(contactKind("ship-123")).toBe("ship");
    expect(contactKind("sat-4")).toBe("sat");
    expect(contactKind("sat-track-4")).toBeNull();
    expect(contactKind("incident-1")).toBeNull();
  });

  it("enlarges icons, haloes points, keeps category colours, and restores on exit", () => {
    const plane = ent("plane-a", { billboard: { scale: 0.45 }, model: {}, _owColor: "#e69f00" });
    const ship = ent("ship-1", { billboard: { scale: 0.38 }, model: {}, _owShip: { ship_type: 35 } });
    const sat = ent("sat-0", { point: {}, model: {}, _owColor: "#56b4e9" });
    const viewer = { entities: { values: [plane, ship, sat] } };

    expect(applyNvgContacts(viewer, C, true)).toBe(true);
    expect(plane.billboard.scale.getValue()).toBeCloseTo(0.45 * NVG_CONTACT.billboardScale);
    expect(plane.model.color.getValue().c).toBe("#e69f00");
    expect(plane.model.silhouetteSize.getValue()).toBe(NVG_CONTACT.silhouetteSize);
    expect(ship.model.color.getValue().c).not.toBe("#050805");
    expect(sat.point.pixelSize.getValue()).toBe(NVG_CONTACT.pointPixelSize);
    expect(sat.model.color.getValue().c).toBe("#56b4e9");
    expect(sat.model.minimumPixelSize.getValue()).toBeCloseTo(40 * NVG_CONTACT.modelMinPixels);
    // Idempotent: a second tick doesn't compound the scale.
    expect(applyNvgContacts(viewer, C, true)).toBe(false);
    expect(plane.billboard.scale.getValue()).toBeCloseTo(0.45 * NVG_CONTACT.billboardScale);

    applyNvgContacts(viewer, C, false);
    expect(plane.billboard.scale.getValue()).toBe(0.45);
    expect(sat.point.pixelSize.getValue()).toBe(6);
    expect(sat.model.minimumPixelSize.getValue()).toBe(40);
  });
});
