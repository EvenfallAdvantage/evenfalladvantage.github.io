"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, ArrowUpRight, ArrowDownLeft, Loader2, Plus, X, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getRadioLogs, logRadioActivity, getRadioFrequencies } from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";

type LogEntry = {
  id: string;
  direction: string;
  mode: string | null;
  content: string | null;
  signal_strength: number | null;
  logged_at: string;
};

type Freq = { id: string; name: string; frequency: number };

export function RadioLogPanel() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [freqs, setFreqs] = useState<Freq[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ frequencyId: "", direction: "rx", mode: "FM", content: "", signalStrength: "" });

  const loadLogs = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const data = await getRadioLogs(activeCompanyId, 100);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleAdd() {
    if (!activeCompanyId || !form.content) return;
    setSaving(true);
    try {
      await logRadioActivity({
        companyId: activeCompanyId,
        frequencyId: form.frequencyId || undefined,
        direction: form.direction,
        mode: form.mode,
        content: form.content,
        signalStrength: form.signalStrength ? parseFloat(form.signalStrength) : undefined,
      });
      setShowAdd(false);
      setForm({ frequencyId: "", direction: "rx", mode: "FM", content: "", signalStrength: "" });
      await loadLogs();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function openAdd() {
    if (!activeCompanyId) return;
    getRadioFrequencies(activeCompanyId).then(setFreqs).catch(() => {});
    setShowAdd(true);
  }

  const selectedFreq = form.frequencyId ? freqs.find((f) => f.id === form.frequencyId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <span className="text-xs font-medium text-muted-foreground">
          {logs.length} transmission{logs.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={openAdd}>
          <Plus className="h-3 w-3" /> Log Activity
        </Button>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No radio activity logged</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Log transmissions manually, or connect a radio bridge for auto-logging.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {logs.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                {entry.direction === "tx" ? (
                  <ArrowUpRight className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <ArrowDownLeft className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${entry.direction === "tx" ? "text-emerald-600 border-emerald-500/30" : "text-blue-600 border-blue-500/30"}`}>
                      {entry.direction === "tx" ? "TX" : "RX"}
                    </Badge>
                    {entry.mode && (
                      <span className="text-[10px] font-mono text-muted-foreground">{entry.mode}</span>
                    )}
                  </div>
                  {entry.content && (
                    <p className="text-xs mt-0.5">{entry.content}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {new Date(entry.logged_at).toLocaleString()}
                    {entry.signal_strength != null && (
                      <span className="ml-2">Signal: {entry.signal_strength}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add log modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Log Radio Activity</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Direction</label>
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                    <option value="rx">Receive (RX)</option>
                    <option value="tx">Transmit (TX)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Mode</label>
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                    <option value="FM">FM</option>
                    <option value="NFM">NFM</option>
                    <option value="AM">AM</option>
                    <option value="P25">P25</option>
                    <option value="DMR">DMR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Frequency</label>
                <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.frequencyId} onChange={(e) => setForm({ ...form, frequencyId: e.target.value })}>
                  <option value="">Unknown / Not listed</option>
                  {freqs.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.frequency.toFixed(4)} MHz)</option>
                  ))}
                </select>
                {selectedFreq && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {selectedFreq.frequency.toFixed(4)} MHz
                  </p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Content / Notes</label>
                <Input className="h-8 text-xs mt-0.5" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="What was transmitted or received?" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Signal Strength</label>
                <Input className="h-8 text-xs mt-0.5" value={form.signalStrength} onChange={(e) => setForm({ ...form, signalStrength: e.target.value })} placeholder="e.g. -85 dBm (optional)" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAdd} disabled={saving || !form.content}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                <Save className="h-3 w-3" /> Log
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
