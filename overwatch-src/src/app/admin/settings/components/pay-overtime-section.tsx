"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  getOvertimeConfig, saveOvertimeConfig, DEFAULT_OT_CONFIG, type OvertimeConfig,
  getCompanyDefaultRates, updateCompanyDefaultPayRate, updateCompanyDefaultBillRate,
} from "@/lib/supabase/db";
import { OT_PRESETS, detectOtPreset, validateOvertimeConfig, parseRate, type OtPresetId } from "@/lib/policy-presets";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const tap = "h-11 sm:h-8";

export default function PayOvertimeSection({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cfg, setCfg] = useState<OvertimeConfig>(DEFAULT_OT_CONFIG);
  const [preset, setPreset] = useState<OtPresetId>("federal");
  const [pay, setPay] = useState("");
  const [bill, setBill] = useState("");
  const [savingOt, setSavingOt] = useState(false);
  const [savingRates, setSavingRates] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, r] = await Promise.all([getOvertimeConfig(companyId), getCompanyDefaultRates(companyId)]);
        if (cancelled) return;
        setCfg(c); setPreset(detectOtPreset(c));
        setPay(r.payRate != null ? r.payRate.toFixed(2) : "");
        setBill(r.billRate != null ? r.billRate.toFixed(2) : "");
      } catch (e) {
        logger.swallow("pay-overtime:load", e, "warn");
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  function pickPreset(id: OtPresetId) {
    setPreset(id);
    const p = OT_PRESETS.find((x) => x.id === id);
    if (p) setCfg((c) => ({ ...c, ...p.config }));
  }
  function setNum(k: "weeklyThreshold" | "dailyThreshold" | "doubletimeThreshold", v: string) {
    const next = { ...cfg, [k]: v === "" ? 0 : Number(v) };
    setCfg(next); setPreset(detectOtPreset(next));
  }

  async function saveOt() {
    const err = validateOvertimeConfig(cfg);
    if (err) { toast.error(err); return; }
    setSavingOt(true);
    try { await saveOvertimeConfig(companyId, cfg); toast.success("Overtime rules saved"); }
    catch (e) { logger.swallow("pay-overtime:save-ot", e, "warn"); toast.error("Couldn't save overtime rules"); }
    finally { setSavingOt(false); }
  }

  async function saveRates() {
    const p = parseRate(pay), b = parseRate(bill);
    if (p === undefined || b === undefined) { toast.error("Enter rates like 22.50"); return; }
    setSavingRates(true);
    try {
      await Promise.all([updateCompanyDefaultPayRate(companyId, p), updateCompanyDefaultBillRate(companyId, b)]);
      toast.success("Default rates saved");
    } catch (e) { logger.swallow("pay-overtime:save-rates", e, "warn"); toast.error("Couldn't save default rates"); }
    finally { setSavingRates(false); }
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Pay &amp; Overtime</h3>
          <p className="text-xs text-muted-foreground">Used for overtime warnings, pay estimates and invoices.</p>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</p>
        ) : failed ? (
          <p role="alert" className="text-xs text-red-500">Couldn&apos;t load pay settings. Reload to try again.</p>
        ) : (
          <>
            <section className="space-y-3" aria-label="Default rates">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Default rates</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="default-pay-rate" className="text-xs">Default pay rate ($/hr)</Label>
                  <Input id="default-pay-rate" inputMode="decimal" placeholder="e.g. 22.00" value={pay} onChange={(e) => setPay(e.target.value)} className={`mt-1 ${tap}`} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Used when a staff member has no rate of their own.</p>
                </div>
                <div>
                  <Label htmlFor="default-bill-rate" className="text-xs">Default bill rate ($/hr)</Label>
                  <Input id="default-bill-rate" inputMode="decimal" placeholder="e.g. 35.00" value={bill} onChange={(e) => setBill(e.target.value)} className={`mt-1 ${tap}`} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Used on invoices when the event or member has no bill rate. Blank = 1.5× pay rate.</p>
                </div>
              </div>
              <Button onClick={saveRates} disabled={savingRates} className={`gap-1.5 ${tap}`}>
                {savingRates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save rates
              </Button>
            </section>

            <section className="space-y-3" aria-label="Overtime rules">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overtime rules</h4>
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Overtime preset">
                {[...OT_PRESETS, { id: "custom" as const, label: "Custom", desc: "Set your own thresholds." }].map((p) => (
                  <button key={p.id} type="button" role="radio" aria-checked={preset === p.id} onClick={() => pickPreset(p.id)}
                    className={`min-h-11 rounded-lg border p-3 text-left transition-colors ${preset === p.id ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/30"}`}>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label htmlFor="ot-weekly" className="text-xs">OT after (hrs/week)</Label>
                  <Input id="ot-weekly" type="number" min={0} max={168} value={cfg.weeklyThreshold} onChange={(e) => setNum("weeklyThreshold", e.target.value)} className={`mt-1 ${tap}`} />
                </div>
                <div>
                  <Label htmlFor="ot-daily" className="text-xs">OT after (hrs/day)</Label>
                  <Input id="ot-daily" type="number" min={0} max={24} value={cfg.dailyThreshold} onChange={(e) => setNum("dailyThreshold", e.target.value)} className={`mt-1 ${tap}`} />
                </div>
                <div>
                  <Label htmlFor="ot-dt" className="text-xs">Double time after (hrs/day)</Label>
                  <Input id="ot-dt" type="number" min={0} max={24} value={cfg.doubletimeThreshold} onChange={(e) => setNum("doubletimeThreshold", e.target.value)} className={`mt-1 ${tap}`} />
                </div>
                <div>
                  <Label htmlFor="ot-weekstart" className="text-xs">Week starts</Label>
                  <select id="ot-weekstart" value={cfg.weekStartDay} onChange={(e) => setCfg({ ...cfg, weekStartDay: Number(e.target.value) })}
                    className={`mt-1 w-full rounded-md border border-input bg-background px-2 text-sm ${tap}`}>
                    {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">0 turns a rule off. The California 7th-consecutive-day rule isn&apos;t applied automatically. Check payroll for those weeks.</p>
              <Button onClick={saveOt} disabled={savingOt} className={`gap-1.5 ${tap}`}>
                {savingOt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save overtime rules
              </Button>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
