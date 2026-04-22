"use client";

import { useState, useEffect } from "react";
import { Wand2, Plus, Trash2, Loader2, Calendar, Clock, Users, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createShiftTemplate, getEventShiftTemplates, deleteShiftTemplate,
  generateShiftsFromTemplates, smartFillShifts,
  type ShiftTemplate, type Recurrence, type FillResult,
} from "@/lib/supabase/db";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
];

interface AutoSchedulePanelProps {
  eventId: string;
  companyId: string;
  startDate: string;
  endDate: string;
  onShiftsChanged: () => void;
}

export function AutoSchedulePanel({ eventId, companyId, startDate, endDate, onShiftsChanged }: AutoSchedulePanelProps) {
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showFillResults, setShowFillResults] = useState(false);
  const [fillResults, setFillResults] = useState<FillResult[]>([]);

  // Create form
  const [role, setRole] = useState("Security");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [recurrence, setRecurrence] = useState<Recurrence>("weekly");
  const [minStaff, setMinStaff] = useState(1);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filling, setFilling] = useState(false);

  const { confirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    getEventShiftTemplates(eventId).then(t => { setTemplates(t); setLoading(false); });
  }, [eventId]);

  async function handleCreate() {
    if (!role.trim() || !startTime || !endTime) return;
    setCreating(true);
    try {
      const id = await createShiftTemplate({
        eventId, companyId, role: role.trim(), startTime, endTime,
        daysOfWeek: selectedDays, recurrence, requiredCerts: [], minStaff,
      });
      if (id) {
        toast.success("Shift template created");
        setTemplates(await getEventShiftTemplates(eventId));
        setShowCreate(false);
        setRole("Security"); setStartTime("06:00"); setEndTime("14:00");
        setSelectedDays([1, 2, 3, 4, 5]); setMinStaff(1);
      }
    } catch { toast.error("Failed to create template"); }
    finally { setCreating(false); }
  }

  async function handleDelete(templateId: string) {
    if (!await confirm({ description: "Delete this shift template?", variant: "destructive", confirmLabel: "Delete" })) return;
    await deleteShiftTemplate(templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    toast.success("Template deleted");
  }

  async function handleGenerate() {
    if (templates.length === 0) { toast.error("Create templates first"); return; }
    setGenerating(true);
    try {
      const result = await generateShiftsFromTemplates(eventId, startDate, endDate);
      toast.success(`${result.created} shifts created (${result.skipped} duplicates skipped)`);
      onShiftsChanged();
    } catch { toast.error("Failed to generate shifts"); }
    finally { setGenerating(false); }
  }

  async function handleSmartFill() {
    setFilling(true);
    try {
      const results = await smartFillShifts(eventId, companyId, { dryRun: false });
      setFillResults(results);
      setShowFillResults(true);
      const assigned = results.filter(r => r.assigned).length;
      toast.success(`${assigned}/${results.length} shifts auto-assigned`);
      onShiftsChanged();
    } catch { toast.error("Smart fill failed"); }
    finally { setFilling(false); }
  }

  return (
    <>
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wand2 className="h-3.5 w-3.5" /> Auto-Schedule
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
              onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Cancel" : <><Plus className="h-3 w-3" /> Template</>}
            </Button>
          </div>
        </div>

        {/* Template creation form */}
        {showCreate && (
          <div className="space-y-3 rounded-lg border border-border/30 bg-background/50 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="tmpl-role" className="text-[10px]">Role</Label>
                <Input id="tmpl-role" value={role} onChange={e => setRole(e.target.value)} className="mt-1 h-8 text-xs" placeholder="Security" />
              </div>
              <div>
                <Label htmlFor="tmpl-start" className="text-[10px]">Start Time</Label>
                <Input id="tmpl-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
              <div>
                <Label htmlFor="tmpl-end" className="text-[10px]">End Time</Label>
                <Input id="tmpl-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 h-8 text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-[10px]">Days</Label>
              <div className="flex gap-1 mt-1">
                {DAYS.map((d, i) => (
                  <button key={i} type="button"
                    onClick={() => setSelectedDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                    className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                      selectedDays.includes(i) ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="tmpl-recurrence" className="text-[10px]">Recurrence</Label>
                <select id="tmpl-recurrence" value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}
                  className="mt-1 h-8 w-full rounded border border-border/40 bg-background px-2 text-xs">
                  {RECURRENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="tmpl-staff" className="text-[10px]">Min Staff</Label>
                <Input id="tmpl-staff" type="number" min={1} max={50} value={minStaff} onChange={e => setMinStaff(parseInt(e.target.value) || 1)} className="mt-1 h-8 text-xs" />
              </div>
              <div className="flex items-end">
                <Button size="sm" className="gap-1.5 w-full h-8 text-xs" onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Existing templates */}
        {loading ? (
          <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/60 text-center py-2">No shift templates yet. Create one to auto-generate shifts.</p>
        ) : (
          <div className="space-y-1.5">
            {templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/50 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{t.role} — {t.startTime}–{t.endTime}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.daysOfWeek.map(d => DAYS[d]).join(", ")} · {t.recurrence} · {t.minStaff} staff
                  </p>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-muted-foreground/40 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {templates.length > 0 && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs flex-1"
              onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
              Generate Shifts
            </Button>
            <Button size="sm" className="gap-1.5 text-xs flex-1"
              onClick={handleSmartFill} disabled={filling}>
              {filling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Smart Fill
            </Button>
          </div>
        )}

        {/* Smart fill results */}
        {showFillResults && fillResults.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground">Fill Results</p>
              <button onClick={() => setShowFillResults(false)} className="text-[10px] text-muted-foreground hover:text-foreground">Hide</button>
            </div>
            {fillResults.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] rounded-lg bg-muted/30 px-2.5 py-1.5">
                {r.assigned ? (
                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="flex-1 truncate">{r.reason}</span>
                {r.assigned && (
                  <Badge variant="outline" className="text-[8px]">Score: {r.assigned.score}</Badge>
                )}
              </div>
            ))}
            {fillResults.length > 10 && (
              <p className="text-[9px] text-muted-foreground text-center">+{fillResults.length - 10} more results</p>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </>
  );
}
