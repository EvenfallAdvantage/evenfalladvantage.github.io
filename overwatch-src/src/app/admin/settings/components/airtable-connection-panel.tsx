"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { saveIntegrationConnectionSettings } from "@/lib/supabase/db";
import { listAirtableBases, listAirtableTables, previewAirtableApplicants, type AirtablePreviewRecord } from "@/lib/services/airtable-service";
import { readSavedAirtableSettings, sanitizeAirtableSettings, type AirtableChoice } from "@/lib/integrations/airtable";
import type { IntegrationConnection } from "@/lib/integrations/connections";

interface Props {
  companyId: string;
  canManage: boolean;
  connection: IntegrationConnection | null;
  onSaved: () => void;
}

export default function AirtableConnectionPanel({ companyId, canManage, connection, onSaved }: Props) {
  const saved = readSavedAirtableSettings(connection?.settings);
  const [baseId, setBaseId] = useState(saved.baseId);
  const [tableId, setTableId] = useState(saved.tableId);
  const [bases, setBases] = useState<AirtableChoice[]>([]);
  const [tables, setTables] = useState<AirtableChoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<AirtablePreviewRecord[] | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    setBaseId(saved.baseId);
    setTableId(saved.tableId);
  }, [saved.baseId, saved.tableId]);

  const live = connection && connection.status !== "disconnected" && connection.status !== "revoked";
  if (!live) {
    return (
      <p className="text-[10px] text-muted-foreground" data-testid="airtable-oauth-note">
        Airtable uses OAuth. Connect above with the Airtable account that owns this company&apos;s base. API keys are not accepted.
      </p>
    );
  }

  async function loadBases() {
    setBusy("bases");
    try {
      setBases(await listAirtableBases(companyId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list bases");
    } finally {
      setBusy(null);
    }
  }

  async function loadTables(nextBase: string) {
    setBusy("tables");
    try {
      setTables(await listAirtableTables(companyId, nextBase));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list tables");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    const base = bases.find((b) => b.id === baseId);
    const table = tables.find((t) => t.id === tableId);
    const cleaned = sanitizeAirtableSettings({
      baseId,
      baseName: base?.name ?? saved.baseName,
      tableId,
      tableName: table?.name ?? (tableId === saved.tableId ? saved.tableName : ""),
    });
    if (!cleaned.ok) { toast.error(cleaned.error); return; }
    setBusy("save");
    try {
      await saveIntegrationConnectionSettings(companyId, "airtable", cleaned.settings);
      toast.success("Airtable base saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function loadPreview() {
    setBusy("preview");
    setPreview(null);
    try {
      const result = await previewAirtableApplicants(companyId);
      setPreview(result.records);
      setTruncated(result.truncated);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border/40 p-4 space-y-3" data-testid="airtable-settings">
      <div>
        <p className="text-sm font-semibold">Airtable base</p>
        <p className="text-[10px] text-muted-foreground">
          Pick the base and table to read. Test connection above checks Airtable before the card shows Connected.
          This preview does not create applicants and does not change Airtable.
        </p>
        {connection.last_test_ok !== true && (
          <p className="text-[10px] text-amber-500 mt-1">Run Test connection before importing applicants.</p>
        )}
      </div>
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => void loadBases()}>
            {busy === "bases" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load bases"}
          </Button>
          <select
            aria-label="Airtable base"
            className="h-8 rounded border border-border/40 bg-background px-2 text-xs"
            value={baseId}
            onChange={(e) => {
              setBaseId(e.target.value);
              setTableId("");
              setTables([]);
              setPreview(null);
              if (e.target.value) void loadTables(e.target.value);
            }}
          >
            <option value="">Select a base</option>
            {baseId && !bases.some((b) => b.id === baseId) && <option value={baseId}>{saved.baseName || baseId}</option>}
            {bases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select
            aria-label="Airtable table"
            className="h-8 rounded border border-border/40 bg-background px-2 text-xs"
            value={tableId}
            onChange={(e) => { setTableId(e.target.value); setPreview(null); }}
          >
            <option value="">Select a table</option>
            {tableId && !tables.some((t) => t.id === tableId) && <option value={tableId}>{saved.tableName || tableId}</option>}
            {tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button type="button" size="sm" className="h-8 text-xs" disabled={!!busy || !baseId} onClick={() => void save()}>Save base</Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy || connection.last_test_ok !== true} onClick={() => void loadPreview()}>
            {busy === "preview" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview records"}
          </Button>
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">Only owners and admins can change the Airtable base.</p>
      )}
      {preview && (
        <div data-testid="airtable-preview">
          <p className="text-[10px] text-muted-foreground mb-1">
            First {preview.length} record{preview.length === 1 ? "" : "s"}{truncated ? " (later pages are not loaded)" : ""}. Import them from Staff → Applicants after you review the list there.
          </p>
          <ul className="space-y-1">
            {preview.map((row) => (
              <li key={row.airtableId} className="text-xs">
                {(row.firstName || row.lastName) ? `${row.firstName} ${row.lastName}`.trim() : "No name"} — {row.email || "no email, will not import"}
              </li>
            ))}
            {preview.length === 0 && <li className="text-xs text-muted-foreground">No records in the first page.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
