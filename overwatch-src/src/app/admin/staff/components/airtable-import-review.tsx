"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import {
  importReviewedAirtableApplicants,
  previewAirtableApplicants,
  type AirtableImportResult,
  type AirtablePreviewRecord,
} from "@/lib/services/airtable-service";

interface Props {
  companyId: string;
  /** Test hook. Production uses the confirm dialog. */
  confirmImport?: (count: number) => Promise<boolean>;
  onImported: () => void;
}

export function AirtableImportReview({ companyId, confirmImport, onImported }: Props) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [records, setRecords] = useState<AirtablePreviewRecord[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AirtableImportResult | null>(null);

  async function load() {
    setBusy(true);
    setResult(null);
    try {
      const preview = await previewAirtableApplicants(companyId);
      setRecords(preview.records);
      setTruncated(preview.truncated);
      setSelected(new Set(preview.records.filter((r) => r.email.includes("@")).map((r) => r.airtableId)));
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read Airtable");
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function commit() {
    const ids = records.filter((r) => selected.has(r.airtableId) && r.email.includes("@")).map((r) => r.airtableId);
    if (ids.length === 0) { toast.error("Select at least one record with an email"); return; }
    const ok = confirmImport
      ? await confirmImport(ids.length)
      : await confirm({
          title: "Import applicants?",
          description: `Create ${ids.length} applicant${ids.length === 1 ? "" : "s"} in this company. Records already imported, and emails that already belong to an applicant, are skipped. Airtable is not changed.`,
          confirmLabel: "Import",
        });
    if (!ok) return;
    setBusy(true);
    try {
      const imported = await importReviewedAirtableApplicants(companyId, ids);
      setResult(imported);
      if (imported.imported.length > 0) onImported();
      toast.success(`Imported ${imported.imported.length}. ${imported.emailConflicts.length} email conflict${imported.emailConflicts.length === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-testid="airtable-import">
      <Button size="sm" variant="outline" className="gap-1.5 text-xs" disabled={busy} onClick={() => void load()}>
        {busy && !open ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Review Airtable import
      </Button>
      {open && (
        <div className="mt-3 rounded-xl border border-border/50 bg-card p-4 space-y-2" data-testid="airtable-import-review">
          <p className="text-sm font-medium">Review before import</p>
          <p className="text-xs text-muted-foreground">
            One-way read of the first page{truncated ? " (more records exist and are not included)" : ""}. Nothing is written until you confirm.
          </p>
          <ul className="space-y-1">
            {records.map((row) => (
              <li key={row.airtableId} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label={`Import ${row.email || row.airtableId}`}
                  checked={selected.has(row.airtableId)}
                  disabled={!row.email.includes("@")}
                  onChange={() => toggle(row.airtableId)}
                />
                <span>{(row.firstName || row.lastName) ? `${row.firstName} ${row.lastName}`.trim() : "No name"}</span>
                <span className="text-muted-foreground">{row.email || "no email"}</span>
              </li>
            ))}
            {records.length === 0 && <li className="text-xs text-muted-foreground">No records on the first page.</li>}
          </ul>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" disabled={busy} onClick={() => void commit()}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import selected"}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(false)}>Close</Button>
          </div>
          {result && (
            <div className="text-xs space-y-1" data-testid="airtable-import-result">
              <p>Imported {result.imported.length}. Already imported {result.alreadyImported.length}.</p>
              {result.emailConflicts.length > 0 && (
                <p>Email already on an applicant, not duplicated: {result.emailConflicts.map((c) => c.email).join(", ")}</p>
              )}
              {result.skipped.length > 0 && <p>Skipped {result.skipped.length}.</p>}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
