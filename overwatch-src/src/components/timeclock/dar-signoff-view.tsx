"use client";

import { useEffect, useState } from "react";
import { FileSignature, Loader2 } from "lucide-react";
import { getDarSignoff, type DarSignoff } from "@/lib/supabase/db-dar";

/**
 * The signed Daily Activity Report for one timesheet: signed name, time and
 * the officer's summary. Renders nothing when the shift has no sign-off (or
 * RLS hides it from this viewer).
 */
export function DarSignoffView({ timesheetId, showEmpty = false }: { timesheetId: string; showEmpty?: boolean }) {
  const [state, setState] = useState<{ id: string; loading: boolean; signoff: DarSignoff | null }>({ id: timesheetId, loading: true, signoff: null });
  if (state.id !== timesheetId) setState({ id: timesheetId, loading: true, signoff: null });

  useEffect(() => {
    let alive = true;
    getDarSignoff(timesheetId)
      .then((s) => { if (alive) setState({ id: timesheetId, loading: false, signoff: s }); })
      .catch(() => { if (alive) setState({ id: timesheetId, loading: false, signoff: null }); });
    return () => { alive = false; };
  }, [timesheetId]);

  if (state.loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading shift notes…</div>;
  const s = state.signoff;
  if (!s) return showEmpty ? <p className="text-xs text-muted-foreground">No shift notes yet.</p> : null;
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm" data-testid="dar-signoff">
      <div className="flex items-center gap-1.5 font-medium text-emerald-500">
        <FileSignature className="h-4 w-4" /> Shift Notes
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Signed by <span className="font-medium text-foreground">{s.signedName}</span> · {new Date(s.signedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
      </p>
      {s.summary ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 text-xs">{s.summary}</p>
      ) : (
        <p className="mt-2 text-xs italic text-muted-foreground">No notes written.</p>
      )}
    </div>
  );
}
