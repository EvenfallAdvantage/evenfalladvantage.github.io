"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { describeAirtableTable, listAirtableBases, listAirtableTables, previewAirtableApplicants, saveAirtableTable, type AirtablePreviewRecord, type AirtableSchemaField } from "@/lib/services/airtable-service";
import { readSavedAirtableSettings, type AirtableChoice } from "@/lib/integrations/airtable";
import {
  authorizedChoices,
  readPurposeSelection,
  suggestedTableId,
  type AirtablePurpose,
} from "@/lib/integrations/airtable-sync";
import type { IntegrationConnection } from "@/lib/integrations/connections";
import { AirtableFieldMap } from "./airtable-field-map";

interface Props {
  companyId: string;
  canManage: boolean;
  connection: IntegrationConnection | null;
  onSaved: () => void;
}

const PURPOSES: { id: AirtablePurpose; title: string; preferredTable: string; copy: string }[] = [
  {
    id: "applicants",
    title: "Applicants",
    preferredTable: "",
    copy: "Reviewed applicant import still reads this saved table with the original name and email handling. Saving it does not change Roster or Events.",
  },
  {
    id: "roster",
    title: "Roster",
    preferredTable: "Employees",
    copy: "Choose the Employees table, then map its columns. Sync adds and updates roster people. It does not remove anyone or change owner and admin roles.",
  },
  {
    id: "events",
    title: "Ops Planning",
    preferredTable: "Events",
    copy: "Choose the Events table and map its columns. Sync creates draft operations only. Manually owned operations are not overwritten or deleted.",
  },
];

export default function AirtableConnectionPanel({ companyId, canManage, connection, onSaved }: Props) {
  const settings = connection?.settings;
  const applicantSaved = readSavedAirtableSettings(settings);
  const rosterSaved = readPurposeSelection(settings, "roster");
  const eventsSaved = readPurposeSelection(settings, "events");
  const savedByPurpose = { applicants: applicantSaved, roster: rosterSaved.baseId ? rosterSaved : { ...rosterSaved, baseId: applicantSaved.baseId, baseName: applicantSaved.baseName }, events: eventsSaved.baseId ? eventsSaved : { ...eventsSaved, baseId: applicantSaved.baseId, baseName: applicantSaved.baseName } };
  const [bases, setBases] = useState<AirtableChoice[]>([]);
  const [tablesByBase, setTablesByBase] = useState<Record<string, AirtableChoice[]>>({});
  const [loadedBases, setLoadedBases] = useState<Record<string, boolean>>({});
  const [baseIds, setBaseIds] = useState<Record<AirtablePurpose, string>>({
    applicants: applicantSaved.baseId,
    roster: savedByPurpose.roster.baseId,
    events: savedByPurpose.events.baseId,
  });
  const [tableIds, setTableIds] = useState<Record<AirtablePurpose, string>>({
    applicants: applicantSaved.tableId,
    roster: rosterSaved.tableId,
    events: eventsSaved.tableId,
  });
  const [schemas, setSchemas] = useState<Record<string, AirtableSchemaField[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<AirtablePreviewRecord[] | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    setBaseIds({
      applicants: applicantSaved.baseId,
      roster: rosterSaved.baseId || applicantSaved.baseId,
      events: eventsSaved.baseId || applicantSaved.baseId,
    });
    setTableIds({
      applicants: applicantSaved.tableId,
      roster: rosterSaved.tableId,
      events: eventsSaved.tableId,
    });
  }, [applicantSaved.baseId, applicantSaved.tableId, rosterSaved.baseId, rosterSaved.tableId, eventsSaved.baseId, eventsSaved.tableId]);

  const live = connection && connection.status !== "disconnected" && connection.status !== "revoked";
  if (!live) {
    return (
      <p className="text-[10px] text-muted-foreground" data-testid="airtable-oauth-note">
        Airtable uses OAuth. Connect above with the Airtable account that owns this company&apos;s base. API keys are not accepted.
      </p>
    );
  }

  async function refreshTables(baseId: string) {
    const tables = authorizedChoices(await listAirtableTables(companyId, baseId));
    setTablesByBase((prev) => ({ ...prev, [baseId]: tables }));
    setLoadedBases((prev) => ({ ...prev, [baseId]: true }));
    setTableIds((prev) => {
      const next = { ...prev };
      for (const purpose of PURPOSES) {
        if (baseIds[purpose.id] !== baseId) continue;
        const saved = purpose.id === "applicants" ? applicantSaved.tableId : purpose.id === "roster" ? rosterSaved.tableId : eventsSaved.tableId;
        next[purpose.id] = suggestedTableId(tables, purpose.preferredTable, prev[purpose.id] || saved);
      }
      return next;
    });
  }

  async function loadBases() {
    setBusy("bases");
    try {
      const nextBases = authorizedChoices(await listAirtableBases(companyId));
      setBases(nextBases);
      const ids = [...new Set(Object.values(baseIds).filter(Boolean))];
      await Promise.all(ids.map((id) => refreshTables(id)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not list bases");
    } finally {
      setBusy(null);
    }
  }

  async function save(purpose: AirtablePurpose) {
    const baseId = baseIds[purpose];
    const tableId = tableIds[purpose];
    const base = bases.find((item) => item.id === baseId);
    const tables = tablesByBase[baseId] ?? [];
    const table = tables.find((item) => item.id === tableId);
    const saved = purpose === "applicants" ? applicantSaved : purpose === "roster" ? rosterSaved : eventsSaved;
    if (!baseId || !tableId) { toast.error("Choose a base and table"); return; }
    setBusy(`save-${purpose}`);
    try {
      await saveAirtableTable(companyId, purpose, {
        baseId,
        baseName: base?.name ?? saved.baseName,
        tableId,
        tableName: table?.name ?? (tableId === saved.tableId ? saved.tableName : ""),
      });
      toast.success(`${purpose === "events" ? "Ops Planning" : purpose === "roster" ? "Roster" : "Applicants"} table saved`);
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

  async function loadSchema(purpose: "roster" | "events") {
    const baseId = baseIds[purpose];
    const tableId = tableIds[purpose];
    if (!baseId || !tableId) return;
    setBusy(`schema-${purpose}`);
    try {
      const fields = await describeAirtableTable(companyId, baseId, tableId);
      setSchemas((prev) => ({ ...prev, [`${purpose}:${tableId}`]: fields }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load fields");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-lg border border-border/40 p-4 space-y-4" data-testid="airtable-settings">
      <div>
        <p className="text-sm font-semibold">Airtable tables</p>
        <p className="text-[10px] text-muted-foreground">
          One OAuth connection feeds Applicants, Roster, and Ops Planning. Load bases shows every base this account can read.
          Choosing a base lists every table in that base. A saved table stays selected and does not hide the others.
          Airtable is read-only.
        </p>
        {connection.last_test_ok !== true && (
          <p className="text-[10px] text-amber-500 mt-1">Run Test connection before importing or syncing.</p>
        )}
      </div>
      {canManage ? (
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => void loadBases()}>
          {busy === "bases" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load bases"}
        </Button>
      ) : (
        <p className="text-[10px] text-muted-foreground">Only owners and admins can change Airtable tables.</p>
      )}
      {PURPOSES.map((purpose) => {
        const baseId = baseIds[purpose.id];
        const tableId = tableIds[purpose.id];
        const loaded = Boolean(baseId && loadedBases[baseId]);
        const tables = tablesByBase[baseId] ?? [];
        const saved = purpose.id === "applicants" ? applicantSaved : purpose.id === "roster" ? rosterSaved : eventsSaved;
        const savedHere = saved.baseId === baseId && saved.tableId && saved.tableId === tableId;
        return (
          <div key={purpose.id} className="rounded-lg border border-border/40 p-3 space-y-2" data-testid={`airtable-purpose-${purpose.id}`}>
            <div>
              <p className="text-sm font-semibold">{purpose.title}</p>
              <p className="text-[10px] text-muted-foreground">{purpose.copy}</p>
              {saved.tableName && (
                <p className="text-[10px] text-muted-foreground mt-1">Saved {purpose.title.toLowerCase()} table: {saved.baseName || saved.baseId} / {saved.tableName}</p>
              )}
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label={`${purpose.title} base`}
                  className="h-8 rounded border border-border/40 bg-background px-2 text-xs"
                  value={baseId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setBaseIds((prev) => ({ ...prev, [purpose.id]: next }));
                    setTableIds((prev) => ({ ...prev, [purpose.id]: "" }));
                    if (!next) return;
                    void listAirtableTables(companyId, next).then((rows) => {
                      const tables = authorizedChoices(rows);
                      setTablesByBase((prev) => ({ ...prev, [next]: tables }));
                      setLoadedBases((prev) => ({ ...prev, [next]: true }));
                      const savedId = purpose.id === "applicants" ? applicantSaved.tableId : purpose.id === "roster" ? rosterSaved.tableId : eventsSaved.tableId;
                      setTableIds((prev) => ({ ...prev, [purpose.id]: suggestedTableId(tables, purpose.preferredTable, prev[purpose.id] || savedId) }));
                    }).catch((err) => toast.error(err instanceof Error ? err.message : "Could not list tables"));
                  }}
                >
                  <option value="">Select a base</option>
                  {baseId && !bases.some((item) => item.id === baseId) && <option value={baseId}>{saved.baseName || baseId}</option>}
                  {bases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select
                  aria-label={`${purpose.title} table`}
                  data-testid={`airtable-table-${purpose.id}`}
                  className="h-8 rounded border border-border/40 bg-background px-2 text-xs"
                  value={loaded ? tableId : (tableId || "")}
                  disabled={!loaded || !!busy}
                  onFocus={() => { if (baseId && !loaded) void refreshTables(baseId); }}
                  onChange={(e) => setTableIds((prev) => ({ ...prev, [purpose.id]: e.target.value }))}
                >
                  {!loaded && <option value={tableId || ""}>Load bases to see every table</option>}
                  {loaded && <option value="">Select a table</option>}
                  {loaded && tables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  {loaded && tableId && !tables.some((item) => item.id === tableId) && <option value={tableId}>{saved.tableName || tableId} (saved)</option>}
                </select>
                <Button type="button" size="sm" className="h-8 text-xs" disabled={!!busy || !baseId || !tableId} onClick={() => void save(purpose.id)}>
                  {busy === `save-${purpose.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : `Save ${purpose.title}`}
                </Button>
                {purpose.id === "applicants" && (
                  <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy || connection.last_test_ok !== true} onClick={() => void loadPreview()}>
                    {busy === "preview" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Preview records"}
                  </Button>
                )}
              </div>
            )}
            {purpose.id !== "applicants" && canManage && savedHere && (
              <AirtableFieldMap
                companyId={companyId}
                purpose={purpose.id}
                baseId={baseId}
                tableId={tableId}
                fields={schemas[`${purpose.id}:${tableId}`] ?? null}
                loading={busy === `schema-${purpose.id}`}
                tested={connection.last_test_ok === true}
                onLoadFields={() => {
                  const purposeId = purpose.id;
                  if (purposeId === "roster" || purposeId === "events") void loadSchema(purposeId);
                }}
                onSynced={onSaved}
              />
            )}
          </div>
        );
      })}
      {preview && (
        <div data-testid="airtable-preview">
          <p className="text-[10px] text-muted-foreground mb-1">
            First {preview.length} applicant record{preview.length === 1 ? "" : "s"}{truncated ? " (later pages are not loaded)" : ""}. Import them from Staff → Applicants after you review the list there.
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
