"use client";

import {
  QrCode, Loader2, ArrowUpFromLine, ArrowDownToLine,
  Trash2, Camera, ScanLine, CheckCircle2, AlertCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assetStatusColor, type Asset } from "./schedule-helpers";

const QrScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

interface ArmoryTabProps {
  isAdmin: boolean;
  assets: Asset[];
  assetsLoading: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newType: string;
  setNewType: (v: string) => void;
  newSerial: string;
  setNewSerial: (v: string) => void;
  creating: boolean;
  handleCreateAsset: () => void;
  acting: string | null;
  handleCheckout: (id: string) => void;
  handleCheckin: (id: string) => void;
  deletingAsset: string | null;
  handleDeleteAsset: (id: string) => void;
  scanMode: null | "serial" | "checkinout";
  setScanMode: (v: null | "serial" | "checkinout") => void;
  scanResult: { type: "success" | "error"; message: string } | null;
  handleSerialScan: (value: string) => void;
  handleCheckinoutScan: (value: string) => void;
}

export function ArmoryTab({
  isAdmin, assets, assetsLoading,
  showCreate, setShowCreate,
  newName, setNewName, newType, setNewType, newSerial, setNewSerial,
  creating, handleCreateAsset,
  acting, handleCheckout, handleCheckin,
  deletingAsset, handleDeleteAsset,
  scanMode, setScanMode, scanResult,
  handleSerialScan, handleCheckinoutScan,
}: ArmoryTabProps) {
  return (
    <>
      {/* QR Scanner Modal */}
      {scanMode === "serial" && (
        <QrScanner
          title="Scan Serial / Barcode"
          hint="Point at equipment barcode or QR code to populate serial number"
          onScan={handleSerialScan}
          onClose={() => setScanMode(null)}
        />
      )}
      {scanMode === "checkinout" && (
        <QrScanner
          title="Scan to Check In / Out"
          hint="Scan an asset's QR code to toggle check-in or check-out"
          onScan={handleCheckinoutScan}
          onClose={() => setScanMode(null)}
        />
      )}

      {/* Scan result toast */}
      {scanResult && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${scanResult.type === "success" ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
          {scanResult.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {scanResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-start">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setScanMode("checkinout")}>
          <ScanLine className="h-4 w-4" /> Scan Check In / Out
        </Button>
      </div>

      {showCreate && (
        <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
          <Input placeholder="Equipment name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="Type (e.g. Radio, Vest)" value={newType} onChange={(e) => setNewType(e.target.value)} className="flex-1" />
            <div className="flex-1 relative">
              <Input placeholder="Serial #" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} className="pr-9" />
              <button
                type="button"
                onClick={() => setScanMode("serial")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                title="Scan barcode / QR code"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateAsset} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {assetsLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <QrCode className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No gear registered</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {isAdmin ? "Add equipment to start tracking inventory." : "Your organization hasn't registered any gear yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((a: Asset) => (
            <div key={a.id} className="rounded-xl border border-border/50 bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 shrink-0">
                  <QrCode className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{a.name}</p>
                    <Badge className={`text-[10px] shrink-0 ${assetStatusColor(a.status)}`}>
                      {a.status === "checked_out" ? "Out" : a.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                    {a.asset_type && <span className="text-xs text-muted-foreground">{a.asset_type}</span>}
                    {a.serial_number && <span className="text-xs text-muted-foreground">SN: {a.serial_number}</span>}
                    {a.users && <span className="text-xs text-primary font-medium">→ {a.users.first_name} {a.users.last_name}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 ml-[52px]">
                {a.status === "available" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckout(a.id)} disabled={acting === a.id}>
                    {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
                    Check Out
                  </Button>
                ) : a.status === "checked_out" ? (
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckin(a.id)} disabled={acting === a.id}>
                    {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
                    Return
                  </Button>
                ) : null}
                {isAdmin && (
                  <button onClick={() => handleDeleteAsset(a.id)} disabled={deletingAsset === a.id}
                    className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete asset">
                    {deletingAsset === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
