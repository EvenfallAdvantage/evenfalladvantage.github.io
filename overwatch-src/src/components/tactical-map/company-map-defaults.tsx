"use client";

/** Admin-only: company defaults for the Ops map (preset for new users, new panel on/off, hidden groups). */

import { useState } from "react";
import { ChevronDown, ChevronRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import { GROUPS, PRESET_IDS, PRESET_LABELS, type GroupId, type PresetId } from "@/lib/map/layer-registry";
import { saveCompanyMapDefaults, type CompanyMapDefaults } from "@/lib/supabase/db-map-prefs";

export function CompanyMapDefaultsEditor({ companyId, value, onSaved }: { companyId: string; value: CompanyMapDefaults; onSaved: (v: CompanyMapDefaults) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CompanyMapDefaults>(value);
  const [saving, setSaving] = useState(false);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) { setLastValue(value); setDraft(value); }

  async function save() {
    setSaving(true);
    const r = await saveCompanyMapDefaults(companyId, draft);
    setSaving(false);
    if (r.ok) { toast.success("Company map defaults saved"); onSaved({ ...draft, updatedAt: new Date().toISOString() }); }
    else toast.error(r.error ?? "Couldn't save company defaults");
  }

  const sel = "w-full rounded bg-white/5 border border-white/10 px-1.5 py-1 text-[11px] text-white";
  return (
    <div className="pt-1 border-t border-white/10">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-[9px] font-mono text-white/45 uppercase tracking-wider hover:text-white/80" aria-expanded={open}>
        <Building2 className="h-3 w-3" /><span className="flex-1 text-left">Company defaults (admin)</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 text-[11px] text-white/75">
          <label className="block">Desktop preset for new users
            <select className={sel} value={draft.defaultPreset} onChange={(e) => setDraft({ ...draft, defaultPreset: e.target.value as PresetId })}>
              {PRESET_IDS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="block">Phone preset for new users
            <select className={sel} value={draft.defaultPresetMobile} onChange={(e) => setDraft({ ...draft, defaultPresetMobile: e.target.value as PresetId })}>
              {PRESET_IDS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={draft.panelV2} onChange={() => setDraft({ ...draft, panelV2: !draft.panelV2 })} className="h-3 w-3" />
            New grouped layers panel for the company (users can still switch)
          </label>
          <div>
            <p className="text-[10px] text-white/50">Hide groups for everyone</p>
            {GROUPS.filter((g) => g.id !== "myOps").map((g) => (
              <label key={g.id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.hiddenGroups.includes(g.id)}
                  onChange={() => setDraft({ ...draft, hiddenGroups: draft.hiddenGroups.includes(g.id) ? draft.hiddenGroups.filter((x) => x !== g.id) : [...draft.hiddenGroups, g.id as GroupId] })}
                  className="h-3 w-3"
                />
                {g.label}
              </label>
            ))}
          </div>
          <button onClick={() => void save()} disabled={saving} className="w-full rounded px-2 py-1 text-[11px] font-bold text-black disabled:opacity-50" style={{ backgroundColor: "var(--brand-accent, #d59b3c)" }}>
            {saving ? "Saving…" : "Save company defaults"}
          </button>
        </div>
      )}
    </div>
  );
}
