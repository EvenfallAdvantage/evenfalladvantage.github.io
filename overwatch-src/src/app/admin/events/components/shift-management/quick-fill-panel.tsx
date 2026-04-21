"use client";

import { useState } from "react";
import { Plus, Loader2, Zap, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getEventShifts, createShift } from "@/lib/supabase/db";
import { type Shift, PATTERNS, toISO, pad2 } from "../shared";

interface QuickFillPanelProps {
  eventId: string;
  opDays: string[];
  eventTimezone?: string;
  onShiftsChange: (shifts: Shift[]) => void;
  onClose: () => void;
}

export function QuickFillPanel({
  eventId,
  opDays,
  eventTimezone,
  onShiftsChange,
  onClose,
}: QuickFillPanelProps) {
  /* ── Quick Fill state ── */
  const [posts, setPosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [pattern, setPattern] = useState<"8" | "12">("8");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const previewCount = posts.length * (pattern === "8" ? 3 : 2) * selectedDays.size;

  async function handleGenerate() {
    if (posts.length === 0 || selectedDays.size === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      const pat = PATTERNS[pattern];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of pat) {
          for (const post of posts) {
            batch.push({ eventId, role: `${post} — ${p.label}`, startTime: toISO(day, p.sH, p.sM, false, eventTimezone), endTime: toISO(day, p.eH, p.eM, p.overnight, eventTimezone) });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) { await Promise.all(batch.slice(i, i + 5).map(s => createShift(s))); }
      onShiftsChange(await getEventShifts(eventId));
      setPosts([]); setSelectedDays(new Set()); onClose();
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  }

  function addPost() { if (!newPost.trim() || posts.includes(newPost.trim())) return; setPosts([...posts, newPost.trim()]); setNewPost(""); }
  function toggleDay(d: string) { const n = new Set(selectedDays); if (n.has(d)) n.delete(d); else n.add(d); setSelectedDays(n); }

  return (
    <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posts / Positions</label>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {posts.map(p => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs pr-1">
              {p}
              <button onClick={() => setPosts(posts.filter(x => x !== p))} className="hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          ))}
          <div className="flex gap-1">
            <Input value={newPost} onChange={(e) => setNewPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPost()} placeholder="e.g. Front Gate" className="h-6 w-32 text-xs" />
            <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={addPost} disabled={!newPost.trim()}><Plus className="h-3 w-3" /></Button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shift Pattern</label>
        <div className="flex gap-2 mt-1">
          {(["8", "12"] as const).map(p => (
            <button key={p} onClick={() => setPattern(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pattern === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
              {p === "8" ? "8-Hour (Day / Swing / Night)" : "12-Hour (Day / Night)"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 mt-1.5">{PATTERNS[pattern].map(p => <span key={p.label} className="text-[10px] text-muted-foreground font-mono">{p.label}: {pad2(p.sH)}{pad2(p.sM)}–{pad2(p.eH)}{pad2(p.eM)}</span>)}</div>
      </div>
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
            return (<button key={day} onClick={() => toggleDay(day)} className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>{sel && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{lbl}</button>);
          })}
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={posts.length === 0 || selectedDays.size === 0 || generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate {previewCount} Shift{previewCount !== 1 ? "s" : ""}
        </Button>
        {previewCount > 0 && <span className="text-[10px] text-muted-foreground font-mono">{posts.length} post{posts.length > 1 ? "s" : ""} × {pattern === "8" ? "3" : "2"} periods × {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}
