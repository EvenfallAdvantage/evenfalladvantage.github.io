/** Operations (/schedule) tabs. Geofences (manager+) moved here from Personnel. */
export const OPS_TABS = ["map", "schedule", "swaps", "armory", "geofences"] as const;
export type OpsTab = (typeof OPS_TABS)[number];

export function resolveOpsTab(tab: string | null | undefined, isManager: boolean): OpsTab {
  if (tab === "geofences") return isManager ? "geofences" : "map";
  if (tab && (OPS_TABS as readonly string[]).includes(tab)) return tab as OpsTab;
  return "map";
}
