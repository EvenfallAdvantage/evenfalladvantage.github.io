"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Radio, Loader2, Check } from "lucide-react";
import { getUserRadioStates, setUserRadioStates } from "@/lib/supabase/db";
import { STATE_LAWS } from "@/lib/state-laws-data";

interface Props {
  activeCompanyId: string | null;
}

export function RadioStatesCard({ activeCompanyId }: Props) {
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) return;
    (async () => {
      try {
        const s = await getUserRadioStates(activeCompanyId);
        setStates(s);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [activeCompanyId]);

  async function toggle(code: string) {
    const next = states.includes(code)
      ? states.filter((c) => c !== code)
      : [...states, code];
    setStates(next);
    setSaving(true);
    try {
      await setUserRadioStates(activeCompanyId!, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          <span>Radio States</span>
          {(saving || saved) && (
            <span className="ml-auto">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : saved ? <Check className="h-3 w-3 text-green-500" /> : null}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</div>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {STATE_LAWS.map((s) => {
              const selected = states.includes(s.code);
              return (
                <button
                  key={s.code}
                  onClick={() => toggle(s.code)}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    selected
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted/30 text-muted-foreground border border-transparent hover:bg-muted/50"
                  }`}
                >
                  {s.code}
                </button>
              );
            })}
          </div>
        )}
        {states.length === 0 && !loading && (
          <p className="text-[10px] text-muted-foreground mt-1">No states selected. Falls back to company default.</p>
        )}
        {states.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">{states.length} state{states.length !== 1 ? "s" : ""} selected</p>
        )}
      </CardContent>
    </Card>
  );
}
