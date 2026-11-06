/**
 * Browser-side Airtable settings. Ids only. Tokens never belong in this object.
 * The Edge adapter and the settings trigger enforce the same shapes.
 */

export const AIRTABLE_BASE_ID = /^app[A-Za-z0-9]{14}$/;
export const AIRTABLE_TABLE_ID = /^tbl[A-Za-z0-9]{14}$/;
export const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

export interface AirtableChoice {
  id: string;
  name: string;
}

export interface AirtableSettingsInput {
  baseId: string;
  baseName: string;
  tableId: string;
  tableName: string;
}

export function sanitizeAirtableSettings(input: AirtableSettingsInput): { ok: true; settings: Record<string, string> } | { ok: false; error: string } {
  const settings: Record<string, string> = {};
  const baseId = input.baseId.trim();
  const tableId = input.tableId.trim();
  if (baseId && !AIRTABLE_BASE_ID.test(baseId)) return { ok: false, error: "Choose a base from the list" };
  if (tableId && !AIRTABLE_TABLE_ID.test(tableId)) return { ok: false, error: "Choose a table from the list" };
  if (!baseId) return { ok: false, error: "Choose a base" };
  if (baseId) settings.base_id = baseId;
  const baseName = input.baseName.trim().slice(0, 200);
  const tableName = input.tableName.trim().slice(0, 200);
  if (baseName) settings.base_name = baseName;
  if (tableId) settings.table_id = tableId;
  if (tableId && tableName) settings.table_name = tableName;
  return { ok: true, settings };
}

export function readSavedAirtableSettings(settings: Record<string, unknown> | null | undefined): AirtableSettingsInput {
  const src = settings ?? {};
  const text = (key: string) => (typeof src[key] === "string" ? src[key].trim() : "");
  return {
    baseId: text("base_id"),
    baseName: text("base_name"),
    tableId: text("table_id"),
    tableName: text("table_name"),
  };
}
