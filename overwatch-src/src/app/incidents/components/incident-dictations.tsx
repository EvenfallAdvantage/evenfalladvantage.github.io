"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { getIncidentDictations, type LinkedDictation } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";

/** Dictation transcripts linked to this incident from the Dictate page. */
export function IncidentDictations({ incidentId, companyId }: { incidentId: string; companyId: string }) {
  const [rows, setRows] = useState<LinkedDictation[] | undefined>(undefined);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    getIncidentDictations(companyId, incidentId).then((r) => { if (live) setRows(r); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [companyId, incidentId]);

  return (
    <div className="space-y-2" data-testid="incident-dictations">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Mic className="h-3 w-3" /> Dictations ({rows?.length ?? 0})</p>
        <Link href="/dictate" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium" style={{ minHeight: 44 }}>
          <Mic className="h-4 w-4" />Dictate
        </Link>
      </div>
      {rows === undefined ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : rows.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No dictations linked. On the Dictate page, pick this incident under &ldquo;Link to incident&rdquo;.</p>
        : (
          <div className="space-y-1.5">
            {rows.map((d) => (
              <div key={d.id} className="rounded-lg border border-border/30 bg-background/50" data-testid="dictation-item">
                <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left" style={{ minHeight: 44 }} aria-expanded={open === d.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{d.personName ?? d.personType ?? "Dictation"}{d.personName && d.personType ? <span className="text-muted-foreground"> · {d.personType}</span> : null}</p>
                    <p className="text-[10px] text-muted-foreground">{parseUTC(d.recordedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}{d.recordedBy ? ` · recorded by ${d.recordedBy}` : ""}</p>
                  </div>
                  {open === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open === d.id && (
                  <div className="space-y-1 border-t border-border/30 px-3 py-2 text-sm">
                    {d.segments
                      ? d.segments.map((s, i) => <p key={i}><span className="mr-1 text-xs font-semibold text-primary">Speaker {Number(s.speaker) + 1}:</span>{s.text}</p>)
                      : <p className="whitespace-pre-wrap">{d.transcript}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
