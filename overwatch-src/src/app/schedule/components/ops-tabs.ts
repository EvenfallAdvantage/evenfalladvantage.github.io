/** Operations (/schedule) tabs. Geofences (manager+) moved here from Personnel; Armory moved to Tools (/armory). */
export const OPS_TABS = ["map", "schedule", "swaps", "geofences"] as const;
export type OpsTab = (typeof OPS_TABS)[number];

/** Armory now lives under Tools. */
export const ARMORY_HREF = "/armory";

export function resolveOpsTab(tab: string | null | undefined, isManager: boolean): OpsTab {
  if (tab === "geofences") return isManager ? "geofences" : "map";
  if (tab && (OPS_TABS as readonly string[]).includes(tab)) return tab as OpsTab;
  return "map";
}

/** Legacy ?tab= values that now live on another page. */
export function opsRedirect(tab: string | null | undefined): string | undefined {
  return tab === "armory" ? ARMORY_HREF : undefined;
}
