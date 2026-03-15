"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarOff, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getTimeOffRequests, getTimeOffPolicies, createTimeOffRequest } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;

export default function TimeOffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [requests, setRequests] = useState<Request[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const reqs = await getTimeOffRequests();
      setRequests(reqs);
      if (activeCompanyId && activeCompanyId !== "pending") {
        setPolicies(await getTimeOffPolicies(activeCompanyId));
      }
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!startDate || !endDate || !selectedPolicy) return;
    setCreating(true);
    try {
      await createTimeOffRequest({ policyId: selectedPolicy, startDate, endDate, note: note || undefined });
      setStartDate(""); setEndDate(""); setNote(""); setSelectedPolicy(""); setShowCreate(false);
      await load();
    } catch (err) { console.error("Leave request failed:", err); }
    finally { setCreating(false); }
  }

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-600";
    return "bg-amber-500/15 text-amber-600";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">LEAVE</h1>
            <p className="text-sm text-muted-foreground">Request and track leave days</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Request Leave
          </Button>
        </div>

        {showCreate && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
            {policies.length > 0 ? (
              <div>
                <label className="text-xs text-muted-foreground">Leave Type</label>
                <select value={selectedPolicy} onChange={(e) => setSelectedPolicy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select type...</option>
                  {policies.map((p: Policy) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                No leave policies configured yet. Ask your admin to set them up in HQ Config.
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <Input placeholder="Reason for leave..." value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!startDate || !endDate || !selectedPolicy || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <CalendarOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No leave requests</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Click &quot;Request Leave&quot; to submit your first request.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r: Request) => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                  <CalendarOff className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.time_off_policies?.name ?? "Leave Request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                </div>
                <Badge className={`text-[10px] ${statusColor(r.status)}`}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
