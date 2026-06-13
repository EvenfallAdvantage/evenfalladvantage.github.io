"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Trash2, Save, X, Activity, Loader2, Radio } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getRadioFrequencies, createRadioFrequency, updateRadioFrequency,
  deleteRadioFrequency, getActiveRadioStates, logRadioActivity,
} from "@/lib/supabase/db";
import { useAuthStore } from "@/stores/auth-store";
import { useSdrStore } from "@/stores/sdr-store";
import { STATE_LAWS } from "@/lib/state-laws-data";

type Freq = {
  id: string;
  name: string;
  frequency: number;
  mode: string;
  band: string | null;
  ctcss_dcs: string | null;
  description: string | null;
  category: string;
  state: string | null;
  city: string | null;
  priority: number;
  is_reference: boolean;
};

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "state_police", label: "State Police" },
  { key: "city_pd", label: "City PD" },
  { key: "sheriff", label: "Sheriff" },
  { key: "fire", label: "Fire" },
  { key: "ems", label: "EMS" },
  { key: "federal", label: "Federal" },
  { key: "interop", label: "Interop" },
  { key: "emergency_management", label: "OEM" },
  { key: "custom", label: "Custom" },
];

const MODE_COLORS: Record<string, string> = {
  FM: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  NFM: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  P25: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  DMR: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  AM: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

const BAND_COLORS: Record<string, string> = {
  "VHF-Lo": "bg-red-500/10 text-red-600",
  "VHF-Hi": "bg-green-500/10 text-green-600",
  UHF: "bg-blue-500/10 text-blue-600",
  "700": "bg-violet-500/10 text-violet-600",
  "800": "bg-orange-500/10 text-orange-600",
  "900": "bg-pink-500/10 text-pink-600",
};

export function ScannerTab() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [freqs, setFreqs] = useState<Freq[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", frequency: "", mode: "FM", band: "", ctcss_dcs: "", description: "", category: "custom", state: "", city: "" });

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      const states = await getActiveRadioStates(activeCompanyId);
      if (states.length > 0) setSelectedState(states[0]);
    })();
  }, [activeCompanyId]);

  const loadFreqs = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const data = await getRadioFrequencies(activeCompanyId, selectedState || undefined, category || undefined);
      setFreqs(data);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, selectedState, category]);

  useEffect(() => { loadFreqs(); }, [loadFreqs]);

  const filtered = freqs.filter((f) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.frequency.toString().includes(q);
  });

  async function handleSave() {
    if (!activeCompanyId || !form.name || !form.frequency) return;
    setSaving(true);
    try {
      if (editId) {
        await updateRadioFrequency(editId, {
          name: form.name,
          frequency: parseFloat(form.frequency),
          mode: form.mode,
          band: form.band || null,
          ctcss_dcs: form.ctcss_dcs || null,
          description: form.description || null,
          category: form.category,
          state: form.state || null,
          city: form.city || null,
        });
      } else {
        await createRadioFrequency({
          companyId: activeCompanyId,
          name: form.name,
          frequency: parseFloat(form.frequency),
          mode: form.mode,
          band: form.band || undefined,
          ctcss_dcs: form.ctcss_dcs || undefined,
          description: form.description || undefined,
          category: form.category,
          state: form.state || undefined,
          city: form.city || undefined,
        });
      }
      setShowAdd(false);
      setEditId(null);
      resetForm();
      await loadFreqs();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  function resetForm() {
    setForm({ name: "", frequency: "", mode: "FM", band: "", ctcss_dcs: "", description: "", category: "custom", state: "", city: "" });
  }

  function startEdit(f: Freq) {
    if (f.is_reference) return;
    setEditId(f.id);
    setForm({
      name: f.name,
      frequency: f.frequency.toString(),
      mode: f.mode,
      band: f.band ?? "",
      ctcss_dcs: f.ctcss_dcs ?? "",
      description: f.description ?? "",
      category: f.category,
      state: f.state ?? "",
      city: f.city ?? "",
    });
    setShowAdd(true);
  }

  async function handleDelete(id: string) {
    try {
      await deleteRadioFrequency(id);
      await loadFreqs();
    } catch (err) { console.error(err); }
  }

  async function handleQuickLog(freqId: string) {
    if (!activeCompanyId) return;
    try {
      await logRadioActivity({
        companyId: activeCompanyId,
        frequencyId: freqId,
        direction: "rx",
        content: "Active monitoring",
      });
    } catch (err) { console.error(err); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search frequency or name..."
            className="pl-8 h-8 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-8 rounded-md border border-border/40 bg-background px-2 text-xs"
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
        >
          <option value="">All States</option>
          {STATE_LAWS.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-xs"
          onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 px-4 py-2 border-b border-border/10 overflow-x-auto">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${
              category === c.key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Frequency list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Radio className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {freqs.length === 0 ? "No frequencies configured yet" : "No matches found"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {freqs.length === 0 ? "Select a state above or add custom frequencies." : "Try a different search or filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            {filtered.map((f) => (
              <div key={f.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate">{f.name}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${MODE_COLORS[f.mode] ?? ""}`}>
                      {f.mode}
                    </Badge>
                    {f.band && (
                      <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${BAND_COLORS[f.band] ?? ""}`}>
                        {f.band}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-primary">
                      {f.frequency.toFixed(4)} MHz
                    </span>
                    {f.ctcss_dcs && (
                      <span className="text-[10px] text-muted-foreground">Tone: {f.ctcss_dcs}</span>
                    )}
                    {f.city && (
                      <span className="text-[10px] text-muted-foreground">{f.city}</span>
                    )}
                  </div>
                  {f.description && (
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{f.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      useSdrStore.getState().setFrequency(f.frequency * 1_000_000);
                      useSdrStore.getState().setMode(f.mode.toLowerCase() === "nfm" ? "nfm" : "fm");
                    }}
                    className="rounded p-1 text-muted-foreground hover:text-primary"
                    title="Tune SDR to this frequency"
                  >
                    <Radio className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleQuickLog(f.id)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground"
                    title="Log activity on this frequency"
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </button>
                  {!f.is_reference && (
                    <>
                      <button onClick={() => startEdit(f)} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="rounded p-1 text-muted-foreground hover:text-red-500" title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">{editId ? "Edit Frequency" : "Add Frequency"}</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Name *</label>
                <Input className="h-8 text-xs mt-0.5" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. LAPD Metro Dispatch" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Frequency (MHz) *</label>
                  <Input className="h-8 text-xs mt-0.5" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. 484.5875" />
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Band</label>
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.band} onChange={(e) => setForm({ ...form, band: e.target.value })}>
                    <option value="">Auto</option>
                    <option value="VHF-Lo">VHF-Lo</option>
                    <option value="VHF-Hi">VHF-Hi</option>
                    <option value="UHF">UHF</option>
                    <option value="700">700</option>
                    <option value="800">800</option>
                    <option value="900">900</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">CTCSS/DCS</label>
                  <Input className="h-8 text-xs mt-0.5" value={form.ctcss_dcs} onChange={(e) => setForm({ ...form, ctcss_dcs: e.target.value })} placeholder="e.g. 103.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Category</label>
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.filter(c => c.key).map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">State</label>
                  <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs mt-0.5" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    <option value="">None</option>
                    {STATE_LAWS.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">City</label>
                <Input className="h-8 text-xs mt-0.5" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Los Angeles" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Description</label>
                <Input className="h-8 text-xs mt-0.5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSave} disabled={saving || !form.name || !form.frequency}>
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                <Save className="h-3 w-3" /> {editId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
