// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { TACTICAL_ICON_DPR, iconSize } from "@/lib/map/tactical-icons";
import { buildIncidentIcon, roadIncidentIconPx } from "@/components/tactical-map/hooks/use-road-incidents-layer";

describe("road incident icon logical size", () => {
  it("closures/crashes render at CCTV size (12 px), severe at 14 px max", () => {
    for (const kind of ["closure", "crash", "construction", "hazard", "congestion"] as const) {
      for (const sev of ["minor", "moderate", "major", "critical"] as const) {
        const c = buildIncidentIcon(kind, sev);
        const s = iconSize(c);
        const px = roadIncidentIconPx(sev);
        expect(px).toBeLessThanOrEqual(14);
        expect(s).toEqual({ width: px, height: px });
        expect(c.width).toBe(px * TACTICAL_ICON_DPR);
      }
    }
    expect(roadIncidentIconPx("minor")).toBe(12);
    expect(roadIncidentIconPx("critical")).toBe(14);
  });
});
