/**
 * Ops map preferences (migration 20261018120000_map_layer_prefs.sql):
 *   user_map_prefs        the signed-in user's own layer settings per company + device class
 *   company_map_defaults  company-wide defaults (admins write)
 * Every call tolerates the tables being absent (migration not applied yet)
 * and returns null / false so the map keeps using browser storage.
 */

import { createClient } from "./client";
import type { PresetId, GroupId } from "@/lib/map/layer-registry";

export type DeviceClass = "desktop" | "mobile";

export interface UserMapPrefs {
  preset: PresetId | "custom";
  layers: Record<string, unknown>;
  view: { panelV2?: boolean | null; [k: string]: unknown };
  updatedAt: string;
}

export interface CompanyMapDefaults {
  defaultPreset: PresetId;
  defaultPresetMobile: PresetId;
  panelV2: boolean;
  hiddenGroups: GroupId[];
  nearRadiiKm: Record<string, number>;
  updatedAt: string | null;
}

export const DEFAULT_COMPANY_MAP_DEFAULTS: CompanyMapDefaults = {
  defaultPreset: "securityOps",
  defaultPresetMobile: "clean",
  panelV2: true,
  hiddenGroups: [],
  nearRadiiKm: {},
  updatedAt: null,
};

/** Keys never synced (company/site specific or derived). */
const UNSYNCED_KEYS = new Set(["siteOverlays"]);

export function layersForSync(layers: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(layers).filter(([k]) => !UNSYNCED_KEYS.has(k)));
}

export async function getUserMapPrefs(companyId: string, device: DeviceClass): Promise<UserMapPrefs | null> {
  try {
    const { data, error } = await createClient()
      .from("user_map_prefs")
      .select("preset, layers, view, updated_at")
      .eq("company_id", companyId)
      .eq("device_class", device)
      .maybeSingle();
    if (error || !data) return null;
    return { preset: data.preset, layers: data.layers ?? {}, view: data.view ?? {}, updatedAt: data.updated_at };
  } catch {
    return null;
  }
}

export async function saveUserMapPrefs(companyId: string, device: DeviceClass, prefs: { preset: string; layers: object; view: object }): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from("user_map_prefs")
      .upsert({ company_id: companyId, device_class: device, preset: prefs.preset, layers: layersForSync(prefs.layers), view: prefs.view }, { onConflict: "user_id,company_id,device_class" });
    return !error;
  } catch {
    return false;
  }
}

/** Store the panel choice on both device classes (it is per user, not per device). */
export async function saveUserPanelChoice(companyId: string, panelV2: boolean | null): Promise<void> {
  const supabase = createClient();
  for (const device of ["desktop", "mobile"] as const) {
    try {
      const existing = await getUserMapPrefs(companyId, device);
      await supabase.from("user_map_prefs").upsert(
        { company_id: companyId, device_class: device, view: { ...(existing?.view ?? {}), panelV2 }, ...(existing ? {} : { preset: "custom", layers: {} }) },
        { onConflict: "user_id,company_id,device_class" },
      );
    } catch { /* tables absent */ }
  }
}

export async function getCompanyMapDefaults(companyId: string): Promise<CompanyMapDefaults | null> {
  try {
    const { data, error } = await createClient()
      .from("company_map_defaults")
      .select("default_preset, default_preset_mobile, panel_v2, hidden_groups, near_radii_km, updated_at")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      defaultPreset: data.default_preset,
      defaultPresetMobile: data.default_preset_mobile,
      panelV2: data.panel_v2,
      hiddenGroups: data.hidden_groups ?? [],
      nearRadiiKm: data.near_radii_km ?? {},
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

export async function saveCompanyMapDefaults(companyId: string, d: Omit<CompanyMapDefaults, "updatedAt">): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await createClient().from("company_map_defaults").upsert({
      company_id: companyId,
      default_preset: d.defaultPreset,
      default_preset_mobile: d.defaultPresetMobile,
      panel_v2: d.panelV2,
      hidden_groups: d.hiddenGroups.filter((g) => g !== "myOps"),
      near_radii_km: d.nearRadiiKm,
    }, { onConflict: "company_id" });
    if (error) return { ok: false, error: error.code === "42P01" ? "Company map settings aren't enabled yet (database update pending)." : error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}
