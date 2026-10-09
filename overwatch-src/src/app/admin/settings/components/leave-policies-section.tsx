"use client";

import { useState } from "react";
import { Plus, Loader2, Trash2, CalendarOff, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { getTimeOffPolicies, createTimeOffPolicy, updateTimeOffPolicy, deleteTimeOffPolicy } from "@/lib/supabase/db";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ACCRUAL_PERIODS, ACCRUAL_PERIOD_LABEL, parseOptionalNumber } from "@/lib/policy-presets";

const LEAVE_TYPES = ["vacation", "sick", "personal", "bereavement", "parental", "unpaid"];
const tap = "h-11 sm:h-8";

type Policy = Record<string, unknown> & {
  id: string;
  name: string;
  type: string;
  accrual_rate?: number | null;
  accrual_period?: string | null;
  max_balance?: number | null;
  is_paid?: boolean | null;
};

type Draft = { name: string; type: string; accrualRate: string; accrualPeriod: string; maxBalance: string; isPaid: boolean };
const emptyDraft: Draft = { name: "", type: "vacation", accrualRate: "", accrualPeriod: "", maxBalance: "", isPaid: true };
const toDraft = (p: Policy): Draft => ({
  name: p.name,
  type: p.type,
  accrualRate: p.accrual_rate != null ? String(p.accrual_rate) : "",
  accrualPeriod: p.accrual_period ?? "",
  maxBalance: p.max_balance != null ? String(p.max_balance) : "",
  isPaid: p.is_paid ?? p.type !== "unpaid",
});

/** Validate a draft → DB fields, or an error string. */
export function draftToFields(d: Draft) {
  if (!d.name.trim()) return "Give the policy a name";
  const accrualRate = parseOptionalNumber(d.accrualRate, 1000);
  const maxBalance = parseOptionalNumber(d.maxBalance, 10000);
  if (accrualRate === undefined) return "Accrual must be a number of hours";
  if (maxBalance === undefined) return "Cap must be a number of hours";
  if (accrualRate != null && !d.accrualPeriod) return "Pick how often hours accrue";
  return {
    name: d.name.trim(),
    type: d.type,
    accrualRate,
    accrualPeriod: accrualRate != null ? d.accrualPeriod : null,
    maxBalance,
    isPaid: d.isPaid,
  };
}

function PolicyForm({ draft, setDraft, onSubmit, onCancel, busy, submitLabel }: {
  draft: Draft; setDraft: (d: Draft) => void; onSubmit: () => void; onCancel: () => void; busy: boolean; submitLabel: string;
}) {
  return (
    <form className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="lp-name" className="text-xs">Name</Label>
          <Input id="lp-name" placeholder="e.g. Annual Leave" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`mt-1 ${tap}`} maxLength={60} />
        </div>
        <div>
          <Label htmlFor="lp-type" className="text-xs">Type</Label>
          <select id="lp-type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value, isPaid: e.target.value === "unpaid" ? false : draft.isPaid })}
            className={`mt-1 w-full rounded-md border border-input bg-background px-2 text-sm ${tap}`}>
            {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="lp-accrual" className="text-xs">Accrues (hours, optional)</Label>
          <div className="mt-1 flex gap-2">
            <Input id="lp-accrual" inputMode="decimal" placeholder="e.g. 0.0333" value={draft.accrualRate} onChange={(e) => setDraft({ ...draft, accrualRate: e.target.value })} className={`min-w-0 flex-1 ${tap}`} />
            <select aria-label="Accrual period" value={draft.accrualPeriod} onChange={(e) => setDraft({ ...draft, accrualPeriod: e.target.value })}
              className={`rounded-md border border-input bg-background px-2 text-sm ${tap}`}>
              <option value="">How often…</option>
              {ACCRUAL_PERIODS.map((p) => <option key={p} value={p}>{ACCRUAL_PERIOD_LABEL[p]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="lp-cap" className="text-xs">Max balance (hours, optional)</Label>
          <Input id="lp-cap" inputMode="decimal" placeholder="e.g. 80" value={draft.maxBalance} onChange={(e) => setDraft({ ...draft, maxBalance: e.target.value })} className={`mt-1 ${tap}`} />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
        <input type="checkbox" checked={draft.isPaid} onChange={(e) => setDraft({ ...draft, isPaid: e.target.checked })} className="rounded" /> Paid leave
      </label>
      <div className="flex gap-2">
        <Button type="submit" className={tap} disabled={busy || !draft.name.trim()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : submitLabel}
        </Button>
        <Button type="button" variant="ghost" className={tap} onClick={onCancel}>Cancel</Button>
      </div>
      <p className="text-[10px] text-muted-foreground">Accrual and caps are shown to staff as policy details. Balances aren&apos;t tracked automatically yet.</p>
    </form>
  );
}

export default function LeavePoliciesSection({ companyId, initialPolicies }: { companyId: string; initialPolicies: Policy[] }) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const reload = async () => setPolicies((await getTimeOffPolicies(companyId)) as Policy[]);

  async function submit() {
    const fields = draftToFields(draft);
    if (typeof fields === "string") { toast.error(fields); return; }
    setBusy(true);
    try {
      if (editingId) await updateTimeOffPolicy(editingId, fields);
      else await createTimeOffPolicy({ companyId, ...fields });
      toast.success(editingId ? "Policy updated" : "Policy created");
      setAdding(false); setEditingId(null); setDraft(emptyDraft);
      await reload();
    } catch (e) {
      logger.swallow("leave-policies:save", e, "warn");
      toast.error(editingId ? "Couldn't update policy" : "Couldn't create policy");
    } finally { setBusy(false); }
  }

  async function handleDeletePolicy(p: Policy) {
    if (!await confirm({ title: `Delete "${p.name}"?`, description: "Staff won't be able to request this leave type any more.", confirmLabel: "Delete", variant: "destructive" })) return;
    setDeletingPolicy(p.id);
    try { await deleteTimeOffPolicy(p.id); await reload(); toast.success("Policy deleted"); }
    catch (e) { logger.swallow("leave-policies:delete", e, "warn"); toast.error("Couldn't delete policy"); }
    finally { setDeletingPolicy(null); }
  }

  const cancel = () => { setAdding(false); setEditingId(null); setDraft(emptyDraft); };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Leave Policies</h3>
            <p className="text-xs text-muted-foreground">Leave types your team can request</p>
          </div>
          {!adding && !editingId && (
            <Button size="sm" variant="outline" className={`gap-1.5 ${tap}`} onClick={() => { setDraft(emptyDraft); setAdding(true); }}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>

        {adding && <PolicyForm draft={draft} setDraft={setDraft} onSubmit={submit} onCancel={cancel} busy={busy} submitLabel="Create" />}

        {policies.length === 0 && !adding ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
            <CalendarOff className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No leave policies yet. Add one so your team can request time off.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {policies.map((p) => editingId === p.id ? (
              <PolicyForm key={p.id} draft={draft} setDraft={setDraft} onSubmit={submit} onCancel={cancel} busy={busy} submitLabel="Save" />
            ) : (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CalendarOff className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {(p.is_paid ?? p.type !== "unpaid") ? "Paid" : "Unpaid"}
                    {p.accrual_rate != null && ` · ${p.accrual_rate}h ${ACCRUAL_PERIOD_LABEL[p.accrual_period ?? ""] ?? p.accrual_period ?? ""}`}
                    {p.max_balance != null && ` · cap ${p.max_balance}h`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] capitalize">{p.type}</Badge>
                  <button type="button" aria-label={`Edit ${p.name}`} onClick={() => { setAdding(false); setDraft(toDraft(p)); setEditingId(p.id); }}
                    className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-muted/40 hover:text-foreground sm:h-8 sm:w-8">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" aria-label={`Delete ${p.name}`} onClick={() => handleDeletePolicy(p)} disabled={deletingPolicy === p.id}
                    className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground hover:bg-red-500/10 hover:text-red-500 sm:h-8 sm:w-8">
                    {deletingPolicy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <ConfirmDialog />
    </Card>
  );
}
