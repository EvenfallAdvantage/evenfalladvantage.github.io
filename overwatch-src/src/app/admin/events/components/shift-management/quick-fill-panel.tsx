"use client";

import { useState } from "react";
import { Plus, Loader2, Zap, Check, X, Pencil, Moon, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getEventShifts, createShift } from "@/lib/supabase/db";
import { type Shift, type ShiftPeriod, PATTERNS, toISO, pad2, isOvernight, parseHHMM } from "../shared";

interface QuickFillPanelProps {
  eventId: string;
  opDays: string[];
  eventTimezone?: string;
  onShiftsChange: (shifts: Shift[]) => void;
  onClose: () => void;
}

type PresetKey = "8" | "12" | "custom";

const PRESET_META: Record<PresetKey, { label: string }> = {
  "8": { label: "8-Hour (Day / Swing / Night)" },
  "12": { label: "12-Hour (Day / Night)" },
  custom: { label: "Custom" },
};

function clonePattern(key: "8" | "12"): ShiftPeriod[] {
  return PATTERNS[key].map(p => ({ ...p }));
}

function formatTime(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`;
}

export function QuickFillPanel({
  eventId,
  opDays,
  eventTimezone,
  onShiftsChange,
  onClose,
}: QuickFillPanelProps) {
  /* ── State ── */
  const [posts, setPosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [presetKey, setPresetKey] = useState<PresetKey>("8");
  const [periods, setPeriods] = useState<ShiftPeriod[]>(() => clonePattern("8"));
  const [editing, setEditing] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const validPeriods = periods.filter(p => p.label.trim().length > 0);
  const previewCount = posts.length * validPeriods.length * selectedDays.size;

  /* ── Preset / period management ── */
  function selectPreset(key: PresetKey) {
    setPresetKey(key);
    if (key === "8" || key === "12") {
      setPeriods(clonePattern(key));
    } else if (periods.length === 0) {
      // Seed Custom with a single blank row so the user has something to edit
      setPeriods([{ label: "Shift A", sH: 8, sM: 0, eH: 16, eM: 0, overnight: false }]);
    }
  }

  function updatePeriod(idx: number, patch: Partial<ShiftPeriod>) {
    setPeriods(prev => {
      const next = prev.map((p, i) => (i === idx ? { ...p, ...patch } : p));
      // Auto-recompute overnight whenever times change
      const target = next[idx];
      next[idx] = { ...target, overnight: isOvernight(target.sH, target.sM, target.eH, target.eM) };
      return next;
    });
    setPresetKey("custom");
  }

  function updatePeriodTime(idx: number, field: "start" | "end", value: string) {
    const parsed = parseHHMM(value);
    if (!parsed) return; // ignore invalid intermediate input (the <input type="time"> already constrains it)
    if (field === "start") {
      updatePeriod(idx, { sH: parsed.h, sM: parsed.m });
    } else {
      updatePeriod(idx, { eH: parsed.h, eM: parsed.m });
    }
  }

  function addPeriod() {
    const last = periods[periods.length - 1];
    const seed: ShiftPeriod = last
      ? { label: `Shift ${String.fromCharCode(65 + periods.length)}`, sH: last.eH, sM: last.eM, eH: (last.eH + 8) % 24, eM: last.eM, overnight: false }
      : { label: "Shift A", sH: 8, sM: 0, eH: 16, eM: 0, overnight: false };
    seed.overnight = isOvernight(seed.sH, seed.sM, seed.eH, seed.eM);
    setPeriods(prev => [...prev, seed]);
    setPresetKey("custom");
    setEditing(true);
  }

  function removePeriod(idx: number) {
    setPeriods(prev => prev.filter((_, i) => i !== idx));
    setPresetKey("custom");
  }

  function resetToPreset() {
    if (presetKey === "8" || presetKey === "12") {
      setPeriods(clonePattern(presetKey));
    } else {
      setPeriods(clonePattern("8"));
      setPresetKey("8");
    }
  }

  /* ── Generate ── */
  async function handleGenerate() {
    if (posts.length === 0 || selectedDays.size === 0 || validPeriods.length === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of validPeriods) {
          for (const post of posts) {
            batch.push({
              eventId,
              role: `${post} — ${p.label.trim()}`,
              startTime: toISO(day, p.sH, p.sM, false, eventTimezone),
              endTime: toISO(day, p.eH, p.eM, p.overnight, eventTimezone),
            });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) {
        await Promise.all(batch.slice(i, i + 5).map(s => createShift(s)));
      }
      onShiftsChange(await getEventShifts(eventId));
      setPosts([]);
      setSelectedDays(new Set());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  function addPost() {
    if (!newPost.trim() || posts.includes(newPost.trim())) return;
    setPosts([...posts, newPost.trim()]);
    setNewPost("");
  }

  function toggleDay(d: string) {
    const n = new Set(selectedDays);
    if (n.has(d)) n.delete(d);
    else n.add(d);
    setSelectedDays(n);
  }

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
      {/* Posts */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posts / Positions</label>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {posts.map(p => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs pr-1">
              {p}
              <button onClick={() => setPosts(posts.filter(x => x !== p))} className="hover:text-red-400" aria-label={`Remove ${p}`}><X className="h-2.5 w-2.5" /></button>
            </Badge>
          ))}
          <div className="flex gap-1">
            <Input value={newPost} onChange={(e) => setNewPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPost()} placeholder="e.g. Front Gate" className="h-6 w-32 text-xs" />
            <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={addPost} disabled={!newPost.trim()} aria-label="Add post"><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>

      {/* Shift Pattern */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shift Pattern</label>
          <div className="flex items-center gap-2">
            {editing && (presetKey === "8" || presetKey === "12") && (
              <button onClick={resetToPreset} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1" title="Reset to preset defaults">
                <RotateCcw className="h-2.5 w-2.5" /> Reset
              </button>
            )}
            <button
              onClick={() => setEditing(v => !v)}
              className={`text-[10px] inline-flex items-center gap-1 ${editing ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-pressed={editing}
            >
              <Pencil className="h-2.5 w-2.5" /> {editing ? "Done editing" : "Edit pattern"}
            </button>
          </div>
        </div>

        {/* Preset chips */}
        <div className="flex flex-wrap gap-2 mt-1">
          {(Object.keys(PRESET_META) as PresetKey[]).map(key => {
            const active = presetKey === key;
            return (
              <button
                key={key}
                onClick={() => selectPreset(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}
              >
                {PRESET_META[key].label}
              </button>
            );
          })}
        </div>

        {/* Compact preview (not editing) */}
        {!editing && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
            {validPeriods.length === 0 ? (
              <span className="text-[10px] text-muted-foreground italic">No periods — click &ldquo;Edit pattern&rdquo; to add some.</span>
            ) : (
              validPeriods.map((p, i) => (
                <span key={`${p.label}-${i}`} className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-1">
                  {p.label}: {pad2(p.sH)}{pad2(p.sM)}–{pad2(p.eH)}{pad2(p.eM)}
                  {p.overnight && <Moon className="h-2.5 w-2.5 text-primary/70" aria-label="overnight" />}
                </span>
              ))
            )}
          </div>
        )}

        {/* Editable rows */}
        {editing && (
          <div className="mt-2 space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2">
            {periods.length === 0 && (
              <p className="text-[10px] text-muted-foreground italic px-1">No periods yet — add one below.</p>
            )}
            {periods.map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                <Input
                  value={p.label}
                  onChange={(e) => updatePeriod(idx, { label: e.target.value })}
                  placeholder="Label (e.g. Day)"
                  className="h-7 text-xs flex-1 min-w-[8rem]"
                  aria-label={`Period ${idx + 1} label`}
                />
                <Input
                  type="time"
                  step={300}
                  value={formatTime(p.sH, p.sM)}
                  onChange={(e) => updatePeriodTime(idx, "start", e.target.value)}
                  className="h-7 text-xs w-[7rem] font-mono"
                  aria-label={`Period ${idx + 1} start time`}
                />
                <span className="text-[10px] text-muted-foreground">to</span>
                <Input
                  type="time"
                  step={300}
                  value={formatTime(p.eH, p.eM)}
                  onChange={(e) => updatePeriodTime(idx, "end", e.target.value)}
                  className="h-7 text-xs w-[7rem] font-mono"
                  aria-label={`Period ${idx + 1} end time`}
                />
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded ${p.overnight ? "text-primary bg-primary/10" : "text-muted-foreground/50"}`}
                  title={p.overnight ? "Crosses midnight (next day)" : "Same day"}
                >
                  <Moon className="h-2.5 w-2.5" /> {p.overnight ? "+1d" : "—"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => removePeriod(idx)}
                  aria-label={`Remove period ${idx + 1}`}
                  disabled={periods.length <= 1}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs mt-1" onClick={addPeriod}>
              <Plus className="h-3 w-3" /> Add period
            </Button>
          </div>
        )}
      </div>

      {/* Coverage Days */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coverage Days</label>
          <button onClick={() => setSelectedDays(new Set(opDays))} className="text-[10px] text-primary hover:underline">Select All</button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {opDays.map(day => {
            const d = new Date(day + "T12:00:00");
            const lbl = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
            const sel = selectedDays.has(day);
            return (
              <button key={day} onClick={() => toggleDay(day)} className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                {sel && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{lbl}
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={posts.length === 0 || selectedDays.size === 0 || validPeriods.length === 0 || generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate {previewCount} Shift{previewCount !== 1 ? "s" : ""}
        </Button>
        {previewCount > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {posts.length} post{posts.length > 1 ? "s" : ""} × {validPeriods.length} period{validPeriods.length > 1 ? "s" : ""} × {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
