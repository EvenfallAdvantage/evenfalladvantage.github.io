"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getAssets, createAsset } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

export default function AssetsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = ["owner", "admin", "manager"].includes(activeCompany?.role ?? "");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setAssets(await getAssets(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!newName.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createAsset({ companyId: activeCompanyId, name: newName.trim(), assetType: newType || undefined, serialNumber: newSerial || undefined });
      setNewName(""); setNewType(""); setNewSerial(""); setShowCreate(false); await load();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  const statusColor = (s: string) => {
    if (s === "available") return "bg-green-500/15 text-green-600";
    if (s === "checked_out") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Armory</h1>
            <p className="text-sm text-muted-foreground">Equipment inventory and gear tracking</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Add Gear
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
            <Input placeholder="Equipment name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex gap-2">
              <Input placeholder="Type (e.g. Radio, Vest)" value={newType} onChange={(e) => setNewType(e.target.value)} className="flex-1" />
              <Input placeholder="Serial #" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <Shield className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No gear registered</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {isAdmin ? "Add equipment to start tracking inventory." : "Your organization hasn't registered any gear yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((a: Asset) => (
              <div key={a.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{a.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.asset_type && <span className="text-xs text-muted-foreground">{a.asset_type}</span>}
                    {a.serial_number && <span className="text-xs text-muted-foreground">SN: {a.serial_number}</span>}
                  </div>
                </div>
                <Badge className={`text-[10px] ${statusColor(a.status)}`}>{a.status}</Badge>
                {a.users && <span className="text-xs text-muted-foreground">{a.users.first_name} {a.users.last_name}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
