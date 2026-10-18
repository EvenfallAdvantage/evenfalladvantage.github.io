/**
 * Feature flag for the grouped layers panel (v2), on by default.
 * Resolution order: the user's own choice > company default > on.
 * The user's choice is kept in localStorage here; it can also be synced via
 * user_map_prefs (see use-map-prefs-sync) so it follows them across devices.
 */

export const PANEL_V2_DEFAULT = true;

function key(userId: string | null): string {
  return `ow.opsmap.panelV2:${userId ?? "anon"}`;
}

/** The user's explicit choice, or null if they never chose. */
export function readPanelV2Choice(storage: Pick<Storage, "getItem"> | null | undefined, userId: string | null): boolean | null {
  try {
    const v = storage?.getItem(key(userId));
    if (v === "1") return true;
    if (v === "0") return false;
  } catch { /* storage unavailable */ }
  return null;
}

export function writePanelV2Choice(storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined, userId: string | null, on: boolean | null): void {
  try {
    if (on === null) storage?.removeItem(key(userId));
    else storage?.setItem(key(userId), on ? "1" : "0");
  } catch { /* storage unavailable */ }
}

export function resolvePanelV2(userChoice: boolean | null, companyDefault: boolean | null | undefined): boolean {
  if (userChoice !== null) return userChoice;
  if (companyDefault !== null && companyDefault !== undefined) return companyDefault;
  return PANEL_V2_DEFAULT;
}
