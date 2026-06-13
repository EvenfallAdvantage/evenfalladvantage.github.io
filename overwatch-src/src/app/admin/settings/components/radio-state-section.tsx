"use client";

import { useState, useEffect } from "react";
import { Save, Loader2, Check, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCompanyRadioState, setCompanyRadioState } from "@/lib/supabase/db";
import { STATE_LAWS } from "@/lib/state-laws-data";

interface RadioStateSectionProps {
  companyId: string;
}

export default function RadioStateSection({ companyId }: RadioStateSectionProps) {
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const state = await getCompanyRadioState(companyId);
        setCurrentState(state);
        setSelectedState(state);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [companyId]);

  async function handleSave() {
    setSaving(true);
    try {
      await setCompanyRadioState(companyId, selectedState);
      setCurrentState(selectedState);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><Radio className="h-4 w-4" /> Radio State Default</h3>
            <p className="text-xs text-muted-foreground">Default frequency region for the radio scanner</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving || loading || selectedState === currentState}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3 text-green-500" /> : <Save className="h-3 w-3" />}
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
        ) : (
          <select
            value={selectedState ?? ""}
            onChange={(e) => setSelectedState(e.target.value || null)}
            className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm"
          >
            <option value="">None (no default)</option>
            {STATE_LAWS.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-muted-foreground">Users can override this in their profile. The scanner will use the user&apos;s selection if set.</p>
      </CardContent>
    </Card>
  );
}
