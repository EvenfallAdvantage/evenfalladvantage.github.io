"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, Plus, Loader2, Lock, ChevronDown, ChevronUp, UserX } from "lucide-react";
import { getIncidentStatements, type IncidentStatement } from "@/lib/supabase/db";
import { StatementSheet } from "@/components/incidents/statement-sheet";
import { roleLabel, ATTESTATION } from "@/lib/statements/statement";

export function IncidentStatements({ incidentId, companyId }: { incidentId: string; companyId: string }) {
  const [rows, setRows] = useState<IncidentStatement[] | null | undefined>(undefined);
  const [taking, setTaking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(() => { getIncidentStatements(incidentId).then(setRows); }, [incidentId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-2" data-testid="statements">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><FileSignature className="h-3 w-3" /> Statements ({rows?.length ?? 0})</p>
        {rows !== null && (
          <button type="button" onClick={() => setTaking(true)} style={{ minHeight: 44 }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium">
            <Plus className="h-4 w-4" />Take statement
          </button>
        )}
      </div>
      {rows === undefined ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : rows === null ? <p className="text-[11px] text-muted-foreground/70">Statements aren&apos;t enabled for this workspace yet.</p>
        : rows.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No statements yet.</p>
        : (
          <div className="space-y-1.5">
            {rows.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/30 bg-background/50" data-testid="statement-item">
                <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left" style={{ minHeight: 44 }} aria-expanded={open === s.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{s.full_name} <span className="text-muted-foreground">· {roleLabel(s.person_role)}</span></p>
                    <p className="text-[10px] text-muted-foreground">{new Date(s.taken_at).toLocaleString()} · taken by {s.users ? `${s.users.first_name ?? ""} ${s.users.last_name ?? ""}`.trim() : "—"}</p>
                  </div>
                  {s.declined ? <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400"><UserX className="h-3 w-3" />Declined</span>
                    : s.signed_at ? <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400"><Lock className="h-3 w-3" />Signed</span>
                    : <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Unsigned</span>}
                  {open === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {open === s.id && (
                  <div className="space-y-2 border-t border-border/30 px-3 py-2 text-xs" data-testid="statement-detail">
                    {(s.phone || s.email || s.address) && <p className="text-muted-foreground">{[s.phone, s.email, s.address].filter(Boolean).join(" · ")}</p>}
                    {s.statement && <p className="whitespace-pre-wrap leading-relaxed">{s.statement}</p>}
                    {s.signature_png && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">{ATTESTATION}</p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.signature_png} alt={`Signature of ${s.full_name}`} className="mt-1 h-20 rounded border border-border bg-white" />
                        <p className="text-[10px] text-muted-foreground">Signed {new Date(s.signed_at).toLocaleString()} (server time)</p>
                      </div>
                    )}
                    {s.statement_sha256 && <p className="break-all font-mono text-[10px] text-muted-foreground">SHA-256 {s.statement_sha256}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      {taking && <StatementSheet incidentId={incidentId} companyId={companyId} onClose={() => setTaking(false)} onSaved={() => { setTaking(false); load(); }} />}
    </div>
  );
}
