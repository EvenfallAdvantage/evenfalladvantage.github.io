/**
 * /timeclock is Clock only (+ Mass Clock for managers). Tasks and Patrols
 * live on their own screens; old ?tab=tasks / ?tab=patrols links redirect.
 */
export type ClockTab = "clock" | "mass-clock";

export const CLOCK_TAB_REDIRECTS: Record<string, string> = {
  tasks: "/tasks",
  patrols: "/patrols",
};

export function resolveClockTab(
  tab: string | null | undefined,
  isManager: boolean,
): { tab: ClockTab; redirect?: string } {
  if (tab && CLOCK_TAB_REDIRECTS[tab]) return { tab: "clock", redirect: CLOCK_TAB_REDIRECTS[tab] };
  if (tab === "mass-clock" && isManager) return { tab: "mass-clock" };
  return { tab: "clock" };
}
