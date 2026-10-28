"use client";

import { useEffect, useState } from "react";
import { Coffee, Loader2, Save, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAuthStore } from "@/stores/auth-store";
import {
  getOvertimeConfig, saveOvertimeConfig, DEFAULT_OT_CONFIG, type OvertimeConfig,
  getCompanyDefaultRates, saveCompanyDefaultRates,
  getBreakPolicy, saveBreakPolicy, DEFAULT_BREAK_POLICY, type BreakPolicyConfig,
} from "@/lib/supabase/db";
import {
  OT_PRESETS, detectOtPreset, validateOvertimeConfig, parseRate, type OtPresetId,
  BREAK_PRESETS, detectBreakPreset, validateBreakPolicy, type BreakPresetId,
} from "@/lib/policy-presets";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const tap = "h-11 sm:h-8";

export default function PayOvertimeSection({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cfg, setCfg] = useState<OvertimeConfig>(DEFAULT_OT_CONFIG);
  const [preset, setPreset] = useState<OtPresetId>("federal");
  const [breakPolicy, setBreakPolicy] = useState<BreakPolicyConfig>(DEFAULT_BREAK_POLICY);
  const [breakPreset, setBreakPreset] = useState<BreakPresetId>("california");
  const [pay, setPay] = useState("");
  const [bill, setBill] = useState("");
  const [savingOt, setSavingOt] = useState(false);
  const [savingRates, setSavingRates] = useState(false);
  const [savingBreaks, setSavingBreaks] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, r, bp] = await Promise.all([
          getOvertimeConfig(companyId),
          getCompanyDefaultRates(companyId),
          getBreakPolicy(companyId),
        ]);
        if (cancelled) return;
        setCfg(c);
        setPreset(detectOtPreset(c));
        setBreakPolicy(bp);
        setBreakPreset(detectBreakPreset(bp));
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

  function pickBreakPreset(id: BreakPresetId) {
    setBreakPreset(id);
    const p = BREAK_PRESETS.find((x) => x.id === id);
    if (p) setBreakPolicy({ ...p.config });
  }

  function updateBreakField<K extends keyof BreakPolicyConfig>(key: K, value: BreakPolicyConfig[K]) {
    const next = { ...breakPolicy, [key]: value };
    setBreakPolicy(next);
    setBreakPreset(detectBreakPreset(next));
  }

  function setBreakNum(
    key:
      | "mealBreakMinutes"
      | "firstMealAfterHours"
      | "secondMealAfterHours"
      | "restBreakMinutes"
      | "maxRestBreaksPerShift"
      | "firstRestAfterHours"
      | "secondRestAfterHours"
      | "thirdRestAfterHours",
    v: string
  ) {
    const num = v === "" ? 0 : Number(v);
    updateBreakField(key, Number.isFinite(num) ? num : 0);
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
      await saveCompanyDefaultRates(companyId, p, b);
      toast.success("Default rates saved");
    } catch (e) { logger.swallow("pay-overtime:save-rates", e, "warn"); toast.error("Couldn't save default rates"); }
    finally { setSavingRates(false); }
  }

  async function handleSaveBreaks() {
    const err = validateBreakPolicy(breakPolicy);
    if (err) { toast.error(err); return; }
    setSavingBreaks(true);
    try {
      await saveBreakPolicy(companyId, breakPolicy);
      // Sync into active auth store session so timeclock widgets update immediately
      const state = useAuthStore.getState();
      if (state.user) {
        state.setUser({
          ...state.user,
          companies: state.user.companies.map((c) =>
            c.companyId === companyId
              ? {
                  ...c,
                  settings: {
                    ...(c.settings ?? {}),
                    break_policy: breakPolicy,
                  },
                }
              : c
          ),
        });
      }
      toast.success("Break & meal policy saved");
    } catch (e) {
      logger.swallow("pay-overtime:save-breaks", e, "warn");
      toast.error("Couldn't save break policy");
    } finally {
      setSavingBreaks(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Pay, Overtime &amp; Break Policy</h3>
          <p className="text-xs text-muted-foreground">Used for timeclock break buttons, unpaid lunch deductions, overtime warnings, pay estimates, payroll export, and invoices. Managers and above can change these.</p>
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

            <section className="space-y-3 border-t border-border/30 pt-5" aria-label="Overtime rules">
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
              <label className="flex min-h-11 items-start gap-2 text-sm sm:min-h-0">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={!!cfg.seventhDayRule}
                  onChange={(e) => { const next = { ...cfg, seventhDayRule: e.target.checked }; setCfg(next); setPreset(detectOtPreset(next)); }}
                />
                <span>
                  7th consecutive day rule
                  <span className="block text-[10px] text-muted-foreground">When someone works all 7 days of the workweek: first 8 hours on the 7th day at 1.5×, over 8 hours at 2× (California).</span>
                </span>
              </label>
              <p className="text-[10px] text-muted-foreground">0 turns a rule off.</p>
              <Button onClick={saveOt} disabled={savingOt} className={`gap-1.5 ${tap}`}>
                {savingOt ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save overtime rules
              </Button>
            </section>

            <section className="space-y-4 border-t border-border/30 pt-5" aria-label="Break & meal policy">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Break &amp; meal policy</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Controls timeclock break buttons (&ldquo;Take Lunch&rdquo; / &ldquo;Take {breakPolicy.restBreakMinutes}&rdquo;), compliance warnings, and whether breaks are paid or deducted from payable hours.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={breakPolicy.breaksEnabled}
                    onChange={(e) => updateBreakField("breaksEnabled", e.target.checked)}
                  />
                  Enable break buttons on timeclock
                </label>
              </div>

              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Break policy preset">
                {[...BREAK_PRESETS, { id: "custom" as const, label: "Custom", desc: "Configure your own meal & rest break rules." }].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={breakPreset === p.id}
                    onClick={() => pickBreakPreset(p.id)}
                    className={`min-h-11 rounded-lg border p-3 text-left transition-colors ${breakPreset === p.id ? "border-primary bg-primary/10" : "border-border/40 hover:bg-muted/30"}`}
                  >
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-[10px] text-muted-foreground">{p.desc}</span>
                  </button>
                ))}
              </div>

              {/* Meal / Lunch Break Rules */}
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold">Meal / Lunch Break</span>
                    <Badge
                      variant="outline"
                      className={
                        breakPolicy.mealBreakPaid
                          ? "text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : "text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-500"
                      }
                    >
                      {breakPolicy.mealBreakPaid ? "Paid (not deducted)" : "Unpaid (deducted from payable hrs)"}
                    </Badge>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={breakPolicy.mealBreakPaid}
                      onChange={(e) => updateBreakField("mealBreakPaid", e.target.checked)}
                    />
                    Paid meal break
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="break-meal-mins" className="text-xs">Meal duration (minutes)</Label>
                    <Input
                      id="break-meal-mins"
                      type="number"
                      min={5}
                      max={120}
                      value={breakPolicy.mealBreakMinutes}
                      onChange={(e) => setBreakNum("mealBreakMinutes", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-first-meal" className="text-xs">1st meal required after (hrs)</Label>
                    <Input
                      id="break-first-meal"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={breakPolicy.firstMealAfterHours}
                      onChange={(e) => setBreakNum("firstMealAfterHours", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-second-meal" className="text-xs">2nd meal required after (hrs)</Label>
                    <Input
                      id="break-second-meal"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={breakPolicy.secondMealAfterHours}
                      onChange={(e) => setBreakNum("secondMealAfterHours", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  California Labor Code § 512 requires a 30-minute unpaid meal period for shifts over 5 hours, and a second 30-minute meal period for shifts over 10 hours. Set threshold to 0 to disable.
                </p>
              </div>

              {/* Rest Break Rules */}
              <div className="rounded-lg border border-border/40 bg-muted/10 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-3.5 w-3.5 text-sky-500" />
                    <span className="text-xs font-semibold">Rest Breaks (&ldquo;Take {breakPolicy.restBreakMinutes}&rdquo;)</span>
                    <Badge
                      variant="outline"
                      className={
                        breakPolicy.restBreakPaid
                          ? "text-[10px] border-sky-500/30 bg-sky-500/10 text-sky-500"
                          : "text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-500"
                      }
                    >
                      {breakPolicy.restBreakPaid ? "Paid (included in payable hrs)" : "Unpaid (deducted from payable hrs)"}
                    </Badge>
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={breakPolicy.restBreakPaid}
                      onChange={(e) => updateBreakField("restBreakPaid", e.target.checked)}
                    />
                    Paid rest breaks
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-5">
                  <div>
                    <Label htmlFor="break-rest-mins" className="text-xs">Rest duration (min)</Label>
                    <Input
                      id="break-rest-mins"
                      type="number"
                      min={5}
                      max={60}
                      value={breakPolicy.restBreakMinutes}
                      onChange={(e) => setBreakNum("restBreakMinutes", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-max-rest" className="text-xs">Max per shift</Label>
                    <Input
                      id="break-max-rest"
                      type="number"
                      min={0}
                      max={10}
                      value={breakPolicy.maxRestBreaksPerShift}
                      onChange={(e) => setBreakNum("maxRestBreaksPerShift", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-first-rest" className="text-xs">1st rest after (hrs)</Label>
                    <Input
                      id="break-first-rest"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={breakPolicy.firstRestAfterHours}
                      onChange={(e) => setBreakNum("firstRestAfterHours", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-second-rest" className="text-xs">2nd rest after (hrs)</Label>
                    <Input
                      id="break-second-rest"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={breakPolicy.secondRestAfterHours}
                      onChange={(e) => setBreakNum("secondRestAfterHours", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="break-third-rest" className="text-xs">3rd rest after (hrs)</Label>
                    <Input
                      id="break-third-rest"
                      type="number"
                      step="0.5"
                      min={0}
                      max={24}
                      value={breakPolicy.thirdRestAfterHours}
                      onChange={(e) => setBreakNum("thirdRestAfterHours", e.target.value)}
                      className={`mt-1 ${tap}`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  California IWC Wage Orders authorize one paid 10-minute rest period per 4 hours worked (or major fraction thereof): 1st after 3.5h, 2nd after 6h, 3rd after 10h.
                </p>
              </div>

              <Button onClick={handleSaveBreaks} disabled={savingBreaks} className={`gap-1.5 ${tap}`}>
                {savingBreaks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save break policy
              </Button>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
