"use client";

import { useState } from "react";
import { Plus, Loader2, Trash2, CalendarOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getTimeOffPolicies, createTimeOffPolicy, deleteTimeOffPolicy } from "@/lib/supabase/db";

const LEAVE_TYPES = ["vacation", "sick", "personal", "bereavement", "parental", "unpaid"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;

interface LeavePoliciesSectionProps {
  companyId: string;
  initialPolicies: Policy[];
}

export default function LeavePoliciesSection({ companyId, initialPolicies }: LeavePoliciesSectionProps) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState("vacation");
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);

  async function handleAddPolicy() {
    if (!policyName.trim() || !companyId) return;
    setCreatingPolicy(true);
    try {
      await createTimeOffPolicy({ companyId, name: policyName.trim(), type: policyType });
      setPolicyName(""); setPolicyType("vacation"); setShowAddPolicy(false);
      setPolicies(await getTimeOffPolicies(companyId));
      toast.success("Policy created");
    } catch (err) { console.error(err); toast.error("Failed to create policy"); }
    finally { setCreatingPolicy(false); }
  }

  async function handleDeletePolicy(policyId: string) {
    if (!confirm("Delete this leave policy?")) return;
    setDeletingPolicy(policyId);
    try {
      await deleteTimeOffPolicy(policyId);
      setPolicies(await getTimeOffPolicies(companyId));
      toast.success("Policy deleted");
    } catch (err) { console.error(err); toast.error("Failed to delete policy"); }
    finally { setDeletingPolicy(null); }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Leave Policies</h3>
            <p className="text-xs text-muted-foreground">Configure leave types your team can request</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddPolicy(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {showAddPolicy && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Input placeholder="Policy name (e.g. Annual Leave)" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
            <select value={policyType} onChange={(e) => setPolicyType(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddPolicy} disabled={!policyName.trim() || creatingPolicy}>
                {creatingPolicy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddPolicy(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {policies.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
            <CalendarOff className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No leave policies yet. Add one so your team can request time off.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {policies.map((p: Policy) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] capitalize">{p.type}</Badge>
                  <button onClick={() => handleDeletePolicy(p.id)} disabled={deletingPolicy === p.id}
                    className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete policy">
                    {deletingPolicy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
