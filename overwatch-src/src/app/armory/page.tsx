"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { usePageHeader } from "@/stores/page-header-store";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";
import {
  getAssets, createAsset, checkoutAsset, checkinAsset, deleteAsset, getAssetByQrCode,
} from "@/lib/supabase/db";
import { ArmoryTab } from "@/app/schedule/components/armory-tab";
import type { Asset } from "@/app/schedule/components/schedule-helpers";

/** Armory (equipment checkout) — moved from Operations to Tools. */
export default function ArmoryPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [showCreate, setShowCreate] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<null | "serial" | "checkinout">(null);
  const [scanResult, setScanResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setHeader("ARMORY", "Equipment checkout and returns", <QrCode className="h-5 w-5" />,
      isAdmin ? (
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Add Gear
        </Button>
      ) : undefined,
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, isAdmin]);

  const loadAssets = useCallback(async () => {
    if (!activeCompanyId) { setAssetsLoading(false); return; }
    try { setAssets(await getAssets(activeCompanyId)); } catch (e) { logger.swallow("armory:load-assets", e, "debug"); } finally { setAssetsLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  async function handleCreateAsset() {
    if (!newName.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createAsset({ companyId: activeCompanyId, name: newName.trim(), assetType: newType || undefined, serialNumber: newSerial || undefined });
      setNewName(""); setNewType(""); setNewSerial(""); setShowCreate(false); await loadAssets();
      toast.success("Asset created");
    } catch (err) { console.error(err); toast.error("Failed to create asset"); } finally { setCreating(false); }
  }

  async function handleCheckout(id: string) {
    setActing(id);
    try { await checkoutAsset(id); await loadAssets(); toast.success("Asset checked out"); }
    catch (err) { console.error(err); toast.error("Checkout failed"); }
    finally { setActing(null); }
  }

  async function handleCheckin(id: string) {
    setActing(id);
    try { await checkinAsset(id); await loadAssets(); toast.success("Asset checked in"); }
    catch (err) { console.error(err); toast.error("Check-in failed"); }
    finally { setActing(null); }
  }

  async function handleDeleteAsset(id: string) {
    if (!await confirm({ description: "Delete this asset?", variant: "destructive" })) return;
    setDeletingAsset(id);
    try { await deleteAsset(id); await loadAssets(); toast.success("Asset deleted"); }
    catch (err) { console.error(err); toast.error("Failed to delete asset"); }
    finally { setDeletingAsset(null); }
  }

  function handleSerialScan(value: string) {
    setNewSerial(value); setScanMode(null);
    setScanResult({ type: "success", message: `Scanned: ${value}` });
    setTimeout(() => setScanResult(null), 3000);
  }

  async function handleCheckinoutScan(value: string) {
    setScanMode(null);
    if (!activeCompanyId) {
      setScanResult({ type: "error", message: "No active company." });
      setTimeout(() => setScanResult(null), 4000); return;
    }
    try {
      const asset = await getAssetByQrCode(activeCompanyId, value);
      if (!asset) { setScanResult({ type: "error", message: "No equipment found for scanned code." }); }
      else if (asset.status === "available") { await checkoutAsset(asset.id); setScanResult({ type: "success", message: `Checked out: ${asset.name}` }); }
      else if (asset.status === "checked_out") { await checkinAsset(asset.id); setScanResult({ type: "success", message: `Returned: ${asset.name}` }); }
      else { setScanResult({ type: "error", message: `Asset "${asset.name}" status: ${asset.status}` }); }
      await loadAssets();
    } catch (err) { console.error(err); setScanResult({ type: "error", message: "Scan action failed. Try again." }); }
    setTimeout(() => setScanResult(null), 4000);
  }

  return (
    <>
      <ArmoryTab
        isAdmin={isAdmin} assets={assets} assetsLoading={assetsLoading}
        showCreate={showCreate} setShowCreate={setShowCreate}
        newName={newName} setNewName={setNewName}
        newType={newType} setNewType={setNewType}
        newSerial={newSerial} setNewSerial={setNewSerial}
        creating={creating} handleCreateAsset={handleCreateAsset}
        acting={acting} handleCheckout={handleCheckout} handleCheckin={handleCheckin}
        deletingAsset={deletingAsset} handleDeleteAsset={handleDeleteAsset}
        scanMode={scanMode} setScanMode={setScanMode}
        scanResult={scanResult}
        handleSerialScan={handleSerialScan} handleCheckinoutScan={handleCheckinoutScan}
      />
      <ConfirmDialog />
    </>
  );
}
