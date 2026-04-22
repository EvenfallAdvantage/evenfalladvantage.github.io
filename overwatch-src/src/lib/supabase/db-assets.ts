import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Assets (Armory) ──────────────────────────────────

export async function getAssets(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) { logDbReadError("assets", error); return []; }
  return data ?? [];
}

export async function createAsset(params: {
  companyId: string;
  name: string;
  assetType?: string;
  serialNumber?: string;
}) {
  const supabase = createClient();
  const qrCode = `ASSET-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("assets")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      asset_type: params.assetType ?? null,
      serial_number: params.serialNumber ?? null,
      qr_code: qrCode,
      ...ts(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function checkoutAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "checked_out", current_holder_id: userId, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  // Log the checkout
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkout",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

export async function checkinAsset(assetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: "available", current_holder_id: null, updated_at: new Date().toISOString() })
    .eq("id", assetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  // Log the checkin
  await supabase.from("asset_logs").insert({
    id: crypto.randomUUID(),
    asset_id: assetId,
    user_id: userId,
    action: "checkin",
    created_at: new Date().toISOString(),
  }).then(() => {});
  return data;
}

export async function getAssetByQrCode(companyId: string, scannedValue: string) {
  const supabase = createClient();
  // Try matching the system-generated qr_code first
  const { data: byQr } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("qr_code", scannedValue)
    .maybeSingle();
  if (byQr) return byQr;
  // Fall back to matching by serial_number (physical device QR codes encode this)
  const { data: bySerial } = await supabase
    .from("assets")
    .select("*, users(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("serial_number", scannedValue)
    .maybeSingle();
  return bySerial;
}

export async function deleteAsset(assetId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw error;
}
