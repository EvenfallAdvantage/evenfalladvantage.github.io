"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import {
  getAirtableFieldMapping,
  previewAirtableSync,
  saveAirtableFieldMapping,
  syncAirtablePurpose,
  type AirtableFieldBinding,
  type AirtableSchemaField,
  type AirtableSyncPreview,
} from "@/lib/services/airtable-service";
import {
  assessFieldMapping,
  destinationsFor,
  rosterConfirmDescription,
  suggestFieldMapping,
  type MappedPurpose,
  type RosterDiagnosticReport,
} from "@/lib/integrations/airtable-sync";
import { RosterSyncReport } from "@/components/integrations/roster-sync-report";

interface Props {
  companyId: string;
  purpose: MappedPurpose;
  baseId: string;
  tableId: string;
  fields: AirtableSchemaField[] | null;
  loading: boolean;
  tested: boolean;
  onLoadFields: () => void;
  onSynced: () => void;
}

export function AirtableFieldMap({ companyId, purpose, baseId, tableId, fields, loading, tested, onLoadFields, onSynced }: Props) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const dests = destinationsFor(purpose);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<AirtableSyncPreview | null>(null);
  const [syncedReport, setSyncedReport] = useState<RosterDiagnosticReport | null>(null);

  useEffect(() => {
    let cancel = false;
    setPreview(null);
    setConfirmedAt(null);
    setSavedIds({});
    setMappingLoaded(false);
    void getAirtableFieldMapping(companyId, purpose, baseId, tableId).then((row) => {
      if (cancel) return;
      const ids = Object.fromEntries(Object.entries(row.mapping).map(([key, binding]) => [key, binding.field_id]));
      setSavedIds(ids);
      setDraft(ids);
      setConfirmedAt(row.confirmedAt);
      setMappingLoaded(true);
    }).catch(() => {
      if (!cancel) {
        setSavedIds({});
        setDraft({});
        setConfirmedAt(null);
        setMappingLoaded(true);
      }
    });
    return () => { cancel = true; };
  }, [companyId, purpose, baseId, tableId]);

  useEffect(() => {
    if (!mappingLoaded || !fields || confirmedAt || Object.keys(savedIds).length > 0) return;
    setDraft(suggestFieldMapping(fields, purpose));
  }, [mappingLoaded, fields, purpose, confirmedAt, savedIds]);

  const mapping = useMemo(() => {
    const out: Record<string, AirtableFieldBinding> = {};
    if (!fields) return out;
    for (const dest of dests) {
      const field = fields.find((item) => item.id === draft[dest.key]);
      if (!field) continue;
      out[dest.key] = { field_id: field.id, name: field.name, type: field.type };
    }
    return out;
  }, [fields, draft, dests]);

  const assessment = fields ? assessFieldMapping(purpose, mapping, fields) : null;
  const suggestions = fields && !confirmedAt ? suggestFieldMapping(fields, purpose) : {};
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedIds);

  async function confirmMapping() {
    if (!assessment?.ok) { toast.error(assessment?.problems[0]?.message ?? "Mapping is incomplete"); return; }
    setBusy("save");
    try {
      const result = await saveAirtableFieldMapping(companyId, purpose, baseId, tableId, mapping);
      if (result.mappingProblems?.length) {
        setPreview(result);
        toast.error(result.mappingProblems[0]?.message ?? "Mapping was not saved");
        return;
      }
      const storedIds = Object.fromEntries(Object.entries(result.mapping ?? mapping).map(([key, binding]) => [key, binding.field_id]));
      setSavedIds(storedIds);
      setDraft(storedIds);
      setConfirmedAt(result.confirmed_at ?? new Date().toISOString());
      toast.success("Field mapping confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save mapping");
    } finally {
      setBusy(null);
    }
  }

  async function checkRecords() {
    setBusy("preview");
    setPreview(null);
    setSyncedReport(null);
    try {
      setPreview(await previewAirtableSync(companyId, purpose));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    if (!confirmedAt || dirty) { toast.error("Confirm the field mapping before syncing"); return; }
    const look = await previewAirtableSync(companyId, purpose);
    setPreview(look);
    const counts = look.counts ?? {};
    const ok = await confirm({
      title: purpose === "roster" ? "Sync roster from Airtable?" : "Sync operations from Airtable?",
      description: purpose === "roster"
        ? rosterConfirmDescription(counts, { truncated: look.truncated, removalHold: look.removalHold, read: look.read })
        : `Create ${counts.create ?? 0}, link ${counts.link ?? 0}, update ${counts.update ?? 0}. Conflicts ${counts.conflict ?? 0}, skipped ${counts.skipped ?? 0}. Missing Airtable rows stay in Overwatch. Owner and admin roles are not changed. Airtable is not written.`,
      confirmLabel: "Sync now",
    });
    if (!ok) return;
    setBusy("sync");
    try {
      const result = await syncAirtablePurpose(companyId, purpose, purpose === "roster" ? look.planToken : undefined);
      if (purpose === "roster") setSyncedReport(result.report ?? null);
      const failed = result.failed ? result.failed.create + result.failed.attach + result.failed.link + result.failed.update + result.failed.remove : result.errors.length;
      toast.success(purpose === "roster"
        ? `Read ${result.read?.rawRead ?? "?"} records. Created ${result.created}, linked ${result.linked ?? 0}, updated ${result.updated}, removed ${result.removed ?? 0}, write failures ${failed}.`
        : `Synced ${result.created} new, ${result.updated} updated${result.linked ? `, ${result.linked} linked` : ""}`);
      if (result.errors.length) toast.error(result.errors[0]?.message ?? "Some rows failed");
      onSynced();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2" data-testid={`airtable-fields-${purpose}`}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy || loading} onClick={onLoadFields}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load fields"}
        </Button>
        <Button type="button" size="sm" className="h-8 text-xs" disabled={!!busy || !assessment?.ok} onClick={() => void confirmMapping()}>
          {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm field mapping"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy || !tested || !assessment?.ok} onClick={() => void checkRecords()}>
          {busy === "preview" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check records"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy || !tested || !confirmedAt || dirty} onClick={() => void sync()}>
          {busy === "sync" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sync"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {confirmedAt && !dirty
          ? "This mapping is confirmed. Sync will not guess other columns or change roles."
          : "Same-name suggestions are only a starting point. Nothing is saved until you confirm the mapping."}
      </p>
      {!fields && <p className="text-[10px] text-muted-foreground">Load fields to map this table&apos;s actual columns.</p>}
      {fields && (
        <div className="space-y-1">
          {dests.map((dest) => {
            const compatible = fields.filter((field) => dest.accepts.includes(field.type));
            const suggested = suggestions[dest.key];
            return (
              <label key={dest.key} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="w-28">{dest.label}{dest.required ? " *" : ""}</span>
                <select
                  aria-label={`${purpose} ${dest.label} field`}
                  className="h-8 min-w-40 rounded border border-border/40 bg-background px-2 text-xs"
                  value={draft[dest.key] ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [dest.key]: e.target.value }))}
                >
                  <option value="">Not mapped</option>
                  {compatible.map((field) => <option key={field.id} value={field.id}>{field.name} ({field.type})</option>)}
                </select>
                {suggested && draft[dest.key] === suggested && !confirmedAt && <span className="text-[10px] text-muted-foreground">Suggested</span>}
              </label>
            );
          })}
        </div>
      )}
      {assessment && assessment.problems.length > 0 && (
        <ul className="text-[10px] text-amber-500 space-y-0.5" data-testid={`airtable-mapping-problems-${purpose}`}>
          {assessment.problems.map((problem) => <li key={`${problem.code}-${problem.destination}`}>{problem.message}</li>)}
        </ul>
      )}
      {assessment && (
        <p className="text-[10px] text-muted-foreground">
          Unmapped columns stay in Airtable and are not imported{assessment.unmappedFields.length ? `: ${assessment.unmappedFields.join(", ")}` : "."}
        </p>
      )}
      {preview && (
        <div className="text-[10px] text-muted-foreground space-y-1" data-testid={`airtable-sync-preview-${purpose}`}>
          <p>
            {purpose === "roster" && preview.read
              ? `Read ${preview.read.rawRead} of up to ${preview.read.cap} across ${preview.pages ?? 0} pages. Seen ${preview.read.seen}, valid ${preview.read.valid}, duplicate/conflict ${preview.read.duplicateRecord + preview.read.conflict}, missing required ${preview.read.missingRequired}, updated ${preview.read.update}, unchanged ${preview.read.unchanged}, removals ${preview.read.remove}.`
              : `Create ${preview.counts.create ?? 0}, link ${preview.counts.link ?? 0}, update ${preview.counts.update ?? 0}, conflicts ${preview.counts.conflict ?? 0}, skipped ${preview.counts.skipped ?? 0}.`}
          </p>
          {preview.notes.map((note) => <p key={note}>{note}</p>)}
          {purpose === "roster" && <RosterSyncReport report={syncedReport ?? preview.report ?? null} />}
          {purpose === "events" && preview.rows.slice(0, 8).map((row) => <p key={`${row.action}-${row.airtableId}`}>{row.action}: {row.label}</p>)}
        </div>
      )}
      <ConfirmDialog />
    </div>
  );
}
