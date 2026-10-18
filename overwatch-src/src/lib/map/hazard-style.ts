/** Colors, labels and request planning for the natural-hazards layer. */
import type { HazardKind, HazardSource, IntelHazard } from "@/lib/intel-types";

/** NWS-style colors: warnings red, watches amber, advisories yellow. */
export function hazardColor(h: Pick<IntelHazard, "kind" | "severity">): string {
  switch (h.kind) {
    case "warning": return h.severity >= 4 ? "#dc2626" : "#ef4444";
    case "watch": return "#f59e0b";
    case "advisory": return "#facc15";
    case "perimeter": return "#f97316";
    case "fire": return h.severity >= 3 ? "#ef4444" : "#fb923c";
    case "quake": return h.severity >= 3 ? "#ef4444" : h.severity === 2 ? "#f59e0b" : "#fde047";
    case "cyclone": case "cyclone_cone": case "cyclone_track": return "#e879f9";
    case "volcano": return "#b91c1c";
  }
}

export const HAZARD_KIND_LABELS: Record<HazardKind, string> = {
  warning: "Warning", watch: "Watch", advisory: "Advisory", quake: "Earthquake", fire: "Fire detection",
  perimeter: "Wildfire perimeter", cyclone: "Tropical cyclone", cyclone_cone: "Forecast cone", cyclone_track: "Forecast track", volcano: "Volcano",
};

/** Which intel-hazards sources the current layer switches need. */
export function hazardSourcesFor(layers: { nwsWarnings?: boolean; naturalHazards?: boolean; tropical?: boolean }): HazardSource[] {
  const out: HazardSource[] = [];
  if (layers.nwsWarnings) out.push("warnings");
  if (layers.naturalHazards) out.push("quakes", "fires", "perimeters", "volcanoes");
  if (layers.tropical) out.push("tropical");
  return out;
}

/** Kinds drawn for the current switches (a response may carry more). */
export function hazardVisible(h: Pick<IntelHazard, "kind">, layers: { nwsWarnings?: boolean; naturalHazards?: boolean; tropical?: boolean }): boolean {
  if (h.kind === "warning" || h.kind === "watch" || h.kind === "advisory") return !!layers.nwsWarnings;
  if (h.kind.startsWith("cyclone")) return !!layers.tropical;
  return !!layers.naturalHazards;
}
